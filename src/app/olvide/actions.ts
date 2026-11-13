"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { mailConfigured } from "@/lib/mailer";
import { sendResetEmail } from "@/lib/mail-links";
import { anyBlocked, recordFailure } from "@/lib/rate-limit";
import { clientIp } from "@/lib/client-ip";

export type ForgotState = { error?: string; sent?: boolean; email?: string } | undefined;

// Responde igual exista o no la cuenta, para no revelar quién tiene cuenta.
export async function requestReset(_: ForgotState, fd: FormData): Promise<ForgotState> {
  const typed = String(fd.get("email") ?? "");
  const parsed = z.string().trim().toLowerCase().email("Correo inválido").safeParse(typed);
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: typed };
  const ip = (await clientIp()) ?? "local";
  const keys = [`forgot:ip:${ip}`, `forgot:${parsed.data}`];
  if (await anyBlocked(keys)) return { error: "Demasiadas solicitudes. Espera unos minutos.", email: typed };
  await Promise.all(keys.map(recordFailure));
  if (!(await mailConfigured())) return { error: "El envío de correos aún no está activado. Pide al administrador de tu cuenta un enlace para restablecerla.", email: typed };

  const user = await db.user.findUnique({ where: { email: parsed.data }, select: { id: true, name: true, email: true, active: true, clinic: { select: { status: true } } } });
  if (user?.active && user.clinic.status !== "SUSPENDED") {
    await sendResetEmail(user);
    await db.auditLog.create({ data: { userId: user.id, action: "RESET_EMAIL", entity: "User", entityId: user.id } });
  }
  return { sent: true, email: parsed.data };
}
