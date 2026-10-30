import { db } from "./db";
import { CIE10, PROCEDURES } from "./catalogs";
import { suggestAll, type FindingLite, type Suggestions } from "./suggest";
import type { Perio } from "./perio";

// Estado actual del odontograma: el último registro por diente y superficie, sin los sanos.
export async function currentFindings(patientId: string): Promise<FindingLite[]> {
  const all = await db.toothFinding.findMany({ where: { patientId }, orderBy: { createdAt: "asc" } });
  const latest = new Map<string, FindingLite>();
  for (const f of all) latest.set(`${f.tooth}|${f.surface ?? ""}`, { tooth: f.tooth, surface: f.surface, condition: f.condition });
  return [...latest.values()].filter((f) => f.condition !== "HEALTHY");
}

export async function latestPerio(patientId: string): Promise<Perio | null> {
  const row = await db.perioExam.findFirst({ where: { patientId }, orderBy: { createdAt: "desc" }, select: { data: true } });
  return (row?.data as unknown as Perio) ?? null;
}

// Sugerencias que todavía no se han agregado ni descartado.
export async function pendingSuggestions(patientId: string): Promise<Suggestions> {
  const [findings, perio, dx, items, dismissed] = await Promise.all([
    currentFindings(patientId),
    latestPerio(patientId),
    db.diagnosis.findMany({ where: { patientId, sourceKey: { not: null } }, select: { sourceKey: true } }),
    db.treatmentItem.findMany({ where: { plan: { patientId }, sourceKey: { not: null } }, select: { sourceKey: true } }),
    db.dismissedSuggestion.findMany({ where: { patientId }, select: { key: true } }),
  ]);
  const skip = new Set([...dx.map((d) => d.sourceKey), ...items.map((i) => i.sourceKey), ...dismissed.map((d) => d.key)]);
  const all = suggestAll(findings, perio);
  return { diagnoses: all.diagnoses.filter((d) => !skip.has(d.key)), items: all.items.filter((i) => !skip.has(i.key)) };
}

// Último valor unitario usado en el consultorio para el mismo procedimiento (tarifa por defecto).
async function lastPrice(clinicId: string, code: string | null, name: string) {
  const prev = await db.treatmentItem.findFirst({
    where: { unitPrice: { gt: 0 }, plan: { patient: { clinicId } }, ...(code ? { procedureCode: code } : { name }) },
    orderBy: { createdAt: "desc" },
    select: { unitPrice: true },
  });
  return prev?.unitPrice ?? 0;
}

export async function applySuggestions(opts: { patientId: string; clinicId: string; userId: string; auto: boolean }) {
  const pending = await pendingSuggestions(opts.patientId);
  let planId: string | null = null;

  if (pending.items.length) {
    // Las sugerencias nuevas van a un borrador: nunca cambian un presupuesto ya presentado o aceptado.
    const draft = await db.treatmentPlan.findFirst({ where: { patientId: opts.patientId, status: "DRAFT" }, orderBy: { createdAt: "desc" } });
    planId = draft?.id ?? (await db.treatmentPlan.create({ data: { patientId: opts.patientId, dentistId: opts.userId, title: "Plan sugerido por los hallazgos" } })).id;
  }

  const itemRows = [];
  for (const s of pending.items) {
    const proc = PROCEDURES.find((p) => p.id === s.procId);
    if (!proc) continue;
    itemRows.push({
      planId: planId as string, phase: s.phase, tooth: s.tooth, surfaces: s.surfaces || null, procedureCode: proc.cups, name: proc.name,
      quantity: s.quantity, unitPrice: await lastPrice(opts.clinicId, proc.cups, proc.name), notes: s.note, sourceKey: s.key,
    });
  }

  await db.$transaction([
    db.diagnosis.createMany({
      data: pending.diagnoses.map((d) => ({
        patientId: opts.patientId, dentistId: opts.userId, code: d.code, description: CIE10.find((c) => c.code === d.code)?.label ?? d.code,
        tooth: d.tooth, note: d.note, sourceKey: d.key,
      })),
    }),
    ...(itemRows.length ? [db.treatmentItem.createMany({ data: itemRows })] : []),
    ...(opts.auto ? [db.patient.update({ where: { id: opts.patientId }, data: { autoPlanAt: new Date() } })] : []),
  ]);
  return { diagnoses: pending.diagnoses.length, items: itemRows.length };
}
