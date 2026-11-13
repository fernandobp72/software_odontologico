"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBranch, requireUser } from "@/lib/dal";
import { sniff } from "@/lib/images";
import { expectedCash } from "@/lib/caja";
import { CATEGORY_KEYS, DOC_KEYS, MAX_SUPPORT, SOURCE_KEYS, dateOnly, isDateStr, isPeriodStr, paidOf, sourceLabel, sourcesFor, todayStr } from "@/lib/finanzas";
import { copFmt } from "@/lib/cartera";

export type ExpenseState = { error?: string; ok?: boolean; expenseId?: string; warning?: string } | undefined;
export type PayState = { error?: string; ok?: boolean } | undefined;

// Administración registra y paga todo; recepción solo registra gastos pagados con efectivo del consultorio.
async function requireFinance() {
  const ctx = await requireBranch();
  if (ctx.user.role === "DENTIST") throw new Error("Los gastos los registra administración o recepción");
  return ctx;
}

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Solo administración puede hacer esto");
  return user;
}

const money = z.coerce.number({ error: "Escribe el valor" }).int("Usa un valor entero en pesos").min(1, "El valor debe ser mayor a cero").max(500_000_000, "Valor demasiado alto");
const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const optDate = z.string().optional().transform((v) => v || null).refine((v) => v === null || isDateStr(v), "Fecha inválida");

const expenseSchema = z.object({
  payeeName: z.string().trim().min(2, "Escribe a quién le pagas").max(120),
  category: z.enum(CATEGORY_KEYS, { error: "Elige una categoría" }),
  amount: money,
  description: optText(200),
  expenseDate: z.string().refine(isDateStr, "Fecha inválida"),
  status: z.enum(["PAID", "OWED"]),
  source: z.enum(SOURCE_KEYS).optional(),
  reference: optText(60),
  dueDate: optDate,
  docKind: z.enum(DOC_KEYS).default("NONE"),
  docNumber: optText(40),
  repeat: z.string().optional(),
  recurringId: optText(40),
  period: optText(7),
});

function revalidateFinance() {
  for (const p of ["/finanzas", "/finanzas/gastos", "/finanzas/por-pagar", "/finanzas/a-quien-le-pago", "/finanzas/profesionales", "/finanzas/laboratorios", "/caja"]) revalidatePath(p);
}

async function openSessionId(clinicId: string, branchId: string) {
  const s = await db.cashSession.findFirst({ where: { clinicId, branchId, closedAt: null }, select: { id: true } });
  return s?.id ?? null;
}

