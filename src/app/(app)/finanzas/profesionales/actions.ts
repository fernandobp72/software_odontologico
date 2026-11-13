"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBranch, requireUser } from "@/lib/dal";
import { todayStr } from "@/lib/finanzas";
import { createExpenseWith, paidFromClosedCash, payChoice, voidExpenseTx } from "@/lib/finanzas-write";
import { proAccount } from "@/lib/pro-pay-data";
import { copFmt } from "@/lib/cartera";

export type ProState = { error?: string; ok?: boolean; settlementId?: string } | undefined;

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Solo administración puede hacer esto");
  return user;
}

function revalidatePro(userId?: string) {
  for (const p of ["/finanzas", "/finanzas/profesionales", "/finanzas/mis-pagos", "/finanzas/gastos", "/finanzas/por-pagar", "/caja"]) revalidatePath(p);
  if (userId) revalidatePath(`/finanzas/profesionales/${userId}`);
}

const agreementSchema = z.object({
  percent: z.coerce.number({ error: "Escribe el porcentaje" }).int("Usa un número entero").min(0, "Mínimo 0 %").max(100, "Máximo 100 %"),
  deductLab: z.string().optional(),
  note: z.string().trim().max(200).optional(),
});

export async function saveAgreement(userId: string, _: ProState, fd: FormData): Promise<ProState> {
  const user = await requireAdmin();
  const parsed = agreementSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const pro = await db.user.findFirst({ where: { id: userId, clinicId: user.clinicId }, select: { id: true } });
  if (!pro) return { error: "Profesional no encontrado" };
  const data = { percent: parsed.data.percent, deductLab: parsed.data.deductLab === "on", note: parsed.data.note || null, active: true };
  await db.proAgreement.upsert({ where: { userId }, create: { clinicId: user.clinicId, userId, ...data }, update: data });
  await db.auditLog.create({ data: { userId: user.id, action: "PRO_AGREEMENT", entity: "User", entityId: userId, detail: `${data.percent}%${data.deductLab ? " descontando laboratorio" : ""}` } });
  revalidatePro(userId);
  return { ok: true };
}

