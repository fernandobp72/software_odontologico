"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireClinician } from "@/lib/dal";
import { rxContextFor } from "@/lib/rx-context";
import { alertsFor, patientFlags } from "@/lib/rx-rules";
import { VADEMECUM_VERSION, drugById } from "@/lib/vademecum";

export type RxState = { error?: string; id?: string } | undefined;

const item = z.object({
  drugId: z.string().nullable(),
  name: z.string().trim().min(2, "Falta el nombre del medicamento").max(160),
  concentration: z.string().trim().min(1, "Falta la concentración").max(60),
  form: z.string().trim().min(1, "Falta la forma farmacéutica").max(60),
  route: z.string().trim().min(1, "Falta la vía de administración").max(60),
  dose: z.string().trim().min(1, "Falta la dosis").max(120),
  frequency: z.string().trim().min(1, "Falta la frecuencia").max(80),
  duration: z.string().trim().min(1, "Falta la duración").max(60),
  quantity: z.number().int().min(1, "La cantidad debe ser al menos 1").max(1000),
  quantityText: z.string().trim().min(1, "Falta la cantidad en letras").max(120),
  instructions: z.string().trim().max(500).optional(),
  override: z.string().trim().max(300).optional(),
});
const schema = z.object({
  diagnosisCode: z.string().trim().max(12).optional(),
  diagnosisText: z.string().trim().max(200).optional(),
  weightKg: z.number().min(1).max(300).nullable(),
  notes: z.string().trim().max(1000).optional(),
  items: z.array(item).min(1, "Agrega al menos un medicamento").max(15),
});

// La fórmula firmada no se edita. Las alertas se vuelven a calcular aquí con los antecedentes guardados:
// si hay una de bloqueo, solo se firma con un motivo escrito por el odontólogo.
export async function signPrescription(patientId: string, raw: unknown): Promise<RxState> {
  const user = await requireClinician();
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { licenseNumber: true } });
  if (!me.licenseNumber) return { error: "Registra tu registro profesional (RETHUS o tarjeta profesional) en «Mi cuenta» antes de firmar fórmulas." };

  const got = await rxContextFor(patientId, user.clinicId);
  if (!got) return { error: "Paciente no encontrado" };
  const flags = patientFlags(got.ctx);

  const items = d.items.map((it, i) => {
    const drug = it.drugId ? drugById(it.drugId) : undefined;
    const alerts = drug ? alertsFor(drug, flags) : [];
    return { it, i, alerts, blocked: alerts.some((a) => a.level === "stop") };
  });
  const missing = items.find((x) => x.blocked && !x.it.override);
  if (missing) return { error: `${missing.it.name}: tiene una alerta de bloqueo. Escribe el motivo por el que la formulas de todas formas, o quítalo.` };

  const rx = await db.$transaction(async (tx) => {
    const last = await tx.prescription.aggregate({ where: { clinicId: user.clinicId }, _max: { number: true } });
    return tx.prescription.create({
      data: {
        clinicId: user.clinicId, number: (last._max.number ?? 0) + 1, patientId, dentistId: user.id,
        diagnosisCode: d.diagnosisCode || null, diagnosisText: d.diagnosisText || null, weightKg: d.weightKg, notes: d.notes || null, vademecum: VADEMECUM_VERSION,
        items: {
          create: items.map(({ it, i, alerts }) => ({
            position: i, drugId: it.drugId, name: it.name, concentration: it.concentration, form: it.form, route: it.route, dose: it.dose,
            frequency: it.frequency, duration: it.duration, quantity: it.quantity, quantityText: it.quantityText, instructions: it.instructions || null,
            alerts: alerts.length ? alerts : undefined, override: it.override || null,
          })),
        },
      },
    });
  });
  await db.auditLog.create({ data: { userId: user.id, action: "SIGN", entity: "Prescription", entityId: rx.id } });
  revalidatePath(`/pacientes/${patientId}/formulas`);
  return { id: rx.id };
}

export async function voidPrescription(id: string, reason: string): Promise<RxState> {
  const user = await requireClinician();
  const why = reason.trim();
  if (why.length < 5) return { error: "Escribe el motivo de la anulación" };
  const rx = await db.prescription.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!rx) return { error: "Fórmula no encontrada" };
  if (rx.voidedAt) return { error: "Ya está anulada" };
  if (rx.dentistId !== user.id && user.role !== "ADMIN") return { error: "Solo quien la firmó o el administrador puede anularla" };
  await db.prescription.update({ where: { id }, data: { voidedAt: new Date(), voidedById: user.id, voidReason: why } });
  await db.auditLog.create({ data: { userId: user.id, action: "VOID", entity: "Prescription", entityId: id } });
  revalidatePath(`/pacientes/${rx.patientId}/formulas`);
  return {};
}
