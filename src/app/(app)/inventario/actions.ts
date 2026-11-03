"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { pickFefo, todayBogota, unitLabel } from "@/lib/inventory";
import { SUPPLY_CATALOG, SUPPLY_CATEGORIES, SUPPLY_UNITS } from "@/lib/supplies-catalog";

export type SupplyState = { error?: string; ok?: string } | undefined;

// Cualquier rol registra ingresos y consumos (los hace quien tiene el producto en la mano); solo el administrador configura.
async function requireAdmin() {
  const ctx = await requireBranch();
  if (ctx.user.role !== "ADMIN") throw new Error("Solo el administrador puede configurar el inventario");
  return ctx;
}

const qty = z.coerce.number({ message: "Escribe una cantidad" }).int("La cantidad debe ser un número entero").min(1, "La cantidad debe ser al menos 1").max(100_000, "Cantidad demasiado grande");
const small = z.coerce.number().int("Usa un número entero").min(0).max(100_000);

async function ownItem(id: string, clinicId: string) {
  return db.supplyItem.findFirst({ where: { id, clinicId } });
}

export async function addFromCatalog(_: SupplyState, fd: FormData): Promise<SupplyState> {
  const { user } = await requireAdmin();
  const keys = new Set(fd.getAll("key").map(String));
  const chosen = SUPPLY_CATALOG.filter((c) => keys.has(c.key));
  if (!chosen.length) return { error: "Marca al menos un producto" };
  const r = await db.supplyItem.createMany({
    skipDuplicates: true,
    data: chosen.map((c) => ({ clinicId: user.clinicId, name: c.name, category: c.category, unit: c.unit, perishable: c.perishable, minStock: c.min, warnDays: c.warn, catalogKey: c.key })),
  });
  await db.auditLog.create({ data: { userId: user.id, action: "SUPPLY_ADD", entity: "SupplyItem", entityId: `${r.count} del catálogo` } });
  revalidatePath("/inventario");
  return { ok: `${r.count} producto${r.count === 1 ? "" : "s"} agregado${r.count === 1 ? "" : "s"}` };
}

export async function createItem(_: SupplyState, fd: FormData): Promise<SupplyState> {
  const { user } = await requireAdmin();
  const p = z.object({
    name: z.string().trim().min(2, "Escribe el nombre del producto").max(80),
    category: z.enum(SUPPLY_CATEGORIES as [string, ...string[]]),
    unit: z.string().trim().min(1, "Escribe la unidad").max(20),
    minStock: small,
    warnDays: z.coerce.number().int().min(1).max(365),
  }).safeParse({ name: fd.get("name"), category: fd.get("category"), unit: fd.get("unit") || SUPPLY_UNITS[0], minStock: fd.get("minStock") || 0, warnDays: fd.get("warnDays") || 60 });
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  try {
    await db.supplyItem.create({ data: { clinicId: user.clinicId, name: d.name, category: d.category, unit: d.unit, minStock: d.minStock, warnDays: d.warnDays, perishable: fd.get("perishable") === "on" } });
  } catch {
    return { error: "Ya existe un producto con ese nombre" };
  }
  await db.auditLog.create({ data: { userId: user.id, action: "SUPPLY_ADD", entity: "SupplyItem", entityId: d.name.slice(0, 60) } });
  revalidatePath("/inventario");
  return { ok: "Producto agregado" };
}

export async function saveItem(id: string, _: SupplyState, fd: FormData): Promise<SupplyState> {
  const { user } = await requireAdmin();
  const p = z.object({ minStock: small, warnDays: z.coerce.number().int().min(1).max(365) }).safeParse({ minStock: fd.get("minStock") || 0, warnDays: fd.get("warnDays") || 60 });
  if (!p.success) return { error: "Mínimo y días de aviso deben ser números enteros" };
  const r = await db.supplyItem.updateMany({ where: { id, clinicId: user.clinicId }, data: { minStock: p.data.minStock, warnDays: p.data.warnDays, perishable: fd.get("perishable") === "on", active: fd.get("active") === "on" } });
  if (!r.count) return { error: "Producto no encontrado" };
  await db.auditLog.create({ data: { userId: user.id, action: "SUPPLY_UPDATE", entity: "SupplyItem", entityId: id } });
  revalidatePath("/inventario");
  return { ok: "Guardado" };
}

