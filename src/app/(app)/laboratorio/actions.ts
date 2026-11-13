"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBranch, requireUser } from "@/lib/dal";
import { dateOnly, isDateStr, todayStr } from "@/lib/finanzas";
import { createExpenseWith, payChoice } from "@/lib/finanzas-write";
import { LAB_STATUS, REDO_PAYER, type LabStatus } from "@/lib/labs";
import { copFmt } from "@/lib/cartera";

export type LabState = { error?: string; ok?: boolean; orderId?: string; expenseId?: string } | undefined;

function revalidateLab(id?: string, patientId?: string) {
  for (const p of ["/laboratorio", "/finanzas/laboratorios", "/finanzas/profesionales", "/finanzas/mis-pagos"]) revalidatePath(p);
  if (id) revalidatePath(`/laboratorio/${id}`);
  if (patientId) revalidatePath(`/pacientes/${patientId}/plan`);
}

const optText = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const orderSchema = z.object({
  patientId: z.string().min(1, "Elige el paciente"),
  itemId: optText(40),
  labName: z.string().trim().min(2, "Escribe el laboratorio").max(120),
  workType: z.string().trim().min(2, "Escribe el tipo de trabajo").max(80),
  tooth: z.string().optional().transform((v) => (v ? Number(v) : null)).refine((v) => v === null || (Number.isInteger(v) && v >= 11 && v <= 85), "Diente inválido"),
  shade: optText(20),
  material: optText(60),
  instructions: optText(500),
  promisedAt: z.string().optional().transform((v) => v || null).refine((v) => v === null || isDateStr(v), "Fecha inválida"),
  cost: z.coerce.number({ error: "Escribe el costo" }).int("Usa un valor entero en pesos").min(0).max(50_000_000),
  redoOfId: optText(40),
  redoReason: optText(200),
  redoPayer: z.enum(Object.keys(REDO_PAYER) as [keyof typeof REDO_PAYER]).optional(),
});

// Enviar a laboratorio: odontólogos y administración. El trabajo queda a nombre de quien hizo o hará el procedimiento.
export async function createLabOrder(_: LabState, fd: FormData): Promise<LabState> {
  const { user, branch } = await requireBranch();
  if (user.role === "RECEPTION") return { error: "Las órdenes de laboratorio las envía el profesional o administración" };
  const parsed = orderSchema.safeParse(Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === "string")));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const patient = await db.patient.findFirst({ where: { id: d.patientId, clinicId: user.clinicId }, select: { id: true } });
  if (!patient) return { error: "Paciente no encontrado" };
  let dentistId = user.id;
  if (d.itemId) {
    const item = await db.treatmentItem.findFirst({ where: { id: d.itemId, plan: { patientId: patient.id } }, select: { doneById: true, plan: { select: { dentistId: true } } } });
    if (!item) return { error: "Procedimiento no encontrado" };
    dentistId = item.doneById ?? item.plan.dentistId;
  }
  let redo: { id: string; payer: string; reason: string } | null = null;
  if (d.redoOfId) {
    const orig = await db.labOrder.findFirst({ where: { id: d.redoOfId, clinicId: user.clinicId }, select: { id: true } });
    if (!orig) return { error: "Orden original no encontrada" };
    if (!d.redoPayer) return { error: "Elige quién asume el costo de la repetición" };
    if (!d.redoReason || d.redoReason.length < 5) return { error: "Escribe la causa de la repetición" };
    redo = { id: orig.id, payer: d.redoPayer, reason: d.redoReason };
  }
  const payee = await db.payee.upsert({
    where: { clinicId_name: { clinicId: user.clinicId, name: d.labName } },
    create: { clinicId: user.clinicId, name: d.labName, defaultCategory: "LABORATORIO" },
    update: { active: true },
  });
  // Si la repetición la asume el laboratorio, no se le debe nada por ella.
  const cost = redo?.payer === "LAB" ? 0 : d.cost;

  for (let attempt = 0; ; attempt++) {
    try {
      const o = await db.$transaction(async (tx) => {
        const last = await tx.labOrder.aggregate({ _max: { number: true }, where: { clinicId: user.clinicId } });
        const o = await tx.labOrder.create({
          data: {
            clinicId: user.clinicId, branchId: branch.id, number: (last._max.number ?? 0) + 1, payeeId: payee.id, patientId: patient.id, itemId: d.itemId, dentistId,
            workType: d.workType, tooth: d.tooth, shade: d.shade, material: d.material, instructions: d.instructions, promisedAt: d.promisedAt ? dateOnly(d.promisedAt) : null,
            cost, redoOfId: redo?.id ?? null, redoReason: redo?.reason ?? null, redoPayer: redo?.payer ?? null, createdById: user.id,
          },
        });
        await tx.labOrderEvent.create({ data: { orderId: o.id, status: "SENT", note: redo ? `Repetición: ${redo.reason}` : null, byId: user.id } });
        await tx.auditLog.create({ data: { userId: user.id, action: "LAB_ORDER", entity: "LabOrder", entityId: o.id } });
        return o;
      });
      revalidateLab(o.id, patient.id);
      return { ok: true, orderId: o.id };
    } catch (err) {
      if (attempt >= 2 || (err as { code?: string }).code !== "P2002") throw err;
    }
  }
}

