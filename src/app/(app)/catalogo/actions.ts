"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";

export type CatalogState = { error?: string; ok?: boolean } | undefined;

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Solo el administrador puede cambiar el catálogo");
  return user;
}

const price = z.coerce.number().int("Usa un valor entero en pesos").min(0).max(100_000_000);
const materialsSchema = z
  .array(z.object({ name: z.string().trim().min(1).max(60), price, isDefault: z.boolean().optional() }))
  .max(20);

export async function saveProcedure(id: string, _: CatalogState, fd: FormData): Promise<CatalogState> {
  const admin = await requireAdmin();
  const base = price.safeParse(fd.get("price") || 0);
  if (!base.success) return { error: "La tarifa debe ser un valor entero en pesos" };
  let raw: unknown = [];
  try { raw = JSON.parse(String(fd.get("materials") ?? "[]")); } catch { return { error: "Materiales inválidos" }; }
  const mats = materialsSchema.safeParse(raw);
  if (!mats.success) return { error: "Revisa los materiales: nombre obligatorio y precio entero" };
  const seen = new Set<string>();
  for (const m of mats.data) { if (seen.has(m.name.toLowerCase())) return { error: `El material «${m.name}» está repetido` }; seen.add(m.name.toLowerCase()); }
  // A lo sumo un material por defecto
  let defaultSeen = false;
  const materials = mats.data.map((m) => { const isDefault = !!m.isDefault && !defaultSeen; if (isDefault) defaultSeen = true; return { name: m.name, price: m.price, isDefault }; });

  const r = await db.clinicProcedure.updateMany({ where: { id, clinicId: admin.clinicId }, data: { active: fd.get("active") === "on", price: base.data, materials } });
  if (!r.count) return { error: "Procedimiento no encontrado" };
  await db.auditLog.create({ data: { userId: admin.id, action: "CATALOG_UPDATE", entity: "ClinicProcedure", entityId: id } });
  revalidatePath("/catalogo");
  return { ok: true };
}

const GROUPS = ["Consultas", "Prevención", "Operatoria", "Endodoncia", "Cirugía", "Periodoncia", "Rehabilitación", "Estética", "Ortodoncia", "Ayudas diagnósticas", "Otros"];

export async function createProcedure(_: CatalogState, fd: FormData): Promise<CatalogState> {
  const admin = await requireAdmin();
  const parsed = z.object({
    name: z.string().trim().min(3, "Escribe el nombre del procedimiento").max(160),
    group: z.enum(GROUPS as [string, ...string[]]),
    scope: z.enum(["mouth", "quadrant", "tooth", "surface"]),
    cups: z.string().trim().regex(/^\d{6}$/, "El CUPS debe tener 6 dígitos").optional().or(z.literal("")),
    price,
  }).safeParse({ ...Object.fromEntries(fd), price: fd.get("price") || 0 });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await db.clinicProcedure.create({ data: { clinicId: admin.clinicId, procId: `custom-${randomBytes(6).toString("hex")}`, name: d.name, cups: d.cups || null, group: d.group, scope: d.scope, price: d.price } });
  await db.auditLog.create({ data: { userId: admin.id, action: "CATALOG_CREATE", entity: "ClinicProcedure", entityId: d.name.slice(0, 40) } });
  revalidatePath("/catalogo");
  return { ok: true };
}

// Sube o baja todas las tarifas (base y por material) un porcentaje, opcionalmente de un solo grupo.
export async function adjustPrices(_: CatalogState, fd: FormData): Promise<CatalogState> {
  const admin = await requireAdmin();
  const pct = z.coerce.number().min(-50).max(100).safeParse(fd.get("percent"));
  if (!pct.success || pct.data === 0) return { error: "Escribe un porcentaje entre -50 y 100 (distinto de 0)" };
  const group = String(fd.get("group") ?? "");
  const rows = await db.clinicProcedure.findMany({ where: { clinicId: admin.clinicId, ...(group ? { group } : {}) } });
  const f = 1 + pct.data / 100;
  const round = (n: number) => Math.round((n * f) / 1000) * 1000; // redondea a miles de pesos
  await db.$transaction(rows.map((r) => db.clinicProcedure.update({
    where: { id: r.id },
    data: { price: round(r.price), materials: (Array.isArray(r.materials) ? (r.materials as { name: string; price: number; isDefault: boolean }[]) : []).map((m) => ({ ...m, price: round(Number(m.price) || 0) })) },
  })));
  await db.auditLog.create({ data: { userId: admin.id, action: `CATALOG_ADJUST ${pct.data}%`, entity: "Clinic", entityId: admin.clinicId } });
  revalidatePath("/catalogo");
  return { ok: true };
}
