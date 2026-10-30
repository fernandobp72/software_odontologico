"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseIntake } from "@/lib/intake";
import { hashToken } from "@/lib/tokens";
import { isBlocked, recordFailure } from "@/lib/rate-limit";

export type IntakeState = { error?: string; ok?: boolean } | undefined;

const schema = z.object({
  signerName: z.string().trim().min(3, "Escribe tu nombre completo").max(120),
  signature: z.string().startsWith("data:image/png;base64,", "Falta tu firma").max(400_000, "La firma es demasiado grande"),
  accept: z.literal("on", { message: "Debes autorizar el tratamiento de tus datos" }),
});

// Acción pública: la autoriza el token secreto del enlace (sin sesión).
export async function submitIntake(token: string, _: IntakeState, fd: FormData): Promise<IntakeState> {
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0]?.trim() ?? "?";
  const key = `intake:${ip}`;
  if (isBlocked(key)) return { error: "Demasiados intentos. Espera unos minutos." };
  const form = token.length >= 16 ? await db.intakeForm.findUnique({ where: { tokenHash: hashToken(token) }, include: { patient: { select: { id: true, dataConsentAt: true } } } }) : null;
  if (!form || form.revokedAt || form.expiresAt < new Date() || form.submittedAt) {
    recordFailure(key);
    return { error: "Este enlace ya no está disponible. Pide uno nuevo al consultorio." };
  }
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parseIntake(fd);
  if (!Object.keys(data).length) return { error: "Contesta al menos una pregunta" };

  // updateMany con submittedAt null evita que el mismo enlace se envíe dos veces a la vez.
  const res = await db.intakeForm.updateMany({
    where: { id: form.id, submittedAt: null },
    data: { submittedAt: new Date(), data, signerName: parsed.data.signerName, signature: parsed.data.signature },
  });
  if (!res.count) return { error: "Este formulario ya fue enviado." };
  if (!form.patient.dataConsentAt) await db.patient.update({ where: { id: form.patient.id }, data: { dataConsentAt: new Date() } });
  await db.auditLog.create({ data: { action: "PATIENT_INTAKE", entity: "IntakeForm", entityId: form.id } });
  revalidatePath(`/pacientes/${form.patientId}/historia`);
  return { ok: true };
}