// Seguimiento: Enviado → Recibido → Colocado, con idas y vueltas «Devuelto para ajuste» dentro de la misma orden.
const NEXT: Record<LabStatus, LabStatus[]> = { SENT: ["RECEIVED"], ADJUST: ["RECEIVED"], RECEIVED: ["PLACED", "ADJUST"], PLACED: [] };

export async function setLabStatus(id: string, status: LabStatus, _: LabState, fd: FormData): Promise<LabState> {
  const user = await requireUser();
  if (!(status in LAB_STATUS)) return { error: "Estado inválido" };
  if (user.role === "RECEPTION" && status !== "RECEIVED") return { error: "Recepción solo marca los trabajos recibidos" };
  const o = await db.labOrder.findFirst({ where: { id, clinicId: user.clinicId, voidedAt: null } });
  if (!o) return { error: "Orden no encontrada o anulada" };
  if (!NEXT[o.status as LabStatus]?.includes(status)) return { error: `No se puede pasar de «${LAB_STATUS[o.status as LabStatus]?.label}» a «${LAB_STATUS[status].label}»` };
  const note = String(fd.get("note") ?? "").trim().slice(0, 300) || null;
  if (status === "ADJUST" && !note) return { error: "Escribe qué hay que ajustar" };
  const now = new Date();
  await db.$transaction([
    db.labOrder.update({ where: { id }, data: { status, ...(status === "RECEIVED" ? { receivedAt: now } : status === "PLACED" ? { placedAt: now } : {}) } }),
    db.labOrderEvent.create({ data: { orderId: id, status, note, byId: user.id } }),
  ]);
  revalidateLab(id, o.patientId);
  return { ok: true };
}

// El costo se corrige mientras no esté incluido en una factura del laboratorio.
export async function setLabCost(id: string, _: LabState, fd: FormData): Promise<LabState> {
  const user = await requireUser();
  if (user.role === "RECEPTION") return { error: "No autorizado" };
  const cost = Number(fd.get("cost"));
  if (!Number.isInteger(cost) || cost < 0 || cost > 50_000_000) return { error: "Revisa el costo" };
  const o = await db.labOrder.findFirst({ where: { id, clinicId: user.clinicId, voidedAt: null } });
  if (!o) return { error: "Orden no encontrada" };
  if (o.expenseId) return { error: "Ya está incluida en una factura del laboratorio; corrige la factura" };
  await db.$transaction([
    db.labOrder.update({ where: { id }, data: { cost } }),
    db.labOrderEvent.create({ data: { orderId: id, status: o.status, note: `Costo: ${copFmt.format(o.cost)} → ${copFmt.format(cost)}`, byId: user.id } }),
  ]);
  revalidateLab(id, o.patientId);
  return { ok: true };
}

