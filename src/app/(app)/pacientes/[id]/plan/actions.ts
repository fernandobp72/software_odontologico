"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireClinician } from "@/lib/dal";
import { syncPlan } from "@/lib/plan";
import { applySuggestions } from "@/lib/suggest-apply";
import { CIE10, VALID_TEETH, SURFACES } from "@/lib/catalogs";
import { defaultMaterial, type CatalogMaterial } from "@/lib/catalog";

const toMaterials = (v: unknown): CatalogMaterial[] => (Array.isArray(v) ? (v as CatalogMaterial[]).filter((m) => m && typeof m.name === "string") : []);

export type FormState = { error?: string; ok?: boolean } | undefined;

async function ownPatient(patientId: string, clinicId: string) {
  return db.patient.findFirst({ where: { id: patientId, clinicId }, select: { id: true } });
}

async function audit(userId: string, action: string, entity: string, entityId: string) {
  await db.auditLog.create({ data: { userId, action, entity, entityId } });
}

const toothField = z.preprocess((v) => (v === "" || v == null ? null : Number(v)), z.number().int().refine((t) => VALID_TEETH.has(t), "Diente inválido").nullable());

// ---- Diagnósticos ----
const diagnosisSchema = z.object({ code: z.string().regex(/^[A-Z]\d{2}(\.\d{1,2})?$/, "Código CIE-10 inválido"), tooth: toothField });