export async function createExpense(_: ExpenseState, fd: FormData): Promise<ExpenseState> {
  const { user, branch } = await requireFinance();
  const parsed = expenseSchema.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const admin = user.role === "ADMIN";
  const today = todayStr();

  if (d.expenseDate > today) return { error: "La fecha del gasto no puede ser futura" };
  if (!admin && d.status !== "PAID") return { error: "Las deudas con proveedores las registra administración" };
  if (d.status === "PAID") {
    if (!d.source) return { error: "Elige de dónde salió la plata" };
    if (!sourcesFor(user.role).includes(d.source)) return { error: `Solo administración puede registrar pagos desde «${sourceLabel(d.source)}»` };
  }
  if (d.status === "OWED" && !d.dueDate) return { error: "Elige hasta cuándo hay plazo para pagar" };

  // Soporte (opcional): foto o PDF, se valida por sus primeros bytes.
  let file: { name: string; mime: string; data: Uint8Array<ArrayBuffer> } | null = null;
  const f = fd.get("file");
  if (f instanceof File && f.size > 0) {
    if (f.size > MAX_SUPPORT) return { error: "El soporte pesa más de 900 KB. Toma una foto en lugar del PDF o reduce el archivo." };
    const data = new Uint8Array(await f.arrayBuffer());
    const mime = sniff(data);
    if (!mime) return { error: "Formato no permitido (usa foto JPG, PNG, WebP o PDF)" };
    file = { name: f.name.slice(0, 120) || "soporte", mime, data };
  }

  let sessionId: string | null = null;
  if (d.status === "PAID" && d.source === "CASH_BOX") {
    sessionId = await openSessionId(user.clinicId, branch.id);
    if (!sessionId) return { error: `No hay caja abierta en la sede ${branch.name}. Ábrela o elige otro origen de la plata.` };
  }

  // Gasto que se repite: solo uno por mes.
  let recurring: { id: string; period: string } | null = null;
  if (d.recurringId && d.period && admin) {
    if (!isPeriodStr(d.period)) return { error: "Mes inválido" };
    const r = await db.recurringExpense.findFirst({ where: { id: d.recurringId, clinicId: user.clinicId }, select: { id: true } });
    if (!r) return { error: "Gasto que se repite no encontrado" };
    const dup = await db.expense.findFirst({ where: { recurringId: r.id, period: d.period, voidedAt: null }, select: { id: true } });
    if (dup) return { error: "Este gasto ya quedó registrado este mes" };
    recurring = { id: r.id, period: d.period };
  }

  const payee = await db.payee.upsert({
    where: { clinicId_name: { clinicId: user.clinicId, name: d.payeeName } },
    create: { clinicId: user.clinicId, name: d.payeeName, defaultCategory: d.category },
    update: { defaultCategory: d.category, active: true },
  });

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const last = await db.expense.aggregate({ _max: { number: true }, where: { clinicId: user.clinicId } });
      const e = await db.$transaction(async (tx) => {
        const e = await tx.expense.create({
          data: {
            clinicId: user.clinicId, branchId: branch.id, number: (last._max.number ?? 0) + 1, payeeId: payee.id,
            category: d.category, description: d.description, amount: d.amount, docKind: d.docKind, docNumber: d.docNumber,
            expenseDate: dateOnly(d.expenseDate), dueDate: d.status === "OWED" && d.dueDate ? dateOnly(d.dueDate) : null,
            fileName: file?.name ?? null, mimeType: file?.mime ?? null, data: file?.data ?? null,
            recurringId: recurring?.id ?? null, period: recurring?.period ?? null,
            settledAt: d.status === "PAID" ? new Date() : null, createdById: user.id,
          },
        });
        if (d.status === "PAID" && d.source) {
          await tx.expensePayment.create({ data: { clinicId: user.clinicId, expenseId: e.id, amount: d.amount, source: d.source, sessionId, reference: d.reference, paidById: user.id } });
        }
        if (admin && d.repeat === "on" && !recurring) {
          const day = Number((d.dueDate ?? d.expenseDate).slice(8));
          const r = await tx.recurringExpense.create({ data: { clinicId: user.clinicId, branchId: branch.id, payeeId: payee.id, category: d.category, description: d.description, amount: d.amount, dayOfMonth: day, createdById: user.id } });
          await tx.expense.update({ where: { id: e.id }, data: { recurringId: r.id, period: d.expenseDate.slice(0, 7) } });
        }
        await tx.auditLog.create({ data: { userId: user.id, action: "EXPENSE", entity: "Expense", entityId: e.id } });
        return e;
      });
      revalidateFinance();
      let warning: string | undefined;
      if (sessionId) {
        const left = await expectedCash(sessionId);
        if (left < 0) warning = `Según la caja, el efectivo esperado queda en ${copFmt.format(left)}. Revisa el valor o el origen de la plata.`;
      }
      return { ok: true, expenseId: e.id, warning };
    } catch (err) {
      if (attempt === 2) throw err;
    }
  }
  return { error: "No se pudo registrar el gasto" };
}

const paySchema = z.object({ amount: money, source: z.enum(SOURCE_KEYS, { error: "Elige de dónde salió la plata" }), reference: optText(60) });

// Pago total o abono a una deuda.
export async function payExpense(expenseId: string, _: PayState, fd: FormData): Promise<PayState> {
  const { user, branch } = await requireBranch();
  if (user.role !== "ADMIN") return { error: "Solo administración paga deudas" };
  const parsed = paySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const e = await db.expense.findFirst({ where: { id: expenseId, clinicId: user.clinicId, voidedAt: null }, include: { payments: true } });
  if (!e) return { error: "Gasto no encontrado o anulado" };
  const remaining = e.amount - paidOf(e.payments);
  if (remaining <= 0) return { error: "Este gasto ya está pagado" };
  if (d.amount > remaining) return { error: `El saldo es ${copFmt.format(remaining)}; no puedes pagar más que eso` };
  let sessionId: string | null = null;
  if (d.source === "CASH_BOX") {
    sessionId = await openSessionId(user.clinicId, branch.id);
    if (!sessionId) return { error: `No hay caja abierta en la sede ${branch.name}` };
  }
  await db.$transaction([
    db.expensePayment.create({ data: { clinicId: user.clinicId, expenseId: e.id, amount: d.amount, source: d.source, sessionId, reference: d.reference, paidById: user.id } }),
    ...(d.amount === remaining ? [db.expense.update({ where: { id: e.id }, data: { settledAt: new Date() } })] : []),
    db.auditLog.create({ data: { userId: user.id, action: "EXPENSE_PAY", entity: "Expense", entityId: e.id } }),
  ]);
  revalidateFinance();
  revalidatePath(`/finanzas/gastos/${e.id}`);
  return { ok: true };
}

