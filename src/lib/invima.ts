import "server-only";
import { db } from "./db";
import type { Drug, Presentation } from "./vademecum";

// Contraste con el Código Único de Medicamentos vigentes del INVIMA (datos abiertos, datos.gov.co, conjunto i7cb-raxc).
// Se guarda por código ATC y se renueva cada 30 días; si el servicio no responde se usa la copia guardada.
const URL = "https://www.datos.gov.co/resource/i7cb-raxc.json";
const TTL_MS = 30 * 86_400_000;

type Row = { f: string; t: string; v: string };

const norm = (s: string) => s.toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

async function rowsFor(atc: string): Promise<{ rows: Row[]; fetchedAt: Date } | null> {
  const cached = await db.invimaCache.findUnique({ where: { atc } });
  if (cached && Date.now() - cached.fetchedAt.getTime() < TTL_MS) return { rows: cached.rows as Row[], fetchedAt: cached.fetchedAt };
  try {
    const q = new URLSearchParams({
      $select: "formafarmaceutica,principioactivo,producto,viaadministracion",
      $where: `atc='${atc}' AND estadocum='Activo' AND estadoregistro='Vigente'`,
      $limit: "3000",
    });
    const res = await fetch(`${URL}?${q}`, { signal: AbortSignal.timeout(15_000), headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    const data = (await res.json()) as { formafarmaceutica?: string; principioactivo?: string; producto?: string; viaadministracion?: string }[];
    const rows: Row[] = data.map((r) => ({ f: norm(r.formafarmaceutica ?? ""), t: norm(`${r.principioactivo ?? ""} ${r.producto ?? ""}`), v: norm(r.viaadministracion ?? "") }));
    const saved = await db.invimaCache.upsert({ where: { atc }, create: { atc, rows }, update: { rows, fetchedAt: new Date() } });
    return { rows, fetchedAt: saved.fetchedAt };
  } catch {
    return cached ? { rows: cached.rows as Row[], fetchedAt: cached.fetchedAt } : null;
  }
}

export type InvimaStatus = { status: "ok" | "none" | "unknown"; count: number; checkedAt?: string; note?: string };

// ¿Existe esta presentación (forma + concentración) vigente y activa en el CUM?
export async function verifyPresentation(d: Drug, p: Presentation): Promise<InvimaStatus> {
  const got = await rowsFor(p.atc ?? d.atc);
  if (!got) return { status: "unknown", count: 0 };
  const num = norm(p.cumStrength).replace(/[.,]/g, "[.,]");
  const strength = p.cumRegex ? new RegExp(norm(p.cumRegex)) : new RegExp(`(^|[^0-9.,])${num}\\s*(MG|%|G|UI|MCG)`);
  const forms = p.cumForm.map(norm);
  const count = got.rows.filter((r) => forms.some((f) => r.f.includes(f)) && strength.test(r.t)).length;
  return { status: count > 0 ? "ok" : "none", count, checkedAt: got.fetchedAt.toISOString(), note: count > 0 ? undefined : p.cumNote };
}
