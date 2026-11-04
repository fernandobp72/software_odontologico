"use server";

import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { constanciaAfterSigning } from "@/lib/constancia";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { sealConsent } from "@/lib/seal";
import { hashToken } from "@/lib/tokens";
import { MAX_FAILURES, STAFF_BLOCK, evidence, last4, signCookie, staffSession, unlocked } from "./access";

export type FirmarState = { error?: string } | undefined;

const FID = "fid";

const live = (token: string) =>
  db.consentRequest.findFirst({ where: { tokenHash: hashToken(token), consentId: null, cancelledAt: null, expiresAt: { gt: new Date() } } });

export async function unlockSigning(token: string, _: FirmarState, fd: FormData): Promise<FirmarState> {
  if (await staffSession()) return { error: STAFF_BLOCK };
  const r = await live(token);
  if (!r) return { error: "Este enlace ya no está disponible. Pide uno nuevo al consultorio." };
  if (r.failures >= MAX_FAILURES) return { error: "Enlace bloqueado por demasiados intentos. Pide uno nuevo al consultorio." };
  const typed = last4(String(fd.get("last4") ?? ""));
  if (typed.length < 4 || typed !== last4(r.signerDocument)) {
    const left = MAX_FAILURES - r.failures - 1;
    await db.consentRequest.update({ where: { id: r.id }, data: { failures: { increment: 1 } } });
    return { error: left > 0 ? `Los dígitos no coinciden. Te quedan ${left} intento${left === 1 ? "" : "s"}.` : "Enlace bloqueado por demasiados intentos. Pide uno nuevo al consultorio." };
  }
  await db.consentRequest.update({ where: { id: r.id }, data: { failures: 0, unlockedAt: new Date() } });
  const c = signCookie(token);
  const jar = await cookies();
  jar.set(c.name, c.value, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/firmar", maxAge: 60 * 30 });
  // Huella del aparato: un identificador propio que se queda en este navegador. Si el mismo aparato firma por varios pacientes, se alerta.
  if (!jar.get(FID)?.value) jar.set(FID, randomBytes(16).toString("hex"), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect(`/firmar/${token}`);
}

const signSchema = z.object({
  accept: z.literal("on", { message: "Marca la casilla que confirma que leíste y entiendes el documento" }),
  signature: z.string().startsWith("data:image/png;base64,", "Falta la firma").max(400_000, "La firma es demasiado grande"),
});

export async function signAsPatient(token: string, _: FirmarState, fd: FormData): Promise<FirmarState> {
  if (await staffSession()) return { error: STAFF_BLOCK };
  const r = await live(token);
  if (!r) return { error: "Este enlace ya no está disponible. Pide uno nuevo al consultorio." };
  if (r.failures >= MAX_FAILURES) return { error: "Enlace bloqueado. Pide uno nuevo al consultorio." };
  if (!(await unlocked(token))) return { error: "Escribe de nuevo los dígitos del documento." };
  const parsed = signSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ev = await evidence();
  const fid = (await cookies()).get(FID)?.value;
  const signDevice = fid ? createHash("sha256").update(fid).digest("hex").slice(0, 24) : null;
  const signReadSec = r.unlockedAt ? Math.max(0, Math.round((Date.now() - r.unlockedAt.getTime()) / 1000)) : null;
  try {
    const consent = await db.$transaction(async (tx) => {
      // Un solo uso: si otra pestaña ya firmó, la condición no se cumple y no se crea un segundo consentimiento.
      const claim = await tx.consentRequest.updateMany({ where: { id: r.id, consentId: null, cancelledAt: null }, data: { consentId: "pendiente" } });
      if (claim.count !== 1) throw new Error("used");
      const c = await tx.consent.create({
        data: {
          patientId: r.patientId, dentistId: r.dentistId, templateId: r.templateId, templateVersion: r.templateVersion, title: r.title, body: r.body, procedureNote: r.procedureNote,
          signerName: r.signerName, signerDocument: r.signerDocument, signerRelation: r.signerRelation, witnessName: null, signature: parsed.data.signature,
          signMethod: r.method, signIp: ev.ip, signAgent: ev.agent, signDevice, signReadSec, requestId: r.id,
        },
      });
      await tx.consentRequest.update({ where: { id: r.id }, data: { consentId: c.id } });
      return c;
    });
    await sealConsent(consent.id);
    await constanciaAfterSigning(consent.id);
    await db.auditLog.create({ data: { userId: null, action: "SIGN_REMOTE", entity: "Consent", entityId: consent.id, detail: `firmado por el paciente (${r.method === "QR" ? "QR" : "enlace"})` } });
  } catch {
    return { error: "No se pudo registrar la firma. Si ya firmaste, no hace falta repetirlo." };
  }
  redirect(`/firmar/${token}`);
}