export async function receiveStock(itemId: string, _: SupplyState, fd: FormData): Promise<SupplyState> {
  const { user, branch } = await requireBranch();
  const item = await ownItem(itemId, user.clinicId);
  if (!item || !item.active) return { error: "Producto no encontrado" };
  const q = qty.safeParse(fd.get("quantity"));
  if (!q.success) return { error: q.error.issues[0].message };
  const raw = String(fd.get("expiresAt") ?? "").trim();
  let expiresAt: Date | null = null;
  if (raw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) return { error: "Fecha de vencimiento inválida" };
    expiresAt = new Date(`${raw}T00:00:00.000Z`);
    if (expiresAt < todayBogota()) return { error: "Esa fecha ya pasó: no se ingresa un producto vencido" };
    if (expiresAt.getUTCFullYear() > todayBogota().getUTCFullYear() + 15) return { error: "Revisa el año de vencimiento" };
  } else if (item.perishable) {
    return { error: "Este producto vence: escribe la fecha de vencimiento del lote" };
  }
  const lotCode = String(fd.get("lotCode") ?? "").trim().slice(0, 40) || null;
  await db.$transaction(async (tx) => {
    const lot = await tx.supplyLot.create({ data: { clinicId: user.clinicId, branchId: branch.id, itemId, lotCode, quantity: q.data, initialQty: q.data, expiresAt, createdById: user.id } });
    await tx.supplyMovement.create({ data: { clinicId: user.clinicId, branchId: branch.id, itemId, lotId: lot.id, kind: "IN", delta: q.data, note: lotCode ? `Lote ${lotCode}` : null, userId: user.id } });
  });
  revalidatePath("/inventario");
  return { ok: `Ingresaron ${q.data} ${unitLabel(item.unit, q.data)}` };
}

export async function consumeStock(itemId: string, _: SupplyState, fd: FormData): Promise<SupplyState> {
  const { user, branch } = await requireBranch();
  const item = await ownItem(itemId, user.clinicId);
  if (!item) return { error: "Producto no encontrado" };
  const q = qty.safeParse(fd.get("quantity"));
  if (!q.success) return { error: q.error.issues[0].message };
  const note = String(fd.get("note") ?? "").trim().slice(0, 120) || null;
  const lots = await db.supplyLot.findMany({ where: { itemId, branchId: branch.id, quantity: { gt: 0 } } });
  const takes = pickFefo(lots, q.data);
  if (!takes) {
    const have = lots.filter((l) => !l.expiresAt || l.expiresAt >= todayBogota()).reduce((s, l) => s + l.quantity, 0);
    return { error: `Solo hay ${have} sin vencer en esta sede` };
  }
  try {
    await db.$transaction(async (tx) => {
      for (const { lot, take } of takes) {
        // Descuento condicionado: si otra persona gastó el lote mientras tanto, no queda en negativo.
        const r = await tx.supplyLot.updateMany({ where: { id: lot.id, quantity: { gte: take } }, data: { quantity: { decrement: take } } });
        if (r.count !== 1) throw new Error("race");
        await tx.supplyMovement.create({ data: { clinicId: user.clinicId, branchId: branch.id, itemId, lotId: lot.id, kind: "OUT", delta: -take, note, userId: user.id } });
      }
    });
  } catch {
    return { error: "Las existencias cambiaron mientras registrabas. Intenta de nuevo." };
  }
  revalidatePath("/inventario");
  return { ok: `Salieron ${q.data} ${unitLabel(item.unit, q.data)}` };
}

export async function discardExpired(itemId: string): Promise<void> {
  const { user, branch } = await requireBranch();
  const item = await ownItem(itemId, user.clinicId);
  if (!item) return;
  const lots = await db.supplyLot.findMany({ where: { itemId, branchId: branch.id, quantity: { gt: 0 }, expiresAt: { lt: todayBogota() } } });
  if (!lots.length) return;
  await db.$transaction([
    ...lots.map((l) => db.supplyLot.update({ where: { id: l.id }, data: { quantity: 0 } })),
    ...lots.map((l) => db.supplyMovement.create({ data: { clinicId: user.clinicId, branchId: branch.id, itemId, lotId: l.id, kind: "DISCARD", delta: -l.quantity, note: "Vencido", userId: user.id } })),
  ]);
  revalidatePath("/inventario");
}
