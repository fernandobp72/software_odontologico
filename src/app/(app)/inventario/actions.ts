"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { todayBogota, unitLabel } from "@/lib/inventory";
import { receiveLot, takeFefo } from "@/lib/supply-ops";
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
    data: chosen.map((c) => ({ clinicId: user.clinicId, name: c.name, category: c.category, unit: c.unit, perishable: c.perishable, minStock: c.min, warnDays: c.warn, catalogKey: c.key, packLabel: c.pack ?? null, packSize: c.packSize ?? null })),
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
    packLabel: z.string().trim().max(20).optional(),
    packSize: z.coerce.number().int().min(2).max(10_000).optional(),
  }).safeParse({ name: fd.get("name"), category: fd.get("category"), unit: fd.get("unit") || SUPPLY_UNITS[0], minStock: fd.get("minStock") || 0, warnDays: fd.get("warnDays") || 60, packLabel: fd.get("packLabel") || undefined, packSize: fd.get("packSize") || undefined });
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  try {
    await db.supplyItem.create({ data: { clinicId: user.clinicId, name: d.name, category: d.category, unit: d.unit, minStock: d.minStock, warnDays: d.warnDays, perishable: fd.get("perishable") === "on", packLabel: d.packLabel && d.packSize ? d.packLabel : null, packSize: d.packLabel && d.packSize ? d.packSize : null } });
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

// Valida y registra un ingreso. Compartida por el formulario y por la voz.
async function receiveCore(ctx: { user: { id: string; clinicId: string }; branch: { id: string } }, itemId: string, rawQty: unknown, inPack: boolean, rawExpiry: string, rawLot: string): Promise<SupplyState> {
  const { user, branch } = ctx;
  const item = await ownItem(itemId, user.clinicId);
  if (!item || !item.active) return { error: "Producto no encontrado" };
  const q = qty.safeParse(rawQty);
  if (!q.success) return { error: q.error.issues[0].message };
  const total = inPack && item.packSize ? q.data * item.packSize : q.data;
  if (total > 100_000) return { error: "Cantidad demasiado grande" };
  const raw = rawExpiry.trim();
  let expiresAt: Date | null = null;
  if (raw) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(raw))) return { error: "Fecha de vencimiento inválida" };
    expiresAt = new Date(`${raw}T00:00:00.000Z`);
    if (expiresAt < todayBogota()) return { error: "Esa fecha ya pasó: no se ingresa un producto vencido" };
    if (expiresAt.getUTCFullYear() > todayBogota().getUTCFullYear() + 15) return { error: "Revisa el año de vencimiento" };
  } else if (item.perishable) {
    return { error: "Este producto vence: escribe la fecha de vencimiento del lote" };
  }
  await receiveLot({ clinicId: user.clinicId, branchId: branch.id, userId: user.id }, item, total, expiresAt, rawLot.trim().slice(0, 40) || null);
  revalidatePath("/inventario");
  return { ok: `Ingresaron ${total} ${unitLabel(item.unit, total)}` };
}

export async function receiveStock(itemId: string, _: SupplyState, fd: FormData): Promise<SupplyState> {
  const ctx = await requireBranch();
  return receiveCore(ctx, itemId, fd.get("quantity"), fd.get("inPack") === "pack", String(fd.get("expiresAt") ?? ""), String(fd.get("lotCode") ?? ""));
}

async function consumeCore(ctx: { user: { id: string; clinicId: string }; branch: { id: string } }, itemId: string, rawQty: unknown, inPack: boolean, note: string | null): Promise<SupplyState> {
  const { user, branch } = ctx;
  const item = await ownItem(itemId, user.clinicId);
  if (!item) return { error: "Producto no encontrado" };
  const q = qty.safeParse(rawQty);
  if (!q.success) return { error: q.error.issues[0].message };
  const total = inPack && item.packSize ? q.data * item.packSize : q.data;
  const r = await takeFefo({ clinicId: user.clinicId, branchId: branch.id, userId: user.id }, itemId, total, { note: note?.trim().slice(0, 120) || null });
  if (!r.ok) return { error: "raced" in r && r.raced ? "Las existencias cambiaron mientras registrabas. Intenta de nuevo." : `Solo hay ${r.have} sin vencer en esta sede` };
  revalidatePath("/inventario");
  return { ok: `Salieron ${total} ${unitLabel(item.unit, total)}` };
}

export async function consumeStock(itemId: string, _: SupplyState, fd: FormData): Promise<SupplyState> {
  const ctx = await requireBranch();
  return consumeCore(ctx, itemId, fd.get("quantity"), fd.get("inPack") === "pack", String(fd.get("note") ?? ""));
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

// ---- Kits: lo que gasta cada procedimiento ----

export async function addKitLine(procId: string, _: SupplyState, fd: FormData): Promise<SupplyState> {
  const { user } = await requireAdmin();
  const proc = await db.clinicProcedure.findFirst({ where: { clinicId: user.clinicId, procId }, select: { procId: true } });
  if (!proc) return { error: "Procedimiento no encontrado" };
  const q = qty.safeParse(fd.get("quantity"));
  if (!q.success) return { error: q.error.issues[0].message };
  const itemId = String(fd.get("itemId") ?? "");
  if (!(await ownItem(itemId, user.clinicId))) return { error: "Elige un insumo" };
  await db.supplyKitLine.upsert({ where: { clinicId_procId_itemId: { clinicId: user.clinicId, procId, itemId } }, update: { quantity: q.data }, create: { clinicId: user.clinicId, procId, itemId, quantity: q.data } });
  revalidatePath("/inventario/kits");
  return { ok: "Guardado" };
}

export async function removeKitLine(lineId: string): Promise<void> {
  const { user } = await requireAdmin();
  await db.supplyKitLine.deleteMany({ where: { id: lineId, clinicId: user.clinicId } });
  revalidatePath("/inventario/kits");
}

// ---- Voz: aplica la lista de borradores ya revisada ----

export type DraftLine = { kind: "IN" | "OUT"; itemId: string; quantity: number; inPack: boolean; expiresAt: string };
export type ApplyResult = { lines: { ok: boolean; text: string }[] } | { error: string };

export async function applyDrafts(lines: DraftLine[]): Promise<ApplyResult> {
  const ctx = await requireBranch();
  if (!Array.isArray(lines) || !lines.length || lines.length > 30) return { error: "No hay líneas para registrar" };
  const out: { ok: boolean; text: string }[] = [];
  for (const l of lines) {
    const item = await ownItem(String(l.itemId), ctx.user.clinicId);
    const name = item?.name ?? "Producto";
    const r = l.kind === "IN"
      ? await receiveCore(ctx, String(l.itemId), l.quantity, !!l.inPack, String(l.expiresAt ?? ""), "")
      : await consumeCore(ctx, String(l.itemId), l.quantity, !!l.inPack, "Por voz");
    out.push({ ok: !r?.error, text: `${name}: ${r?.error ?? r?.ok ?? "listo"}` });
  }
  return { lines: out };
}