// Liquida lo que se le debe hoy al profesional, con ajustes opcionales (siempre con nota), y lo registra como gasto.
export async function settlePro(userId: string, _: ProState, fd: FormData): Promise<ProState> {
  const { user, branch } = await requireBranch();
  if (user.role !== "ADMIN") return { error: "Solo administración liquida pagos" };
  const pro = await db.user.findFirst({ where: { id: userId, clinicId: user.clinicId }, select: { id: true, name: true, proAgreement: true } });
  if (!pro?.proAgreement?.active) return { error: "Primero define el acuerdo de pago de este profesional" };
  const a = pro.proAgreement;

  // Ajustes: valor (positivo suma, negativo resta) y nota obligatoria.
  const amounts = fd.getAll("adjAmount").map((v) => String(v).trim());
  const notes = fd.getAll("adjNote").map((v) => String(v).trim());
  const adjustments: { amount: number; note: string }[] = [];
  for (let i = 0; i < amounts.length; i++) {
    if (!amounts[i]) continue;
    const n = Number(amounts[i]);
    if (!Number.isInteger(n) || n === 0 || Math.abs(n) > 100_000_000) return { error: "Revisa el valor del ajuste (entero, en pesos)" };
    if ((notes[i] ?? "").length < 5) return { error: "Cada ajuste necesita una nota que explique por qué (mínimo 5 letras)" };
    adjustments.push({ amount: n, note: notes[i].slice(0, 200) });
  }
  const retention = Math.max(0, Math.round(Number(fd.get("retention") || 0)));
  if (!Number.isFinite(retention)) return { error: "Revisa la retención" };
  const docKind = ["FACTURA", "DOC_SOPORTE", "CUENTA_COBRO"].includes(String(fd.get("docKind"))) ? String(fd.get("docKind")) : "NONE";
  const docNumber = String(fd.get("docNumber") ?? "").trim().slice(0, 40) || null;

  const today = todayStr();
  const choice = await payChoice(fd, { clinicId: user.clinicId, branchId: branch.id, branchName: branch.name }, today);
  if ("error" in choice) return choice;

  const { lines } = await proAccount(user.clinicId, userId, a);
  const toPay = lines.filter((l) => l.due !== 0);
  const total = toPay.reduce((s, l) => s + l.due, 0) + adjustments.reduce((s, x) => s + x.amount, 0);
  if (total <= 0) return { error: "No hay saldo a favor del profesional para liquidar" };
  if (retention >= total) return { error: "La retención no puede ser igual o mayor al total" };
  // Si alguien liquidó mientras tanto, el total habrá cambiado: se compara con el que vio la persona.
  if (Number(fd.get("expectedTotal")) !== total - adjustments.reduce((s, x) => s + x.amount, 0)) return { error: "La cuenta cambió mientras la revisabas. Recarga la página y vuelve a liquidar." };

  const net = total - retention;
  const { extra: settlementId } = await createExpenseWith(
    {
      clinicId: user.clinicId, branchId: branch.id, userId: user.id, payeeName: pro.name, category: "HONORARIOS", amount: net,
      description: `Liquidación de ${pro.name}${retention ? ` · retención sugerida ${copFmt.format(retention)} (revísala con tu contador)` : ""}`.slice(0, 200),
      docKind, docNumber, expenseDate: today, pay: choice.pay,
    },
    async (tx, expenseId) => {
      const last = await tx.proSettlement.aggregate({ _max: { number: true }, where: { clinicId: user.clinicId } });
      const s = await tx.proSettlement.create({
        data: {
          clinicId: user.clinicId, number: (last._max.number ?? 0) + 1, userId, percent: a.percent, deductLab: a.deductLab, total, retention, expenseId, createdById: user.id,
          lines: {
            create: [
              ...toPay.map((l) => ({ itemId: l.itemId, patientName: l.patientName, description: l.description, doneAt: l.doneAt, price: l.price, collected: l.collected, lab: l.lab, earned: l.earned, amount: l.due, note: l.due < 0 ? "Devolución o pago anulado del paciente" : null })),
              ...adjustments.map((x) => ({ patientName: "", description: "Ajuste", amount: x.amount, note: x.note })),
            ],
          },
        },
      });
      await tx.auditLog.create({ data: { userId: user.id, action: "PRO_SETTLE", entity: "ProSettlement", entityId: s.id, detail: `${pro.name} ${total}` } });
      return s.id;
    },
  );
  revalidatePro(userId);
  return { ok: true, settlementId };
}

export async function voidSettlement(id: string, _: ProState, fd: FormData): Promise<ProState> {
  const user = await requireAdmin();
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Escribe el motivo (mínimo 5 letras)" };
  const s = await db.proSettlement.findFirst({ where: { id, clinicId: user.clinicId, voidedAt: null } });
  if (!s) return { error: "Liquidación no encontrada o ya anulada" };
  if (s.expenseId && (await paidFromClosedCash(s.expenseId))) return { error: "Se pagó con el efectivo de una caja que ya se cerró. Registra la corrección como un ajuste en la próxima liquidación." };
  await db.$transaction(async (tx) => {
    if (s.expenseId) await voidExpenseTx(tx, s.expenseId, user.id, `Liquidación anulada: ${reason}`);
    await tx.proSettlement.update({ where: { id }, data: { voidedAt: new Date(), voidedById: user.id, voidReason: reason.slice(0, 200) } });
    await tx.auditLog.create({ data: { userId: user.id, action: "PRO_SETTLE_VOID", entity: "ProSettlement", entityId: id } });
  });
  revalidatePro(s.userId);
  revalidatePath(`/finanzas/profesionales/liquidacion/${id}`);
  return { ok: true };
}
