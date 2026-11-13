import "server-only";
import { db } from "./db";
import { dueInMonth, paidOf } from "./finanzas";

// Deudas vigentes del consultorio (gastos sin pagar del todo), con su saldo, ordenadas por vencimiento.
export async function openDebts(clinicId: string) {
  const rows = await db.expense.findMany({
    where: { clinicId, voidedAt: null, settledAt: null },
    select: { id: true, number: true, amount: true, category: true, description: true, dueDate: true, expenseDate: true, payee: { select: { id: true, name: true } }, payments: { select: { amount: true, voidedAt: true } } },
  });
  return rows
    .map(({ payments, ...e }) => ({ ...e, remaining: e.amount - paidOf(payments) }))
    .filter((e) => e.remaining > 0)
    .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) || a.number - b.number);
}

// Gastos que se repiten y todavía no se han registrado en el mes.
export async function pendingRecurring(clinicId: string, period: string) {
  const list = await db.recurringExpense.findMany({ where: { clinicId, active: true }, include: { payee: { select: { name: true } } }, orderBy: { dayOfMonth: "asc" } });
  if (!list.length) return [];
  const done = await db.expense.findMany({ where: { recurringId: { in: list.map((r) => r.id) }, period, voidedAt: null }, select: { recurringId: true } });
  const has = new Set(done.map((d) => d.recurringId));
  return list
    .filter((r) => !has.has(r.id))
    .map((r) => ({ id: r.id, payee: r.payee.name, category: r.category, amount: r.amount, description: r.description, dueDate: dueInMonth(period, r.dayOfMonth) }));
}
