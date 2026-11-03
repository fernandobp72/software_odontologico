"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { receiptCookie } from "./access";

export type UnlockState = { error?: string } | undefined;

const MAX_FAILURES = 5;
const last4 = (doc: string) => doc.replace(/\D/g, "").slice(-4) || doc.trim().toLowerCase().slice(-4);

// El enlace secreto no basta: quien lo abre debe saber los últimos 4 dígitos del documento del paciente.
// A los 5 fallos el enlace se bloquea y el consultorio debe enviar uno nuevo.
export async function unlockReceipt(token: string, _: UnlockState, fd: FormData): Promise<UnlockState> {
  const h = hashToken(token);
  const p = await db.payment.findFirst({ where: { shareTokenHash: h, shareExpiresAt: { gt: new Date() } }, select: { id: true, shareFailures: true, patient: { select: { documentNumber: true } } } });
  if (!p) return { error: "Este enlace ya no está disponible. Pide uno nuevo al consultorio." };
  if (p.shareFailures >= MAX_FAILURES) return { error: "Enlace bloqueado por demasiados intentos. Pide uno nuevo al consultorio." };
  const typed = String(fd.get("last4") ?? "");
  if (last4(typed) !== last4(p.patient.documentNumber) || last4(typed).length < 4) {
    const left = MAX_FAILURES - p.shareFailures - 1;
    await db.payment.update({ where: { id: p.id }, data: { shareFailures: { increment: 1 } } });
    return { error: left > 0 ? `Los dígitos no coinciden. Te quedan ${left} intento${left === 1 ? "" : "s"}.` : "Enlace bloqueado por demasiados intentos. Pide uno nuevo al consultorio." };
  }
  await db.payment.update({ where: { id: p.id }, data: { shareFailures: 0 } });
  (await cookies()).set(receiptCookie(token).name, receiptCookie(token).value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/comprobante", maxAge: 60 * 30 });
  redirect(`/comprobante/${token}`);
}
