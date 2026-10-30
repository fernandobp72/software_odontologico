"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClinician } from "@/lib/dal";
import { ASSESSMENT_SECTIONS, type AssessmentData } from "@/lib/assessment";

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
  await db.auditLog.create({ data: { userId: user.id, action: "SIGN", entity: "Assessment", entityId: row.id } });
  revalidatePath(`/pacientes/${patientId}/historia`);
  return { ok: true };
}
