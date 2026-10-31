"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/dal";
import { mailBody, mailConfigured, sendMail } from "@/lib/mailer";

export type BroadcastState = { error?: string; ok?: boolean; info?: string } | undefined;

const schema = z.object({
  audience: z.enum(["ALL", "ACTIVE", "TRIAL", "SUSPENDED"]),
  subject: z.string().trim().min(3, "Escribe el asunto").max(150),
  message: z.string().trim().min(10, "Escribe el mensaje").max(5000),
});
const LABEL = { ALL: "todos los clientes", ACTIVE: "clientes activos", TRIAL: "clientes en prueba", SUSPENDED: "clientes suspendidos" } as const;

// Un correo por administrador activo de cada cliente (nunca copia oculta masiva), con tope por envío.
export async function sendBroadcast(_: BroadcastState, fd: FormData): Promise<BroadcastState> {
  const admin = await requirePlatformAdmin();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (!(await mailConfigured())) return { error: "Configura primero el correo de la plataforma (menú Correo)" };
  const d = parsed.data;
  const admins = await db.user.findMany({
    where: { role: "ADMIN", active: true, clinic: { system: false, ...(d.audience === "ALL" ? {} : { status: d.audience }) } },
    select: { email: true, name: true },
    take: 300,
  });
  if (admins.length === 0) return { error: "No hay destinatarios en ese grupo" };
  let sent = 0;
  let failed = 0;
  let firstError: string | undefined;
  for (const a of admins) {
    const r = await sendMail(a.email, d.subject, mailBody({ title: d.subject, paragraphs: [`Hola ${a.name},`, ...d.message.split(/\n{2,}/)] }));
    if (r.ok) sent++;
    else { failed++; firstError ??= r.error; }
  }
  await db.auditLog.create({ data: { userId: admin.id, action: "PLATFORM_BROADCAST", entity: "Broadcast", entityId: null, detail: `envió el comunicado «${d.subject}» a ${LABEL[d.audience]} (${sent} enviados${failed ? `, ${failed} fallidos` : ""})` } });
  revalidatePath("/plataforma/actividad");
  return failed && !sent ? { error: `No se pudo enviar: ${firstError}` } : { ok: true, info: `Enviado a ${sent} persona(s)${failed ? `; fallaron ${failed} (${firstError})` : ""}.` };
}