export async function addDiagnosis(patientId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireClinician();
  if (!(await ownPatient(patientId, user.clinicId))) return { error: "Paciente no encontrado" };
  const parsed = diagnosisSchema.safeParse({ code: String(fd.get("code") ?? "").trim().toUpperCase(), tooth: fd.get("tooth") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const known = CIE10.find((c) => c.code === parsed.data.code);
  const description = known?.label ?? String(fd.get("description") ?? "").trim();
  if (!description) return { error: "Código fuera del catálogo: escribe la descripción" };
  const d = await db.diagnosis.create({ data: { patientId, dentistId: user.id, code: parsed.data.code, description, tooth: parsed.data.tooth } });
  await audit(user.id, "CREATE", "Diagnosis", d.id);
  revalidatePath(`/pacientes/${patientId}/plan`);
  return { ok: true };
}

export async function resolveDiagnosis(id: string) {
  const user = await requireClinician();
  const d = await db.diagnosis.findFirst({ where: { id, patient: { clinicId: user.clinicId } } });
  if (!d) return;
  await db.diagnosis.update({ where: { id }, data: { status: "RESOLVED", resolvedAt: new Date() } });
  await audit(user.id, "RESOLVE", "Diagnosis", id);
  revalidatePath(`/pacientes/${d.patientId}/plan`);
}

// ---- Plan de tratamiento ----
export async function createPlan(patientId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireClinician();
  if (!(await ownPatient(patientId, user.clinicId))) return { error: "Paciente no encontrado" };
  const title = String(fd.get("title") ?? "").trim() || "Plan de tratamiento";
  const plan = await db.treatmentPlan.create({ data: { patientId, dentistId: user.id, title: title.slice(0, 120) } });
  await audit(user.id, "CREATE", "TreatmentPlan", plan.id);
  revalidatePath(`/pacientes/${patientId}/plan`);
  return { ok: true };
}

const itemSchema = z.object({
  planId: z.string().min(1),
  procedure: z.string().min(1, "Elige un procedimiento"),
  phase: z.coerce.number().int().min(1).max(4),
  tooth: toothField,
  quantity: z.coerce.number().int().min(1).max(32).default(1),
  unitPrice: z.coerce.number().int().min(0).max(100_000_000).default(0),
  notes: z.string().trim().max(500).optional(),
  customName: z.string().trim().max(160).optional(),
});

export async function addItem(patientId: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireClinician();
  const parsed = itemSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const plan = await db.treatmentPlan.findFirst({ where: { id: d.planId, patientId, patient: { clinicId: user.clinicId } } });
  if (!plan) return { error: "Plan no encontrado" };
  if (plan.status === "COMPLETED" || plan.status === "CANCELLED") return { error: "El plan está cerrado" };
  const entry = await db.clinicProcedure.findFirst({ where: { clinicId: user.clinicId, procId: d.procedure, active: true } });
  if (!entry) return { error: "Ese procedimiento no está activo en el catálogo del consultorio" };
  const name = entry.procId === "otro" ? d.customName : entry.name;
  if (!name) return { error: "Describe el procedimiento" };
  const surfaces = fd.getAll("surfaces").map(String).filter((s) => SURFACES.some((x) => x.key === s)).join("") || null;
  const mats = toMaterials(entry.materials);
  const wanted = String(fd.get("material") ?? "");
  const material = mats.some((m) => m.name === wanted) ? wanted : defaultMaterial({ materials: mats });

  const item = await db.treatmentItem.create({
    data: { planId: plan.id, phase: d.phase, tooth: d.tooth, surfaces, procedureCode: entry.cups, name, material, quantity: d.quantity, unitPrice: d.unitPrice, notes: d.notes || null },
  });
  await audit(user.id, "CREATE", "TreatmentItem", item.id);
  revalidatePath(`/pacientes/${patientId}/plan`);
  return { ok: true };
}

export async function setItemStatus(itemId: string, status: "PLANNED" | "IN_PROGRESS" | "DONE" | "CANCELLED") {
  const user = await requireClinician();
  const item = await db.treatmentItem.findFirst({ where: { id: itemId, plan: { patient: { clinicId: user.clinicId } } }, include: { plan: true } });
  if (!item) return;
  await db.treatmentItem.update({
    where: { id: itemId },
    data: { status, doneAt: status === "DONE" ? new Date() : null, doneById: status === "DONE" ? user.id : null },
  });
  await audit(user.id, `ITEM_${status}`, "TreatmentItem", itemId);
  await syncPlan(item.planId);
  revalidatePath(`/pacientes/${item.plan.patientId}/plan`);
  revalidatePath(`/pacientes/${item.plan.patientId}`);
}

export async function setPlanStatus(planId: string, status: "PRESENTED" | "ACCEPTED" | "CANCELLED") {
  const user = await requireClinician();
  const plan = await db.treatmentPlan.findFirst({ where: { id: planId, patient: { clinicId: user.clinicId } } });
  if (!plan) return;
  await db.treatmentPlan.update({
    where: { id: planId },
    data: { status, presentedAt: status === "PRESENTED" ? new Date() : plan.presentedAt, acceptedAt: status === "ACCEPTED" ? new Date() : plan.acceptedAt },
  });
  await audit(user.id, `PLAN_${status}`, "TreatmentPlan", planId);
  if (status === "ACCEPTED") await syncPlan(planId);
  revalidatePath(`/pacientes/${plan.patientId}/plan`);
}

// ---- Sugerencias automáticas a partir de los hallazgos ----
export async function generateFromFindings(patientId: string, auto: boolean): Promise<{ diagnoses?: number; items?: number; error?: string }> {
  const user = await requireClinician();
  if (!(await ownPatient(patientId, user.clinicId))) return { error: "Paciente no encontrado" };
  const r = await applySuggestions({ patientId, clinicId: user.clinicId, userId: user.id, auto });
  if (r.diagnoses || r.items) await audit(user.id, auto ? "AUTO_PLAN" : "SYNC_PLAN", "Patient", patientId);
  revalidatePath(`/pacientes/${patientId}/plan`);
  revalidatePath(`/pacientes/${patientId}`);
  return r;
}

// ---- Editar y eliminar ----
export async function updateDiagnosis(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireClinician();
  const parsed = diagnosisSchema.safeParse({ code: String(fd.get("code") ?? "").trim().toUpperCase(), tooth: fd.get("tooth") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = await db.diagnosis.findFirst({ where: { id, patient: { clinicId: user.clinicId } } });
  if (!d) return { error: "Diagnóstico no encontrado" };
  const known = CIE10.find((c) => c.code === parsed.data.code);
  const description = known?.label ?? String(fd.get("description") ?? "").trim();
  if (!description) return { error: "Código fuera del catálogo: escribe la descripción" };
  await db.diagnosis.update({ where: { id }, data: { code: parsed.data.code, description, tooth: parsed.data.tooth, note: String(fd.get("note") ?? "").trim().slice(0, 300) || null } });
  await audit(user.id, "UPDATE", "Diagnosis", id);
  revalidatePath(`/pacientes/${d.patientId}/plan`);
  return { ok: true };
}

export async function deleteDiagnosis(id: string): Promise<void> {
  const user = await requireClinician();
  const d = await db.diagnosis.findFirst({ where: { id, patient: { clinicId: user.clinicId } } });
  if (!d) return;
  if (d.sourceKey) await db.dismissedSuggestion.upsert({ where: { patientId_key: { patientId: d.patientId, key: d.sourceKey } }, update: {}, create: { patientId: d.patientId, key: d.sourceKey } });
  await db.diagnosis.delete({ where: { id } });
  await audit(user.id, `DELETE ${d.code}`, "Diagnosis", id);
  revalidatePath(`/pacientes/${d.patientId}/plan`);
}

const itemEditSchema = z.object({
  name: z.string().trim().min(2, "Escribe el procedimiento").max(160),
  phase: z.coerce.number().int().min(1).max(4),
  tooth: toothField,
  quantity: z.coerce.number().int().min(1).max(32),
  unitPrice: z.coerce.number().int().min(0).max(100_000_000),
  notes: z.string().trim().max(500).optional(),
});

export async function updateItem(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const user = await requireClinician();
  const parsed = itemEditSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const item = await db.treatmentItem.findFirst({ where: { id, plan: { patient: { clinicId: user.clinicId } } }, include: { plan: true } });
  if (!item) return { error: "Procedimiento no encontrado" };
  if (item.status === "DONE" || item.status === "CANCELLED") return { error: "Un procedimiento realizado o cancelado ya no se edita" };
  const surfaces = fd.getAll("surfaces").map(String).filter((s) => SURFACES.some((x) => x.key === s)).join("") || null;
  // Si eligió otro procedimiento del catálogo del consultorio (p. ej. al definir una restauración), cambia nombre y código.
  const chosen = String(fd.get("procedure") ?? "");
  const entry = chosen && chosen !== "otro" ? await db.clinicProcedure.findFirst({ where: { clinicId: user.clinicId, procId: chosen, active: true } }) : null;
  const wanted = String(fd.get("material") ?? "").trim().slice(0, 60);
  const mats = entry ? toMaterials(entry.materials) : [];
  const material = entry ? (mats.some((m) => m.name === wanted) ? wanted : defaultMaterial({ materials: mats })) : wanted || null;
  await db.treatmentItem.update({
    where: { id },
    data: { ...parsed.data, ...(entry ? { name: entry.name, procedureCode: entry.cups } : {}), material, surfaces, notes: parsed.data.notes || null },
  });
  await audit(user.id, "UPDATE", "TreatmentItem", id);
  revalidatePath(`/pacientes/${item.plan.patientId}/plan`);
  return { ok: true };
}

export async function deleteItem(id: string): Promise<void> {
  const user = await requireClinician();
  const item = await db.treatmentItem.findFirst({ where: { id, plan: { patient: { clinicId: user.clinicId } } }, include: { plan: true } });
  if (!item || item.status === "DONE") return; // lo realizado queda en la historia; solo se puede cancelar lo pendiente
  if (item.sourceKey) await db.dismissedSuggestion.upsert({ where: { patientId_key: { patientId: item.plan.patientId, key: item.sourceKey } }, update: {}, create: { patientId: item.plan.patientId, key: item.sourceKey } });
  await db.treatmentItem.delete({ where: { id } });
  await audit(user.id, `DELETE ${item.name}`.slice(0, 80), "TreatmentItem", id);
  await syncPlan(item.planId);
  revalidatePath(`/pacientes/${item.plan.patientId}/plan`);
  revalidatePath(`/pacientes/${item.plan.patientId}`);
}

// Solo se elimina un plan que no se haya aceptado ni tenga procedimientos realizados.
export async function deletePlan(planId: string): Promise<void> {
  const user = await requireClinician();
  const plan = await db.treatmentPlan.findFirst({ where: { id: planId, patient: { clinicId: user.clinicId } }, include: { items: true } });
  if (!plan || !["DRAFT", "PRESENTED"].includes(plan.status) || plan.items.some((i) => i.status === "DONE")) return;
  const keys = plan.items.map((i) => i.sourceKey).filter((k): k is string => !!k);
  await db.$transaction([
    ...(keys.length ? [db.dismissedSuggestion.createMany({ data: keys.map((key) => ({ patientId: plan.patientId, key })), skipDuplicates: true })] : []),
    db.treatmentPlan.delete({ where: { id: planId } }),
  ]);
  await audit(user.id, "DELETE_PLAN", "TreatmentPlan", planId);
  revalidatePath(`/pacientes/${plan.patientId}/plan`);
  revalidatePath(`/pacientes/${plan.patientId}`);
}
