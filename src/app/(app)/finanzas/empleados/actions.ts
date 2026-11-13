"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBranch, requireUser } from "@/lib/dal";
import { SOURCE_KEYS, dateOnly, isDateStr, todayStr } from "@/lib/finanzas";
import { openSessionId, paidFromClosedCash } from "@/lib/finanzas-write";
import { financeSettings } from "@/lib/finanzas-data";
import { CONTRACT_KEYS, NOVELTIES, NOVELTY_KEYS, periodInfo, suggestPay } from "@/lib/empleados";

export type EmpState = { error?: string; ok?: boolean; id?: string } | undefined;

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Solo administración puede hacer esto");
  return user;
}

function revalidateEmp(id?: string) {
  for (const p of ["/finanzas", "/finanzas/empleados", "/finanzas/gastos", "/caja"]) revalidatePath(p);
  if (id) revalidatePath(`/finanzas/empleados/${id}`);
}

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const employeeSchema = z.object({
  name: z.string().trim().min(3, "Escribe el nombre completo").max(120),
  document: optText(30),
  position: z.string().trim().min(2, "Escribe el cargo").max(80),
  contractType: z.enum(CONTRACT_KEYS, { error: "Elige el tipo de contrato" }),
  salary: z.coerce.number({ error: "Escribe el salario" }).int("Usa un valor entero").min(1, "Escribe el salario").max(100_000_000),
  payEvery: z.enum(["QUINCENAL", "MENSUAL"]),
  startDate: z.string().refine(isDateStr, "Fecha de ingreso inválida"),
  eps: optText(60),
  pension: optText(60),
  cesantias: optText(60),
  arl: optText(60),
  bank: optText(120),
  phone: optText(30),
  note: optText(300),
});

export async function saveEmployee(id: string | null, _: EmpState, fd: FormData): Promise<EmpState> {
  const user = await requireAdmin();
  const parsed = employeeSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = { ...parsed.data, startDate: dateOnly(parsed.data.startDate) };
  if (id) {
    const r = await db.employee.updateMany({ where: { id, clinicId: user.clinicId }, data: d });
    if (!r.count) return { error: "Empleado no encontrado" };
  } else {
    const e = await db.employee.create({ data: { ...d, clinicId: user.clinicId } });
    id = e.id;
  }
  await db.auditLog.create({ data: { userId: user.id, action: "EMPLOYEE", entity: "Employee", entityId: id } });
  revalidateEmp(id);
  return { ok: true, id };
}

export async function retireEmployee(id: string, _: EmpState, fd: FormData): Promise<EmpState> {
  const user = await requireAdmin();
  const end = String(fd.get("endDate") ?? "");
  if (!isDateStr(end)) return { error: "Elige la fecha de retiro" };
  const r = await db.employee.updateMany({ where: { id, clinicId: user.clinicId }, data: { active: false, endDate: dateOnly(end) } });
  if (!r.count) return { error: "Empleado no encontrado" };
  await db.auditLog.create({ data: { userId: user.id, action: "EMPLOYEE_RETIRE", entity: "Employee", entityId: id } });
  revalidateEmp(id);
  return { ok: true };
}

const noveltySchema = z.object({
  kind: z.enum(NOVELTY_KEYS, { error: "Elige la novedad" }),
  amount: z.coerce.number().int("Usa un valor entero").min(0).max(100_000_000).default(0),
  date: z.string().refine(isDateStr, "Fecha inválida"),
  note: optText(200),
});

export async function addNovelty(employeeId: string, _: EmpState, fd: FormData): Promise<EmpState> {
  const user = await requireAdmin();
  const parsed = noveltySchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const sign = NOVELTIES[d.kind].sign;
  if (sign !== 0 && d.amount <= 0) return { error: "Escribe el valor" };
  if (sign === 0 && !d.note) return { error: "Escribe las fechas o el detalle de la novedad" };
  const e = await db.employee.findFirst({ where: { id: employeeId, clinicId: user.clinicId }, select: { id: true } });
  if (!e) return { error: "Empleado no encontrado" };
  await db.payrollNovelty.create({ data: { clinicId: user.clinicId, employeeId, kind: d.kind, amount: sign * d.amount, date: dateOnly(d.date), note: d.note, createdById: user.id } });
  revalidateEmp(employeeId);
  return { ok: true };
}

