import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { SOURCES, dateOnly } from "./finanzas";

type Tx = Prisma.TransactionClient;

export type NewExpense = {
  clinicId: string;
  branchId: string;
  userId: string;
  payeeName: string;
  category: string;
  amount: number;
  description: string | null;
  docKind?: string;
  docNumber?: string | null;
  expenseDate: string;
  // Pagado ya (con origen de la plata) o por pagar (con fecha límite).
  pay: { source: string; sessionId: string | null; reference: string | null } | { dueDate: string };
};

// Crea un gasto (y su pago, si ya se pagó) dentro de una transacción, con su consecutivo por consultorio.
// `after` corre en la misma transacción para ligar el gasto a lo que lo originó (liquidación, factura del laboratorio).
export async function createExpenseWith<T>(e: NewExpense, after: (tx: Tx, expenseId: string) => Promise<T>) {
  const payee = await db.payee.upsert({
    where: { clinicId_name: { clinicId: e.clinicId, name: e.payeeName } },
    create: { clinicId: e.clinicId, name: e.payeeName, defaultCategory: e.category },
    update: { active: true },
  });
  const paid = "source" in e.pay;
  for (let attempt = 0; ; attempt++) {
    try {
      return await db.$transaction(async (tx) => {
        const last = await tx.expense.aggregate({ _max: { number: true }, where: { clinicId: e.clinicId } });
        const x = await tx.expense.create({
          data: {
            clinicId: e.clinicId, branchId: e.branchId, number: (last._max.number ?? 0) + 1, payeeId: payee.id, category: e.category,
            description: e.description, amount: e.amount, docKind: e.docKind ?? "NONE", docNumber: e.docNumber ?? null,
            expenseDate: dateOnly(e.expenseDate), dueDate: "dueDate" in e.pay ? dateOnly(e.pay.dueDate) : null,
            settledAt: paid ? new Date() : null, createdById: e.userId,
          },
        });
        if ("source" in e.pay) await tx.expensePayment.create({ data: { clinicId: e.clinicId, expenseId: x.id, amount: e.amount, source: e.pay.source, sessionId: e.pay.sessionId, reference: e.pay.reference, paidById: e.userId } });
        await tx.auditLog.create({ data: { userId: e.userId, action: "EXPENSE", entity: "Expense", entityId: x.id } });
        const extra = await after(tx, x.id);
        return { expenseId: x.id, extra };
      });
    } catch (err) {
      // Dos gastos al mismo tiempo pueden pedir el mismo consecutivo: se reintenta.
      if (attempt >= 2 || (err as { code?: string }).code !== "P2002") throw err;
    }
  }
}

// Anula un gasto y sus pagos. No se puede si alguno salió de una caja ya cerrada (el arqueo de ese día quedó firmado).
export async function voidExpenseTx(tx: Tx, expenseId: string, userId: string, reason: string) {
  const now = new Date();
  await tx.expensePayment.updateMany({ where: { expenseId, voidedAt: null }, data: { voidedAt: now, voidedById: userId, voidReason: "Gasto anulado" } });
  await tx.expense.update({ where: { id: expenseId }, data: { voidedAt: now, voidedById: userId, voidReason: reason.slice(0, 200) } });
}

export async function paidFromClosedCash(expenseId: string) {
  const ps = await db.expensePayment.findMany({ where: { expenseId, voidedAt: null, sessionId: { not: null } }, select: { sessionId: true } });
  if (!ps.length) return false;
  return (await db.cashSession.count({ where: { id: { in: ps.map((p) => p.sessionId as string) }, closedAt: { not: null } } })) > 0;
}

export async function openSessionId(clinicId: string, branchId: string) {
  const s = await db.cashSession.findFirst({ where: { clinicId, branchId, closedAt: null }, select: { id: true } });
  return s?.id ?? null;
}

// Lee del formulario si ya se pagó (y de dónde salió la plata) o si queda por pagar (y hasta cuándo).
export async function payChoice(fd: FormData, ctx: { clinicId: string; branchId: string; branchName: string }, today: string): Promise<{ error: string } | { pay: NewExpense["pay"] }> {
  const status = fd.get("status");
  if (status === "OWED") {
    const due = String(fd.get("dueDate") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due < today) return { error: "Elige hasta cuándo hay plazo para pagar" };
    return { pay: { dueDate: due } };
  }
  const source = String(fd.get("source") ?? "");
  if (!(source in SOURCES)) return { error: "Elige de dónde salió la plata" };
  let sessionId: string | null = null;
  if (source === "CASH_BOX") {
    sessionId = await openSessionId(ctx.clinicId, ctx.branchId);
    if (!sessionId) return { error: `No hay caja abierta en la sede ${ctx.branchName}. Ábrela o elige otro origen de la plata.` };
  }
  const reference = String(fd.get("reference") ?? "").trim().slice(0, 60) || null;
  return { pay: { source, sessionId, reference } };
}
