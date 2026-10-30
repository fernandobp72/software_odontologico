"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireClinician } from "@/lib/dal";
import { VALID_TEETH } from "@/lib/catalogs";
import { hasData, summarize, type Perio } from "@/lib/perio";

const site = z.object({
  pd: z.number().int().min(0).max(15).optional(),
  gm: z.number().int().min(-10).max(15).optional(),
  bop: z.boolean().optional(),
  plq: z.boolean().optional(),
});
const tooth = z.object({
  missing: z.boolean().optional(),
  mob: z.number().int().min(0).max(3).optional(),
  furc: z.number().int().min(0).max(3).optional(),
  sup: z.boolean().optional(),
  v: z.array(site).length(3),
  l: z.array(site).length(3),
});
const schema = z.record(z.string(), tooth).refine((d) => Object.keys(d).every((k) => VALID_TEETH.has(Number(k))), "Diente inválido");

export type PerioState = { error?: string; ok?: boolean };

export async function savePerio(patientId: string, input: unknown): Promise<PerioState> {
  const user = await requireClinician();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data: Perio = Object.fromEntries(Object.entries(parsed.data).filter(([, t]) => hasData(t)));
  if (!Object.keys(data).length) return { error: "No hay datos para guardar" };

  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId }, select: { id: true } });
  if (!patient) return { error: "Paciente no encontrado" };

  const row = await db.perioExam.create({ data: { patientId, authorId: user.id, data, summary: summarize(data) } });
  await db.auditLog.create({ data: { userId: user.id, action: "SIGN", entity: "PerioExam", entityId: row.id } });
  revalidatePath(`/pacientes/${patientId}/periodontograma`);
  return { ok: true };
}