// Un pago que salió de una caja ya cerrada no se puede deshacer: el arqueo de ese día ya quedó firmado.
async function closedCashIn(payments: { sessionId: string | null; voidedAt: Date | null }[]) {
  const ids = payments.filter((p) => p.sessionId && !p.voidedAt).map((p) => p.sessionId as string);
  if (!ids.length) return false;
  return (await db.cashSession.count({ where: { id: { in: ids }, closedAt: { not: null } } })) > 0;
}

export async function voidExpense(expenseId: string, _: PayState, fd: FormData): Promise<PayState> {
  const user = await requireAdmin();
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Escribe el motivo (mínimo 5 letras)" };
  const e = await db.expense.findFirst({ where: { id: expenseId, clinicId: user.clinicId, voidedAt: null }, include: { payments: true } });
  if (!e) return { error: "Gasto no encontrado o ya anulado" };
  if (await closedCashIn(e.payments)) return { error: "Se pagó con el efectivo de una caja que ya se cerró. Registra la corrección como un gasto nuevo o habla con tu contador." };
  const now = new Date();
  await db.$transaction([
    db.expensePayment.updateMany({ where: { expenseId: e.id, voidedAt: null }, data: { voidedAt: now, voidedById: user.id, voidReason: "Gasto anulado" } }),
    db.expense.update({ where: { id: e.id }, data: { voidedAt: now, voidedById: user.id, voidReason: reason.slice(0, 200) } }),
    // Si era la factura de un laboratorio, sus trabajos vuelven a quedar por facturar.
    db.labOrder.updateMany({ where: { expenseId: e.id }, data: { expenseId: null } }),
    // Si era la liquidación de un profesional, se anula con él: lo que cubría vuelve a quedar pendiente.
    db.proSettlement.updateMany({ where: { expenseId: e.id, voidedAt: null }, data: { voidedAt: now, voidedById: user.id, voidReason: `Gasto anulado: ${reason.slice(0, 180)}` } }),
    db.auditLog.create({ data: { userId: user.id, action: "EXPENSE_VOID", entity: "Expense", entityId: e.id } }),
  ]);
  revalidateFinance();
  revalidatePath(`/finanzas/gastos/${e.id}`);
  return { ok: true };
}

export async function voidExpensePayment(paymentId: string, _: PayState, fd: FormData): Promise<PayState> {
  const user = await requireAdmin();
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Escribe el motivo (mínimo 5 letras)" };
  const p = await db.expensePayment.findFirst({ where: { id: paymentId, clinicId: user.clinicId, voidedAt: null }, include: { expense: { select: { id: true, voidedAt: true } } } });
  if (!p || p.expense.voidedAt) return { error: "Pago no encontrado" };
  if (await closedCashIn([p])) return { error: "Este pago salió de una caja que ya se cerró y no se puede anular" };
  await db.$transaction([
    db.expensePayment.update({ where: { id: p.id }, data: { voidedAt: new Date(), voidedById: user.id, voidReason: reason.slice(0, 200) } }),
    db.expense.update({ where: { id: p.expense.id }, data: { settledAt: null } }),
    db.auditLog.create({ data: { userId: user.id, action: "EXPENSE_PAY_VOID", entity: "ExpensePayment", entityId: p.id } }),
  ]);
  revalidateFinance();
  revalidatePath(`/finanzas/gastos/${p.expense.id}`);
  return { ok: true };
}

export async function stopRecurring(recurringId: string): Promise<void> {
  const user = await requireAdmin();
  await db.recurringExpense.updateMany({ where: { id: recurringId, clinicId: user.clinicId }, data: { active: false } });
  await db.auditLog.create({ data: { userId: user.id, action: "RECURRING_STOP", entity: "RecurringExpense", entityId: recurringId } });
  revalidateFinance();
}

const payeeSchema = z.object({ document: optText(30), phone: optText(30), bank: optText(120), note: optText(200) });

export async function updatePayee(payeeId: string, _: PayState, fd: FormData): Promise<PayState> {
  const user = await requireAdmin();
  const parsed = payeeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const r = await db.payee.updateMany({ where: { id: payeeId, clinicId: user.clinicId }, data: parsed.data });
  if (!r.count) return { error: "No encontrado" };
  revalidatePath("/finanzas/a-quien-le-pago");
  return { ok: true };
}
