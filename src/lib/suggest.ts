// Reglas que convierten los hallazgos del odontograma y del periodontograma en diagnósticos
// y procedimientos SUGERIDOS. Son un borrador para que el odontólogo lo revise: puede modificar,
// eliminar o agregar. Cada sugerencia tiene una clave estable para no duplicarla al sincronizar.
import { cal, sitesOf, summarize, type Perio } from "./perio";

export type FindingLite = { tooth: number; surface: string | null; condition: string };

export type DxSuggestion = { key: string; code: string; tooth: number | null; note: string };
export type ItemSuggestion = { key: string; procId: string; phase: number; tooth: number | null; surfaces: string; quantity: number; note: string };
export type Suggestions = { diagnoses: DxSuggestion[]; items: ItemSuggestion[] };

const SURFACE_ORDER = "VLMDO";
const orderSurfaces = (set: Set<string>) => [...set].sort((a, b) => SURFACE_ORDER.indexOf(a) - SURFACE_ORDER.indexOf(b)).join("");
const quadrantOf = (tooth: number) => Math.floor(tooth / 10);

export function suggestFromOdontogram(findings: FindingLite[]): Suggestions {
  const out: Suggestions = { diagnoses: [], items: [] };
  const byTooth = new Map<number, FindingLite[]>();
  for (const f of findings) {
    if (f.condition === "HEALTHY") continue;
    byTooth.set(f.tooth, [...(byTooth.get(f.tooth) ?? []), f]);
  }

  for (const [tooth, list] of [...byTooth.entries()].sort((a, b) => a[0] - b[0])) {
    const surf = (c: string) => new Set(list.filter((f) => f.condition === c && f.surface).map((f) => f.surface as string));
    const whole = (c: string) => list.some((f) => f.condition === c && f.surface === null);

    // Caries
    const caries = surf("CARIES");
    if (caries.size || whole("CARIES")) {
      const s = orderSurfaces(caries);
      out.diagnoses.push({ key: `dx:caries:${tooth}`, code: "K02.1", tooth, note: `Caries marcada en el odontograma${s ? ` (superficies ${s})` : ""}. Cambia a K02.0 si es limitada al esmalte.` });
      out.items.push({
        key: `it:obt:${tooth}`, procId: "obt-resina", phase: 2, tooth, surfaces: s,
        quantity: Math.max(1, caries.size),
        note: s ? "Restauración de las superficies con caries." : "Caries en todo el diente: define las superficies o evalúa otra restauración.",
      });
    }

    // Fractura
    const frac = surf("FRACTURE");
    if (frac.size || whole("FRACTURE")) {
      const s = orderSurfaces(frac);
      out.diagnoses.push({ key: `dx:fractura:${tooth}`, code: "S02.5", tooth, note: `Fractura marcada en el odontograma${s ? ` (superficies ${s})` : ""}.` });
      out.items.push({
        key: `it:fractura:${tooth}`, procId: "obt-resina", phase: 1, tooth, surfaces: s, quantity: Math.max(1, frac.size),
        note: s ? "Restauración de la fractura." : "Fractura de todo el diente: evalúa restauración o corona.",
      });
    }

    // Diente ausente
    if (whole("MISSING")) {
      out.diagnoses.push({ key: `dx:ausente:${tooth}`, code: "K08.1", tooth, note: "Diente ausente en el odontograma. Valora si requiere reposición." });
    }

    // Endodoncia: la restauración definitiva es el paso siguiente habitual
    if (whole("ROOT_CANAL")) {
      out.items.push({ key: `it:corona-post-endo:${tooth}`, procId: "corona-definitiva", phase: 3, tooth, surfaces: "", quantity: 1, note: "Restauración definitiva posterior a la endodoncia." });
    }
  }
  return out;
}

export function suggestFromPerio(p: Perio | null | undefined): Suggestions {
  const out: Suggestions = { diagnoses: [], items: [] };
  if (!p || !Object.keys(p).length) return out;
  const sum = summarize(p);
  if (!sum.sites) return out;

  const quadrantsDeep = new Set<number>();
  for (const [t, tooth] of Object.entries(p)) {
    if (tooth.missing) continue;
    if (sitesOf(tooth).some((s) => (s.pd ?? 0) >= 4)) quadrantsDeep.add(quadrantOf(Number(t)));
    // Recesión gingival de 3 mm o más
    if (sitesOf(tooth).some((s) => (s.gm ?? 0) >= 3)) {
      out.diagnoses.push({ key: `dx:recesion:${t}`, code: "K06.0", tooth: Number(t), note: "Recesión de 3 mm o más en el periodontograma." });
    }
  }

  const periodontitis = sum.n4 >= 4 && sum.maxCal >= 3;
  const gingivitis = !periodontitis && sum.bopPct >= 10;

  if (periodontitis) {
    out.diagnoses.push({
      key: "dx:periodontitis", code: "K05.3", tooth: null,
      note: `Sondaje ≥ 4 mm en ${sum.n4} sitios, NIC máximo ${sum.maxCal} mm, sangrado ${sum.bopPct}%. Define estadio y grado (clasificación 2017).`,
    });
    for (const q of [...quadrantsDeep].sort()) {
      out.items.push({ key: `it:perio-sub:q${q}`, procId: "detartraje-sub", phase: 2, tooth: null, surfaces: "", quantity: 1, note: `Cuadrante ${q}: sitios con sondaje ≥ 4 mm.` });
    }
    out.items.push({ key: "it:perio-reeval", procId: "consulta-control", phase: 4, tooth: null, surfaces: "", quantity: 1, note: "Reevaluación periodontal a las 4–6 semanas del tratamiento." });
  } else if (gingivitis) {
    out.diagnoses.push({ key: "dx:gingivitis", code: "K05.1", tooth: null, note: `Sangrado al sondaje en ${sum.bopPct}% de los sitios, sin pérdida de inserción relevante.` });
  }

  if (periodontitis || gingivitis) {
    out.items.push({ key: "it:detartraje-supra", procId: "detartraje-supra", phase: 2, tooth: null, surfaces: "", quantity: 1, note: "Control de placa y cálculo previo a otros tratamientos." });
    out.items.push({ key: "it:educacion-higiene", procId: "educacion-higiene", phase: 2, tooth: null, surfaces: "", quantity: 1, note: "Instrucción de higiene oral." });
  }
  return out;
}

export function suggestAll(findings: FindingLite[], perio: Perio | null | undefined): Suggestions {
  const a = suggestFromOdontogram(findings);
  const b = suggestFromPerio(perio);
  return { diagnoses: [...a.diagnoses, ...b.diagnoses], items: [...a.items, ...b.items] };
}

export { cal };
