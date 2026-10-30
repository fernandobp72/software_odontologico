"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireClinician } from "@/lib/dal";
import { CONDITIONS, SURFACES, VALID_TEETH } from "@/lib/catalogs";

const findingSchema = z.object({
  patientId: z.string().min(1),
  tooth: z.number().int().refine((t) => VALID_TEETH.has(t), "Diente inválido"),
  surfaces: z.array(z.enum(SURFACES.map((s) => s.key) as [string, ...string[]])),
  condition: z.enum(Object.keys(CONDITIONS) as [keyof typeof CONDITIONS, ...(keyof typeof CONDITIONS)[]]),
});

export async function saveFinding(input: z.input<typeof findingSchema>): Promise<{ error?: string }> {
  const user = await requireClinician();
  const parsed = findingSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { patientId, tooth, surfaces, condition } = parsed.data;

  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId } });
  if (!patient) return { error: "Paciente no encontrado" };

  // Solo estos estados afectan todo el diente; el resto se marca por superficie.
  const targets: (string | null)[] = surfaces.length ? surfaces : [null];
  await db.toothFinding.createMany({
    data: targets.map((surface) => ({ patientId, tooth, surface, condition })),
  });
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