export async function voidLabOrder(id: string, _: LabState, fd: FormData): Promise<LabState> {
  const user = await requireUser();
  if (user.role === "RECEPTION") return { error: "No autorizado" };
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 5) return { error: "Escribe el motivo (mínimo 5 letras)" };
  const o = await db.labOrder.findFirst({ where: { id, clinicId: user.clinicId, voidedAt: null } });
  if (!o) return { error: "Orden no encontrada o ya anulada" };
  if (o.expenseId) return { error: "Ya está incluida en una factura del laboratorio; anula primero esa factura en Gastos" };
  await db.$transaction([
    db.labOrder.update({ where: { id }, data: { voidedAt: new Date(), voidedById: user.id, voidReason: reason.slice(0, 200) } }),
    db.auditLog.create({ data: { userId: user.id, action: "LAB_ORDER_VOID", entity: "LabOrder", entityId: id } }),
  ]);
  revalidateLab(id, o.patientId);
  return { ok: true };
}

// Factura del laboratorio: se marcan los trabajos que cubre y queda como gasto (pagado o por pagar). Muestra la diferencia.
export async function registerLabInvoice(payeeId: string, _: LabState, fd: FormData): Promise<LabState> {
  const { user, branch } = await requireBranch();
  if (user.role !== "ADMIN") return { error: "Solo administración registra facturas" };
  const ids = fd.getAll("orderId").map(String);
  if (!ids.length) return { error: "Marca los trabajos que cubre la factura" };
  const amount = Number(fd.get("amount"));
  if (!Number.isInteger(amount) || amount <= 0 || amount > 500_000_000) return { error: "Escribe el valor de la factura" };
  const docNumber = String(fd.get("docNumber") ?? "").trim().slice(0, 40) || null;
  const docKind = ["FACTURA", "DOC_SOPORTE", "CUENTA_COBRO", "RECIBO"].includes(String(fd.get("docKind"))) ? String(fd.get("docKind")) : "FACTURA";
  const payee = await db.payee.findFirst({ where: { id: payeeId, clinicId: user.clinicId }, select: { id: true, name: true } });
  if (!payee) return { error: "Laboratorio no encontrado" };
  const orders = await db.labOrder.findMany({ where: { id: { in: ids }, payeeId, clinicId: user.clinicId, voidedAt: null, expenseId: null }, select: { id: true, cost: true } });
  if (orders.length !== ids.length) return { error: "Algún trabajo ya estaba facturado o anulado. Recarga la página." };
  const today = todayStr();
  const choice = await payChoice(fd, { clinicId: user.clinicId, branchId: branch.id, branchName: branch.name }, today);
  if ("error" in choice) return choice;
  const expected = orders.reduce((s, o) => s + o.cost, 0);
  const diff = amount - expected;

  const { expenseId } = await createExpenseWith(
    {
      clinicId: user.clinicId, branchId: branch.id, userId: user.id, payeeName: payee.name, category: "LABORATORIO", amount,
      description: `${orders.length} ${orders.length === 1 ? "trabajo" : "trabajos"} de laboratorio${diff ? ` · diferencia ${copFmt.format(diff)} frente a lo registrado` : ""}`,
      docKind, docNumber, expenseDate: today, pay: choice.pay,
    },
    async (tx, expenseId) => {
      const r = await tx.labOrder.updateMany({ where: { id: { in: ids }, expenseId: null }, data: { expenseId } });
      if (r.count !== ids.length) throw new Error("Algún trabajo se facturó al mismo tiempo. Recarga la página.");
    },
  );
  revalidateLab();
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/por-pagar");
  return { ok: true, expenseId };
}
