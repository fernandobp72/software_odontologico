import { db } from "./db";
import { ensureCatalog, type CatalogMaterial } from "./catalog";

// Tarifas de referencia para odontología privada en Colombia (COP), octubre de 2026.
// Son un punto de partida: parte sale de sitios comparadores de precios (sin fuente oficial) y parte son
// estimaciones; cada consultorio debe ajustarlas a su ciudad y a su mercado.
export const REFERENCE_PRICES: Record<string, { price: number; materials?: Record<string, number> }> = {
  "consulta-1": { price: 80000 },
  "consulta-control": { price: 60000 },
  profilaxis: { price: 100000 },
  "detartraje-supra": { price: 110000 },
  "fluor-gel": { price: 60000 },
  "sellante-auto": { price: 70000 },
  "sellante-foto": { price: 70000 },
  "obt-resina": { price: 130000 }, // por superficie
  "obt-amalgama": { price: 80000 },
  "obt-ionomero": { price: 90000 },
  pulpotomia: { price: 170000 },
  "endo-uni": { price: 480000 },
  "endo-bi": { price: 600000 },
  "endo-multi": { price: 950000 },
  "exo-uni": { price: 130000 },
  "exo-multi": { price: 130000 },
  "exo-quir-uni": { price: 380000 },
  "exo-quir-multi": { price: 380000 },
  "exo-incluido": { price: 500000 },
  "detartraje-sub": { price: 170000 }, // por cuadrante
  gingivectomia: { price: 250000 },
  perno: { price: 170000 },
  munon: { price: 160000 },
  "corona-definitiva": { price: 1300000, materials: { Zirconio: 2200000, "Metal-cerámica": 1300000 } },
  "corona-acero": { price: 110000 },
  implante: { price: 4500000 }, // implante con corona
  "total-completa": { price: 1800000 },
  blanqueamiento: { price: 600000 },
  "rx-periapical": { price: 25000 },
  "rx-panoramica": { price: 80000 },
  "orto-fija": { price: 1800000 },
  "orto-control": { price: 100000 },
};

// Completa solo lo que está en 0: nunca cambia una tarifa que el consultorio ya definió.
export async function applyReferencePrices(clinicId: string): Promise<{ procedures: number; materials: number }> {
  await ensureCatalog(clinicId);
  const rows = await db.clinicProcedure.findMany({ where: { clinicId, procId: { in: Object.keys(REFERENCE_PRICES) } } });
  let procedures = 0;
  let materials = 0;
  for (const r of rows) {
    const ref = REFERENCE_PRICES[r.procId];
    const mats: CatalogMaterial[] = Array.isArray(r.materials) ? (r.materials as unknown as CatalogMaterial[]) : [];
    let changed = false;
    const data: { price?: number; materials?: CatalogMaterial[] } = {};
    if (r.price === 0) { data.price = ref.price; procedures++; changed = true; }
    if (ref.materials) {
      const next = mats.map((m) => (m.price === 0 && ref.materials![m.name] ? (materials++, changed = true, { ...m, price: ref.materials![m.name] }) : m));
      if (changed) data.materials = next;
    }
    if (changed) await db.clinicProcedure.update({ where: { id: r.id }, data });
  }
  return { procedures, materials };
}