export async function voidNovelty(id: string): Promise<void> {
  const user = await requireAdmin();
  const n = await db.payrollNovelty.findFirst({ where: { id, clinicId: user.clinicId, voidedAt: null, payLineId: null } });
  if (!n) return;
  await db.payrollNovelty.update({ where: { id }, data: { voidedAt: new Date(), voidedById: user.id } });
  revalidateEmp(n.employeeId);
}

// «Pagar quincena»: una línea por empleado con el total sugerido (editable). Cada línea queda como gasto con su comprobante.
export async function payRun(periodKey: string, _: EmpState, fd: FormData): Promise<EmpState> {
  const { user, branch } = await requireBranch();
  if (user.role !== "ADMIN") return { error: "Solo administración paga a los empleados" };
  const period = periodInfo(periodKey);
  if (!period) return { error: "Periodo inválido" };
  const source = String(fd.get("source") ?? "");
  if (!(SOURCE_KEYS as string[]).includes(source)) return { error: "Elige de dónde sale la plata" };
  let sessionId: string | null = null;
  if (source === "CASH_BOX") {
    sessionId = await openSessionId(user.clinicId, branch.id);
    if (!sessionId) return { error: `No hay caja abierta en la sede ${branch.name}` };
  }
  const ids = fd.getAll("employeeId").map(String);
  if (!ids.length) return { error: "Marca a quién le pagas" };
  const already = await db.payRunLine.findMany({ where: { employeeId: { in: ids }, payRun: { clinicId: user.clinicId, periodKey, voidedAt: null } }, select: { employee: { select: { name: true } } } });
  if (already.length) return { error: `${already[0].employee.name} ya tiene pago en este periodo. Anula ese pago si quedó mal.` };

  const [employees, settings] = await Promise.all([
    db.employee.findMany({ where: { id: { in: ids }, clinicId: user.clinicId, active: true }, include: { novelties: { where: { voidedAt: null, payLineId: null, date: { lte: dateOnly(period.to) } } } } }),
    financeSettings(user.clinicId),
  ]);
  if (employees.length !== ids.length) return { error: "Algún empleado no está activo. Recarga la página." };

  const lines: { e: (typeof employees)[number]; s: ReturnType<typeof suggestPay>; total: number }[] = [];
  for (const e of employees) {
    const s = suggestPay(e, e.novelties, period.kind, settings);
    const raw = String(fd.get(`total_${e.id}`) ?? "").trim();
    const total = raw === "" ? s.total : Number(raw);
    if (!Number.isInteger(total) || total <= 0 || total > 100_000_000) return { error: `Revisa el valor a pagar de ${e.name}` };
    lines.push({ e, s, total });
  }
  const grand = lines.reduce((t, l) => t + l.total, 0);
  const payees = await Promise.all(lines.map((l) => db.payee.upsert({ where: { clinicId_name: { clinicId: user.clinicId, name: l.e.name } }, create: { clinicId: user.clinicId, name: l.e.name, document: l.e.document, defaultCategory: "EMPLEADOS" }, update: { active: true } })));
  const today = todayStr();

  for (let attempt = 0; ; attempt++) {
    try {
      const run = await db.$transaction(async (tx) => {
        const lastRun = await tx.payRun.aggregate({ _max: { number: true }, where: { clinicId: user.clinicId } });
        const run = await tx.payRun.create({ data: { clinicId: user.clinicId, number: (lastRun._max.number ?? 0) + 1, label: period.label, periodKey, total: grand, createdById: user.id } });
        const lastExp = await tx.expense.aggregate({ _max: { number: true }, where: { clinicId: user.clinicId } });
        let n = lastExp._max.number ?? 0;
        for (const [i, l] of lines.entries()) {
          const x = await tx.expense.create({
            data: {
              clinicId: user.clinicId, branchId: branch.id, number: ++n, payeeId: payees[i].id, category: "EMPLEADOS", description: `Pago ${period.label} · ${l.e.position}`.slice(0, 200),
              amount: l.total, docKind: "NONE", expenseDate: dateOnly(today), settledAt: new Date(), createdById: user.id,
            },
          });
          await tx.expensePayment.create({ data: { clinicId: user.clinicId, expenseId: x.id, amount: l.total, source, sessionId, paidById: user.id } });
          const line = await tx.payRunLine.create({
            data: { payRunId: run.id, employeeId: l.e.id, base: l.s.base, transport: l.s.transport, additions: l.s.additions, deductions: l.s.deductions, total: l.total, expenseId: x.id, detail: { suggested: l.s.total, contributions: l.s.contributions, novelties: l.e.novelties.map((nv) => ({ kind: nv.kind, amount: nv.amount, note: nv.note })) } },
          });
          if (l.e.novelties.length) await tx.payrollNovelty.updateMany({ where: { id: { in: l.e.novelties.map((nv) => nv.id) }, payLineId: null }, data: { payLineId: line.id } });
        }
        await tx.auditLog.create({ data: { userId: user.id, action: "PAYRUN", entity: "PayRun", entityId: run.id, detail: period.label } });
        return run;
      });
      revalidateEmp();
      return { ok: true, id: run.id };
    } catch (err) {
      if (attempt >= 2 || (err as { code?: string }).code !== "P2002") throw err;
    }
  }
}

