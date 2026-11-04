"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hashToken } from "@/lib/tokens";
import { MAX_FAILURES, constanciaCookie, last4 } from "./access";

export type ConstanciaState = { error?: string } | undefined;

// La constancia pide los últimos 4 dígitos del documento de quien firmó; a los 5 fallos se bloquea y el consultorio debe reenviarla.
export async function unlockConstancia(token: string, _: ConstanciaState, fd: FormData): Promise<ConstanciaState> {
  const c = await db.consent.findFirst({
    where: { receiptTokenHash: hashToken(token), receiptExpiresAt: { gt: new Date() } },
    select: { id: true, receiptFailures: true, signerDocument: true, patient: { select: { documentNumber: true } } },
  });
  if (!c) return { error: "Este enlace ya no está disponible. Pide uno nuevo al consultorio." };
  if (c.receiptFailures >= MAX_FAILURES) return { error: "Enlace bloqueado por demasiados intentos. Pide uno nuevo al consultorio." };
  const typed = last4(String(fd.get("last4") ?? ""));
  const want = last4(c.signerDocument) || last4(c.patient.documentNumber);
  if (typed.length < 4 || typed !== want) {
    const left = MAX_FAILURES - c.receiptFailures - 1;
    await db.consent.update({ where: { id: c.id }, data: { receiptFailures: { increment: 1 } } });
    return { error: left > 0 ? `Los dígitos no coinciden. Te quedan ${left} intento${left === 1 ? "" : "s"}.` : "Enlace bloqueado por demasiados intentos. Pide uno nuevo al consultorio." };
  }
  await db.consent.update({ where: { id: c.id }, data: { receiptFailures: 0 } });
  const k = constanciaCookie(token);
  (await cookies()).set(k.name, k.value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/constancia", maxAge: 60 * 30 });
  redirect(`/constancia/${token}`);
}
