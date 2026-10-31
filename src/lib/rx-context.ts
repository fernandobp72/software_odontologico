import "server-only";
import { db } from "./db";
import type { AssessmentData } from "./assessment";
import type { RxContext } from "./rx-rules";

const yearsBetween = (from: Date, to: Date) => (to.getTime() - from.getTime()) / (365.25 * 86_400_000);

// Datos del paciente que alimentan las alertas y la fórmula automática: edad, peso, antecedentes,
// lo realizado en los últimos 7 días y los diagnósticos activos.
export async function rxContextFor(patientId: string, clinicId: string) {
  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId }, select: { id: true, firstName: true, lastName: true, documentType: true, documentNumber: true, birthDate: true, sex: true } });
  if (!patient) return null;
  const now = new Date();
  const since = new Date(now.getTime() - 7 * 86_400_000);
  const [assessment, done, dx] = await Promise.all([
    db.assessment.findFirst({ where: { patientId }, orderBy: { createdAt: "desc" }, select: { data: true } }),
    db.treatmentItem.findMany({ where: { status: "DONE", doneAt: { gte: since }, plan: { patientId } }, select: { name: true, tooth: true } }),
    db.diagnosis.findMany({ where: { patientId, status: "ACTIVE" }, select: { code: true, description: true, tooth: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const data = (assessment?.data ?? null) as AssessmentData | null;
  const w = Number(String(data?.peso ?? "").replace(",", "."));
  const ctx: RxContext = {
    ageYears: patient.birthDate ? Math.round(yearsBetween(patient.birthDate, now) * 10) / 10 : null,
    weightKg: Number.isFinite(w) && w > 1 && w < 300 ? w : null,
    assessment: data,
    doneItems: done,
    diagnoses: dx,
  };
  return { patient, ctx };
}
