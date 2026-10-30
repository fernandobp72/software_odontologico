"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClinician } from "@/lib/dal";
import { ASSESSMENT_SECTIONS, type AssessmentData } from "@/lib/assessment";
import { INTAKE_DAYS } from "@/lib/intake";
import { hashToken, newToken } from "@/lib/tokens";

export type AssessmentState = { error?: string; ok?: boolean } | undefined;

export async function saveAssessment(patientId: string, _: AssessmentState, formData: FormData): Promise<AssessmentState> {
  const user = await requireClinician();
  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId }, select: { id: true } });
  if (!patient) return { error: "Paciente no encontrado" };

  // Solo se guardan los campos definidos, con longitud acotada.
  const data: AssessmentData = {};
  for (const section of ASSESSMENT_SECTIONS) {
    for (const f of section.fields) {
      if (f.type === "checks") {
        const vals = formData.getAll(f.name).map(String).filter((v) => f.options?.includes(v));
        if (vals.length) data[f.name] = vals;
      } else {
        const v = String(formData.get(f.name) ?? "").trim().slice(0, 2000);
        if (!v) continue;
        if (f.type === "select" && !f.options?.includes(v)) continue;
        data[f.name] = v;
      }
    }
  }
  if (!Object.keys(data).length) return { error: "No hay información para guardar" };

  const row = await db.assessment.create({ data: { patientId, authorId: user.id, data } });
  // Si venía del formulario previo del paciente, queda marcado como revisado.
  const intakeId = String(formData.get("intakeId") ?? "");
  if (intakeId) {
    await db.intakeForm.updateMany({ where: { id: intakeId, patientId, clinicId: user.clinicId, submittedAt: { not: null }, reviewedAt: null }, data: { reviewedAt: new Date(), reviewedById: user.id } });
  }
  await db.auditLog.create({ data: { userId: user.id, action: "SIGN", entity: "Assessment", entityId: row.id } });
  revalidatePath(`/pacientes/${patientId}/historia`);
  return { ok: true };
}

// El enlace se devuelve una sola vez: en la base solo queda su hash.
export async function createIntakeLink(patientId: string): Promise<{ token?: string; error?: string }> {
  const user = await requireClinician();
  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId }, select: { id: true } });
  if (!patient) return { error: "Paciente no encontrado" };
  // Un solo enlace vigente por paciente: los anteriores sin enviar se anulan.
  await db.intakeForm.updateMany({ where: { patientId, submittedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  const token = newToken();
  const row = await db.intakeForm.create({
    data: { clinicId: user.clinicId, patientId, createdById: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + INTAKE_DAYS * 86_400_000) },
  });
  await db.auditLog.create({ data: { userId: user.id, action: "CREATE", entity: "IntakeForm", entityId: row.id } });
  revalidatePath(`/pacientes/${patientId}/historia`);
  return { token };
}

export async function revokeIntakeLink(patientId: string): Promise<void> {
  const user = await requireClinician();
  await db.intakeForm.updateMany({ where: { patientId, clinicId: user.clinicId, submittedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath(`/pacientes/${patientId}/historia`);
}
