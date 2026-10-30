"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";

export type InvoiceState = { error?: string; ok?: boolean; invoiceId?: string } | undefined;

const schema = z.object({
  customerName: z.string().trim().min(3, "Escribe el nombre del cliente").max(120),
  customerDocument: z.string().trim().max(30).optional(),
  note: z.string().trim().max(300).optional(),
});

export async function createInvoice(patientId: string, _: InvoiceState, fd: FormData): Promise<InvoiceState> {
  const user = await requireUser();
  if (user.role === "DENTIST") return { error: "Solo administración o recepción generan cuentas de cobro" };
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const itemIds = fd.getAll("itemIds").map(String);
  if (!itemIds.length) return { error: "Elige al menos un procedimiento" };

  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId }, select: { id: true } });
  if (!patient) return { error: "Paciente no encontrado" };

  // Solo procedimientos realizados de este paciente que no estén ya en otra cuenta vigente.
  const items = await db.treatmentItem.findMany({
    where: { id: { in: itemIds }, status: "DONE", plan: { patientId, patient: { clinicId: user.clinicId } } },
  });
  const billed = await db.invoiceLine.findMany({ where: { itemId: { in: items.map((i) => i.id) } }, select: { itemId: true } });
  const free = items.filter((i) => !billed.some((b) => b.itemId === i.id));
  if (!free.length || free.length !== itemIds.length) return { error: "Algún procedimiento ya está en otra cuenta de cobro o no está realizado" };

  const total = free.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const last = await db.invoice.aggregate({ _max: { number: true }, where: { clinicId: user.clinicId } });
      const inv = await db.invoice.create({
        data: {
          clinicId: user.clinicId, number: (last._max.number ?? 0) + 1, patientId, total,
          customerName: parsed.data.customerName, customerDocument: parsed.data.customerDocument || null,
          note: parsed.data.note || null, createdById: user.id,
          lines: { create: free.map((i) => ({ itemId: i.id, description: i.material ? `${i.name} (${i.material})` : i.name, tooth: i.tooth, procedureCode: i.procedureCode, quantity: i.quantity, unitPrice: i.unitPrice })) },
        },
      });
      await db.auditLog.create({ data: { userId: user.id, action: "INVOICE", entity: "Invoice", entityId: inv.id } });
      revalidatePath(`/pacientes/${patientId}/cuenta`);
      return { ok: true, invoiceId: inv.id };
    } catch (e) {
      if (attempt === 2) throw e;
    }
  }
  return { error: "No se pudo generar la cuenta de cobro" };
}

export async function voidInvoice(invoiceId: string, fd: FormData): Promise<void> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Solo administración puede anular cuentas de cobro");
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 5) return;
  const inv = await db.invoice.findFirst({ where: { id: invoiceId, clinicId: user.clinicId, voidedAt: null } });
  if (!inv) return;
  await db.$transaction([
    db.invoice.update({ where: { id: inv.id }, data: { voidedAt: new Date(), voidedById: user.id, voidReason: reason.slice(0, 200) } }),
    // Libera los procedimientos para poder incluirlos en otra cuenta.
    db.invoiceLine.updateMany({ where: { invoiceId: inv.id }, data: { itemId: null } }),
  ]);
  await db.auditLog.create({ data: { userId: user.id, action: "INVOICE_VOID", entity: "Invoice", entityId: inv.id } });
  revalidatePath(`/pacientes/${inv.patientId}/cuenta`);
}
