"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { sealConsent } from "@/lib/seal";
import { hashToken } from "@/lib/tokens";
import { MAX_FAILURES, evidence, last4, signCookie } from "./access";

export type FirmarState = { error?: string } | undefined;

const live = (token: string) =>
  db.consentRequest.findFirst({ where: { tokenHash: hashToken(token), consentId: null, cancelledAt: null, expiresAt: { gt: new Date() } } });

export async function unlockSigning(token: string, _: FirmarState, fd: FormData): Promise<FirmarState> {
  const r = await live(token);
  if (!r) return { error: "Este enlace ya no está disponible. Pide uno nuevo al consultorio." };
  if (r.failures >= MAX_FAILURES) return { error: "Enlace bloqueado por demasiados intentos. Pide uno nuevo al consultorio." };
  const typed = last4(String(fd.get("last4") ?? ""));
  if (typed.length < 4 || typed !== last4(r.signerDocument)) {
    const left = MAX_FAILURES - r.failures - 1;
    await db.consentRequest.update({ where: { id: r.id }, data: { failures: { increment: 1 } } });
    return { error: left > 0 ? `Los dígitos no coinciden. Te quedan ${left} intento${left === 1 ? "" : "s"}.` : "Enlace bloqueado por demasiados intentos. Pide uno nuevo al consultorio." };
  }
  await db.consentRequest.update({ where: { id: r.id }, data: { failures: 0 } });
  const c = signCookie(token);
  (await cookies()).set(c.name, c.value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/firmar", maxAge: 60 * 30 });
  redirect(`/firmar/${token}`);
}

export async function unlocked(token: string) {
  const want = signCookie(token);
  const got = (await cookies()).get(want.name)?.value ?? "";
  return got.length === want.value.length && timingSafeEqual(Buffer.from(got), Buffer.from(want.value));
}

const signSchema = z.object({
  accept: z.literal("on", { message: "Marca la casilla que confirma que leíste y entiendes el documento" }),
  signature: z.string().startsWith("data:image/png;base64,", "Falta la firma").max(400_000, "La firma es demasiado grande"),
});

export async function signAsPatient(token: string, _: FirmarState, fd: FormData): Promise<FirmarState> {
  const r = await live(token);
  if (!r) return { error: "Este enlace ya no está disponible. Pide uno nuevo al consultorio." };
  if (r.failures >= MAX_FAILURES) return { error: "Enlace bloqueado. Pide uno nuevo al consultorio." };
  if (!(await unlocked(token))) return { error: "Escribe de nuevo los dígitos del documento." };
  const parsed = signSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ev = await evidence();
  try {
    const consent = await db.$transaction(async (tx) => {
      // Un solo uso: si otra pestaña ya firmó, la condición no se cumple y no se crea un segundo consentimiento.
      const claim = await tx.consentRequest.updateMany({ where: { id: r.id, consentId: null, cancelledAt: null }, data: { consentId: "pendiente" } });
      if (claim.count !== 1) throw new Error("used");
      const c = await tx.consent.create({
        data: {
          patientId: r.patientId, dentistId: r.dentistId, templateId: r.templateId, templateVersion: r.templateVersion, title: r.title, body: r.body, procedureNote: r.procedureNote,
          signerName: r.signerName, signerDocument: r.signerDocument, signerRelation: r.signerRelation, witnessName: null, signature: parsed.data.signature,
          signMethod: r.method, signIp: ev.ip, signAgent: ev.agent, requestId: r.id,
        },
      });
      await tx.consentRequest.update({ where: { id: r.id }, data: { consentId: c.id } });
      return c;
    });
    await sealConsent(consent.id);
    await db.auditLog.create({ data: { userId: null, action: "SIGN_REMOTE", entity: "Consent", entityId: consent.id, detail: `firmado por el paciente (${r.method === "QR" ? "QR" : "enlace"})` } });
  } catch {
    return { error: "No se pudo registrar la firma. Si ya firmaste, no hace falta repetirlo." };
  }
  redirect(`/firmar/${token}`);
}
