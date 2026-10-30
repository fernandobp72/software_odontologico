import { db } from "./db";
import { MATERIALS, PROCEDURES } from "./catalogs";

export type CatalogMaterial = { name: string; price: number; isDefault: boolean };
export type CatalogEntry = {
  id: string;
  procId: string;
  name: string;
  cups: string | null;
  group: string;
  scope: string;
  active: boolean;
  price: number;
  materials: CatalogMaterial[];
};

const toMaterials = (v: unknown): CatalogMaterial[] =>
  Array.isArray(v) ? v.filter((m): m is CatalogMaterial => !!m && typeof m.name === "string").map((m) => ({ name: m.name, price: Number(m.price) || 0, isDefault: !!m.isDefault })) : [];

// Garantiza que el consultorio tenga el catálogo base (todos activos, tarifa en 0). Se completa solo
// si más adelante se agregan procedimientos al catálogo base.
export async function ensureCatalog(clinicId: string) {
  const count = await db.clinicProcedure.count({ where: { clinicId, procId: { in: PROCEDURES.map((p) => p.id) } } });
  if (count >= PROCEDURES.length) return;
  await db.clinicProcedure.createMany({
    skipDuplicates: true,
    data: PROCEDURES.map((p) => ({
      clinicId, procId: p.id, name: p.name, cups: p.cups, group: p.group, scope: p.scope,
      materials: (MATERIALS[p.id]?.options ?? []).map((name) => ({ name, price: 0, isDefault: name === MATERIALS[p.id]?.default })),
    })),
  });
}

export async function getCatalog(clinicId: string, opts: { onlyActive?: boolean } = {}): Promise<CatalogEntry[]> {
  await ensureCatalog(clinicId);
  const rows = await db.clinicProcedure.findMany({ where: { clinicId, ...(opts.onlyActive ? { active: true } : {}) }, orderBy: [{ group: "asc" }, { name: "asc" }] });
  return rows.map((r) => ({ id: r.id, procId: r.procId, name: r.name, cups: r.cups, group: r.group, scope: r.scope, active: r.active, price: r.price, materials: toMaterials(r.materials) }));
}

// Tarifa de un procedimiento: el precio del material elegido y, si no tiene, la tarifa base.
export function priceFor(entry: Pick<CatalogEntry, "price" | "materials">, material?: string | null) {
  const m = material ? entry.materials.find((x) => x.name === material) : undefined;
  return m && m.price > 0 ? m.price : entry.price;
}

export const defaultMaterial = (entry: Pick<CatalogEntry, "materials">) => entry.materials.find((m) => m.isDefault)?.name ?? null;