export async function voidPayRun(id: string, _: EmpState, fd: FormData): Promise<EmpState> {
  const user = await requireAdmin();
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Escribe el motivo (mínimo 5 letras)" };
  const run = await db.payRun.findFirst({ where: { id, clinicId: user.clinicId, voidedAt: null }, include: { lines: true } });
  if (!run) return { error: "Pago no encontrado o ya anulado" };
  for (const l of run.lines) if (l.expenseId && (await paidFromClosedCash(l.expenseId))) return { error: "Parte de este pago salió de una caja ya cerrada y no se puede anular" };
  const now = new Date();
  const expenseIds = run.lines.map((l) => l.expenseId).filter((x): x is string => !!x);
  await db.$transaction([
    db.expensePayment.updateMany({ where: { expenseId: { in: expenseIds }, voidedAt: null }, data: { voidedAt: now, voidedById: user.id, voidReason: "Pago a empleados anulado" } }),
    db.expense.updateMany({ where: { id: { in: expenseIds } }, data: { voidedAt: now, voidedById: user.id, voidReason: `Pago a empleados anulado: ${reason.slice(0, 160)}` } }),
    db.payrollNovelty.updateMany({ where: { payLineId: { in: run.lines.map((l) => l.id) } }, data: { payLineId: null } }),
    db.payRun.update({ where: { id }, data: { voidedAt: now, voidedById: user.id, voidReason: reason.slice(0, 200) } }),
    db.auditLog.create({ data: { userId: user.id, action: "PAYRUN_VOID", entity: "PayRun", entityId: id } }),
  ]);
  revalidateEmp();
  revalidatePath(`/finanzas/empleados/pago/${id}`);
  return { ok: true };
}

const settingsSchema = z.object({
  minWage: z.coerce.number().int().min(100_000).max(50_000_000),
  transportAid: z.coerce.number().int().min(0).max(5_000_000),
  retHonorarios: z.coerce.number().min(0).max(50),
  retServicios: z.coerce.number().min(0).max(50),
  retCompras: z.coerce.number().min(0).max(50),
  applyRetention: z.string().optional(),
  accountantName: optText(120),
  accountantEmail: z.string().trim().max(160).optional().transform((v) => v || null).refine((v) => v === null || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "Correo inválido"),
});

export async function saveSettings(_: EmpState, fd: FormData): Promise<EmpState> {
  const user = await requireAdmin();
  const parsed = settingsSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = { ...parsed.data, applyRetention: parsed.data.applyRetention === "on" };
  await db.financeSettings.upsert({ where: { clinicId: user.clinicId }, create: { clinicId: user.clinicId, ...data }, update: data });
  await db.auditLog.create({ data: { userId: user.id, action: "FINANCE_SETTINGS", entity: "Clinic", entityId: user.clinicId } });
  revalidatePath("/finanzas/ajustes");
  revalidatePath("/finanzas/empleados");
  return { ok: true };
}
