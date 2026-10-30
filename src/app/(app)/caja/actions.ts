"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";

export type CashState = { error?: string; ok?: boolean; receiptId?: string } | undefined;

async function requireManager() {
  const user = await requireUser();
  if (user.role === "DENTIST") throw new Error("Solo administración o recepción pueden abrir y cerrar caja");
  return user;
}

const money = z.coerce.number().int("Usa un valor entero en pesos").min(0).max(100_000_000);

export async function openSession(_: CashState, fd: FormData): Promise<CashState> {
  const user = await requireManager();
  const amount = money.safeParse(fd.get("openingAmount") || 0);
  if (!amount.success) return { error: "Valor inicial inválido" };
  const open = await db.cashSession.findFirst({ where: { clinicId: user.clinicId, closedAt: null } });
  if (open) return { error: "Ya hay una caja abierta" };
  const s = await db.cashSession.create({ data: { clinicId: user.clinicId, openedById: user.id, openingAmount: amount.data } });
  await db.auditLog.create({ data: { userId: user.id, action: "CASH_OPEN", entity: "CashSession", entityId: s.id } });
  revalidatePath("/caja");
  return { ok: true };
}

export async function closeSession(sessionId: string, _: CashState, fd: FormData): Promise<CashState> {
  const user = await requireManager();
  const counted = money.safeParse(fd.get("countedCash"));
  if (!counted.success) return { error: "Escribe el efectivo contado" };
  const session = await db.cashSession.findFirst({ where: { id: sessionId, clinicId: user.clinicId, closedAt: null } });
  if (!session) return { error: "La caja ya está cerrada" };
  const cash = await db.payment.aggregate({ _sum: { amount: true }, where: { sessionId, method: "CASH", voidedAt: null } });
  const expected = session.openingAmount + (cash._sum.amount ?? 0);
  await db.cashSession.update({
    where: { id: sessionId },
    data: {
      closedAt: new Date(),
      closedById: user.id,
      countedCash: counted.data,
      expectedCash: expected,
      difference: counted.data - expected,
      note: String(fd.get("note") ?? "").trim().slice(0, 300) || null,
    },
  });
  await db.auditLog.create({ data: { userId: user.id, action: "CASH_CLOSE", entity: "CashSession", entityId: sessionId } });
  revalidatePath("/caja");
  return { ok: true };
}

const paymentSchema = z.object({
  patientId: z.string().min(1, "Elige un paciente"),
  amount: z.coerce.number().int("Usa un valor entero en pesos").min(1, "El valor debe ser mayor a cero").max(100_000_000),
  method: z.enum(["CASH", "CARD", "TRANSFER", "WALLET", "OTHER"]),
  reference: z.string().trim().max(60).optional(),
  note: z.string().trim().max(200).optional(),
});

export async function registerPayment(_: CashState, fd: FormData): Promise<CashState> {
  const user = await requireUser();
  const parsed = paymentSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const patient = await db.patient.findFirst({ where: { id: d.patientId, clinicId: user.clinicId }, select: { id: true } });
  if (!patient) return { error: "Paciente no encontrado" };
  const session = await db.cashSession.findFirst({ where: { clinicId: user.clinicId, closedAt: null } });
  if (!session) return { error: "No hay caja abierta. Pide a recepción o administración que la abra." };

  // Consecutivo por consultorio; si dos cobros chocan, se reintenta.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const last = await db.payment.aggregate({ _max: { number: true }, where: { clinicId: user.clinicId } });
      const p = await db.payment.create({
        data: {
          clinicId: user.clinicId, number: (last._max.number ?? 0) + 1, patientId: patient.id, sessionId: session.id,
          amount: d.amount, method: d.method, reference: d.reference || null, note: d.note || null, receivedById: user.id,
        },
      });
      await db.auditLog.create({ data: { userId: user.id, action: "PAYMENT", entity: "Payment", entityId: p.id } });
      revalidatePath("/caja");
      revalidatePath("/cartera");
      revalidatePath(`/pacientes/${patient.id}/cuenta`);
      return { ok: true, receiptId: p.id };
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  return { error: "No se pudo registrar el pago" };
}

// Anular un pago (solo administración, y solo mientras su caja siga abierta).
export async function voidPayment(paymentId: string, fd: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Solo administración puede anular pagos");
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 5) return;
  const p = await db.payment.findFirst({ where: { id: paymentId, clinicId: user.clinicId, voidedAt: null }, include: { session: true } });
  if (!p || p.session.closedAt) return;
  await db.payment.update({ where: { id: paymentId }, data: { voidedAt: new Date(), voidedById: user.id, voidReason: reason.slice(0, 200) } });
  await db.auditLog.create({ data: { userId: user.id, action: "PAYMENT_VOID", entity: "Payment", entityId: paymentId } });
  revalidatePath("/caja");
  revalidatePath("/cartera");
  revalidatePath(`/pacientes/${p.patientId}/cuenta`);
}
