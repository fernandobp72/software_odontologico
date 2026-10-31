"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/dal";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { mailBody, sendMail, verifyMail } from "@/lib/mailer";

export type MailState = { error?: string; ok?: boolean; info?: string } | undefined;

const schema = z.object({
  host: z.string().trim().min(3, "Escribe el servidor SMTP").max(200),
  port: z.coerce.number().int().min(1).max(65535),
  secure: z.string().optional(),
  username: z.string().trim().max(200).optional(),
  password: z.string().max(500).optional(),
  fromName: z.string().trim().min(2, "Escribe el nombre que verán quienes reciban el correo").max(100),
  fromEmail: z.string().trim().toLowerCase().email("El correo remitente no es válido"),
});

export async function saveMailConfig(_: MailState, fd: FormData): Promise<MailState> {
  const admin = await requirePlatformAdmin();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const current = await db.emailConfig.findUnique({ where: { id: "main" } });
  const password = d.password || (current?.passwordEnc ? decryptSecret(current.passwordEnc) : null);
  const secure = d.secure === "on";

  // Antes de guardar se comprueba que el servidor responde y acepta el usuario y la contraseña.
  const check = await verifyMail({ host: d.host, port: d.port, secure, username: d.username || null, password });
  if (!check.ok) return { error: `No se pudo conectar: ${check.error}` };

  const data = { host: d.host, port: d.port, secure, username: d.username || null, fromName: d.fromName, fromEmail: d.fromEmail, ...(d.password ? { passwordEnc: encryptSecret(d.password) } : {}) };
  await db.emailConfig.upsert({ where: { id: "main" }, create: { id: "main", ...data }, update: data });
  await db.auditLog.create({ data: { userId: admin.id, action: "PLATFORM_MAIL_CONFIG", entity: "EmailConfig", entityId: "main", detail: `configuró el correo de la plataforma (${d.host}:${d.port})` } });
  revalidatePath("/plataforma/correo");
  return { ok: true, info: "Conexión comprobada y guardada." };
}

export async function sendTestMail(): Promise<MailState> {
  const admin = await requirePlatformAdmin();
  const me = await db.user.findUniqueOrThrow({ where: { id: admin.id }, select: { email: true } });
  const r = await sendMail(me.email, "Prueba de correo", mailBody({ title: "Correo configurado", paragraphs: ["Si lees esto, la plataforma ya puede enviar correos de recuperación de contraseña, invitaciones y comunicados."] }));
  return r.ok ? { ok: true, info: `Enviamos una prueba a ${me.email}. Revisa también la carpeta de spam.` } : { error: r.error };
}

export async function removeMailConfig(): Promise<void> {
  const admin = await requirePlatformAdmin();
  await db.emailConfig.deleteMany({ where: { id: "main" } });
  await db.auditLog.create({ data: { userId: admin.id, action: "PLATFORM_MAIL_REMOVE", entity: "EmailConfig", entityId: "main", detail: "quitó la conexión de correo de la plataforma" } });
  revalidatePath("/plataforma/correo");
}
