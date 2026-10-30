"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireClinician } from "@/lib/dal";
import { CONDITIONS, SURFACES, VALID_TEETH } from "@/lib/catalogs";
import { syncPlan } from "@/lib/plan";

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

// Foto fija del estado actual como odontograma inicial. Solo se puede hacer una vez.
export async function saveInitialSnapshot(patientId: string): Promise<{ error?: string }> {
  const user = await requireClinician();
  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId }, select: { id: true } });
  if (!patient) return { error: "Paciente no encontrado" };
  const all = await db.toothFinding.findMany({ where: { patientId }, orderBy: { createdAt: "asc" } });
  const latest = new Map<string, { tooth: number; surface: string | null; condition: string }>();
  for (const f of all) latest.set(`${f.tooth}|${f.surface ?? ""}`, { tooth: f.tooth, surface: f.surface, condition: f.condition });
  const data = [...latest.values()].filter((f) => f.condition !== "HEALTHY");
  try {
    const snap = await db.odontogramSnapshot.create({ data: { patientId, authorId: user.id, kind: "INITIAL", data } });
    await db.auditLog.create({ data: { userId: user.id, action: "SNAPSHOT", entity: "OdontogramSnapshot", entityId: snap.id } });
  } catch {
    return { error: "El odontograma inicial ya fue fijado" };
  }
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

  // Los ítems del plan marcados se cierran junto con la evolución, en una sola transacción.
  const itemIds = formData.getAll("doneItems").map(String);
  const items = itemIds.length
    ? await db.treatmentItem.findMany({
        where: { id: { in: itemIds }, status: { in: ["PLANNED", "IN_PROGRESS"] }, plan: { patientId: patient.id } },
        select: { id: true, planId: true },
      })
    : [];

  const evolution = await db.$transaction(async (tx) => {
    const ev = await tx.evolution.create({
      data: {
        patientId: patient.id,
        dentistId: user.id,
        reason: d.reason || null,
        diagnosisCode: d.diagnosisCode || null,
        procedureCode: d.procedureCode || null,
        note: d.note,
      },
    });
    if (items.length) {
      await tx.treatmentItem.updateMany({
        where: { id: { in: items.map((i) => i.id) } },
        data: { status: "DONE", doneAt: new Date(), doneById: user.id, evolutionId: ev.id },
      });
    }
    return ev;
  });
  for (const planId of new Set(items.map((i) => i.planId))) await syncPlan(planId);
  await db.auditLog.create({
    data: { userId: user.id, action: "SIGN", entity: "Evolution", entityId: evolution.id },
  });
  revalidatePath(`/pacientes/${patient.id}`);
  revalidatePath(`/pacientes/${patient.id}/plan`);
  return { ok: true };
}
