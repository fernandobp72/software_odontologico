"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireClinician } from "@/lib/dal";
import { CONSENT_TEMPLATES, CONSENT_VERSION, buildConsentBody } from "@/lib/consents";

export type ConsentState = { error?: string; ok?: boolean } | undefined;

const schema = z.object({
  templateId: z.string().min(1),
  procedureNote: z.string().trim().max(300).optional(),
  signerName: z.string().trim().min(3, "Escribe el nombre de quien firma").max(120),
  signerDocument: z.string().trim().max(30).optional(),
  signerRelation: z.enum(["Paciente", "Padre o madre", "Representante legal", "Acudiente"]),
  witnessName: z.string().trim().max(120).optional(),
  signature: z.string().startsWith("data:image/png;base64,", "Falta la firma").max(400_000, "La firma es demasiado grande"),
});

export async function signConsent(patientId: string, _: ConsentState, fd: FormData): Promise<ConsentState> {
  const user = await requireClinician();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId } });
  if (!patient) return { error: "Paciente no encontrado" };
  const dentist = await db.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const template = CONSENT_TEMPLATES.find((t) => t.id === d.templateId);
  if (!template) return { error: "Plantilla inválida" };

  const body = buildConsentBody(template, {
    paciente: `${patient.firstName} ${patient.lastName}`,
    documento: `${patient.documentType} ${patient.documentNumber}`,
    profesional: dentist?.name ?? "el profesional tratante",
    procedimiento: d.procedureNote || undefined,
  });

  const row = await db.consent.create({
    data: {
      patientId,
      dentistId: user.id,
      templateId: template.id,
      templateVersion: CONSENT_VERSION,
      title: template.title,
      body,
      procedureNote: d.procedureNote || null,
      signerName: d.signerName,
      signerDocument: d.signerDocument || null,
      signerRelation: d.signerRelation,
      witnessName: d.witnessName || null,
      signature: d.signature,
    },
  });
  await db.auditLog.create({ data: { userId: user.id, action: "SIGN", entity: "Consent", entityId: row.id } });
  revalidatePath(`/pacientes/${patientId}/consentimientos`);
  return { ok: true };
}
