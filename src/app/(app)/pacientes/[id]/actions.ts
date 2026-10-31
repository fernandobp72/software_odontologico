"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { requireClinician, requireUser } from "@/lib/dal";
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

export type DeleteState = { error?: string } | undefined;

// Eliminación de un paciente de PRUEBA. La historia clínica real se conserva por ley (Res. 839 de 2017), así que exige
// confirmar que es de prueba y escribir su documento; solo el administrador, y queda en el registro de auditoría.
// Si tiene recibos o cuentas de cobro no se borra: el consecutivo de dinero no debe tener huecos.
export async function deleteTestPatient(patientId: string, _: DeleteState, fd: FormData): Promise<DeleteState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Solo el administrador puede eliminar pacientes de prueba" };
  const p = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId }, select: { id: true, documentNumber: true, _count: { select: { payments: true, invoices: true } } } });
  if (!p) return { error: "Paciente no encontrado" };
  if (fd.get("isTest") !== "on") return { error: "Marca la casilla que confirma que es un paciente de prueba" };
  if (String(fd.get("document") ?? "").trim() !== p.documentNumber) return { error: "Escribe el número de documento exacto para confirmar" };
  if (p._count.payments > 0 || p._count.invoices > 0) return { error: "Tiene recibos o cuentas de cobro emitidos, que deben conservarse. No se puede eliminar." };
  try {
    await db.$transaction([
      db.reminder.deleteMany({ where: { appointment: { patientId } } }),
      db.appointment.deleteMany({ where: { patientId } }),
      db.treatmentPlan.deleteMany({ where: { patientId } }),
      db.evolution.deleteMany({ where: { patientId } }),
      db.diagnosis.deleteMany({ where: { patientId } }),
      db.dismissedSuggestion.deleteMany({ where: { patientId } }),
      db.toothFinding.deleteMany({ where: { patientId } }),
      db.odontogramSnapshot.deleteMany({ where: { patientId } }),
      db.perioExam.deleteMany({ where: { patientId } }),
      db.prescription.deleteMany({ where: { patientId } }),
      db.assessment.deleteMany({ where: { patientId } }),
      db.consent.deleteMany({ where: { patientId } }),
      db.clinicalImage.deleteMany({ where: { patientId } }),
      db.intakeForm.deleteMany({ where: { patientId } }),
      db.patient.delete({ where: { id: patientId } }),
    ]);
  } catch {
    return { error: "Tiene registros asociados que impiden eliminarlo." };
  }
  await db.auditLog.create({ data: { userId: user.id, action: "PATIENT_DELETE_TEST", entity: "Patient", entityId: patientId, detail: "eliminó un paciente marcado como de prueba" } });
  revalidatePath("/pacientes");
  redirect("/pacientes");
}
