"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireClinician } from "@/lib/dal";
import { CONDITIONS, SURFACES, VALID_TEETH } from "@/lib/catalogs";

const changeSchema = z.object({
  tooth: z.number().int().refine((t) => VALID_TEETH.has(t), "Diente inválido"),
  surface: z.enum(SURFACES.map((s) => s.key) as [string, ...string[]]).nullable(),
  condition: z.enum(Object.keys(CONDITIONS) as [keyof typeof CONDITIONS, ...(keyof typeof CONDITIONS)[]]),
});
const findingsSchema = z.object({ patientId: z.string().min(1), changes: z.array(changeSchema).min(1).max(12) });

// El odontograma es historial: borrar o deshacer también se registra (condición HEALTHY / valor previo).
export async function applyFindings(input: z.input<typeof findingsSchema>): Promise<{ error?: string }> {
  const user = await requireClinician();
  const parsed = findingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { patientId, changes } = parsed.data;

  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId } });
  if (!patient) return { error: "Paciente no encontrado" };

  await db.toothFinding.createMany({ data: changes.map((c) => ({ patientId, ...c })) });
  await db.auditLog.create({
    data: { userId: user.id, action: "ODONTOGRAM", entity: "Patient", entityId: patientId },
  });
  revalidatePath(`/pacientes/${patientId}`);
  return {};
}

const evolutionSchema = z.object({
  patientId: z.string().min(1),
  reason: z.string().trim().optional(),
  diagnosisCode: z.union([z.literal(""), z.string().regex(/^[A-Z]\d{2}(\.\d{1,2})?$/, "Código CIE-10 inválido")]).optional(),
  procedureCode: z.union([z.literal(""), z.string().regex(/^\d{6}$/, "El código CUPS debe tener 6 dígitos")]).optional(),
  note: z.string().trim().min(5, "Escribe la evolución"),
});

export type EvolutionState = { error?: string; ok?: boolean } | undefined;

export async function signEvolution(_: EvolutionState, formData: FormData): Promise<EvolutionState> {
  const user = await requireClinician();
  const parsed = evolutionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const patient = await db.patient.findFirst({ where: { id: d.patientId, clinicId: user.clinicId } });
  if (!patient) return { error: "Paciente no encontrado" };

  const evolution = await db.evolution.create({
    data: {
      patientId: patient.id,
      dentistId: user.id,
      reason: d.reason || null,
      diagnosisCode: d.diagnosisCode || null,
      procedureCode: d.procedureCode || null,
      note: d.note,
    },
  });
  await db.auditLog.create({
    data: { userId: user.id, action: "SIGN", entity: "Evolution", entityId: evolution.id },
  });
  revalidatePath(`/pacientes/${patient.id}`);
  return { ok: true };
}
