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

// Cifras configurables del consultorio (se crean con los valores de referencia la primera vez).
export async function financeSettings(clinicId: string) {
  return (await db.financeSettings.findUnique({ where: { clinicId } })) ?? { clinicId, minWage: 1_750_905, transportAid: 249_095, retHonorarios: 11, retServicios: 4, retCompras: 2.5, applyRetention: false, accountantName: null, accountantEmail: null, updatedAt: new Date(0) };
}
