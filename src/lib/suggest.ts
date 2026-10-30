// Reglas que convierten los hallazgos del odontograma y del periodontograma en diagnósticos
// y procedimientos SUGERIDOS. Son un borrador para que el odontólogo lo revise: puede modificar,
// eliminar o agregar. Cada sugerencia tiene una clave estable para no duplicarla al sincronizar.
import { cal, sitesOf, summarize, type Perio } from "./perio";

export type FindingLite = { tooth: number; surface: string | null; condition: string };

export type DxSuggestion = { key: string; code: string; tooth: number | null; note: string };
export type ItemSuggestion = { key: string; procId: string; phase: number; tooth: number | null; surfaces: string; quantity: number; note: string; material?: string };
export type Suggestions = { diagnoses: DxSuggestion[]; items: ItemSuggestion[] };

const SURFACE_ORDER = "VLMDO";
const orderSurfaces = (set: Set<string>) => [...set].sort((a, b) => SURFACE_ORDER.indexOf(a) - SURFACE_ORDER.indexOf(b)).join("");
const quadrantOf = (tooth: number) => Math.floor(tooth / 10);
const position = (tooth: number) => tooth % 10; // 1-3 anteriores, 4-5 premolares, 6-8 molares
const isThirdMolar = (tooth: number) => position(tooth) === 8;

export function suggestFromOdontogram(findings: FindingLite[]): Suggestions {
  const out: Suggestions = { diagnoses: [], items: [] };
  const byTooth = new Map<number, FindingLite[]>();
  for (const f of findings) {
    if (f.condition === "HEALTHY") continue;
    byTooth.set(f.tooth, [...(byTooth.get(f.tooth) ?? []), f]);
  }
  const has = (tooth: number, condition: string, surface?: string) => (byTooth.get(tooth) ?? []).some((f) => f.condition === condition && (surface ? f.surface === surface : true));
  const enamelTeeth: number[] = [];

  for (const [tooth, list] of [...byTooth.entries()].sort((a, b) => a[0] - b[0])) {
    const surf = (c: string) => new Set(list.filter((f) => f.condition === c && f.surface).map((f) => f.surface as string));
    const whole = (c: string) => list.some((f) => f.condition === c && f.surface === null);

    // Caries de esmalte: se maneja con remineralización y control, no con restauración.
    const enamel = surf("CARIES_ENAMEL");
    if (enamel.size || whole("CARIES_ENAMEL")) {
      enamelTeeth.push(tooth);
      const s = orderSurfaces(enamel);
      out.diagnoses.push({ key: `dx:caries-esmalte:${tooth}`, code: "K02.0", tooth, note: `Caries limitada al esmalte${s ? ` (superficies ${s})` : ""}.` });
    }

    // Caries de dentina: restauración, una unidad por superficie.
    const caries = surf("CARIES");
    if (caries.size || whole("CARIES")) {
      const s = orderSurfaces(caries);
      out.diagnoses.push({ key: `dx:caries:${tooth}`, code: "K02.1", tooth, note: `Caries de dentina${s ? ` (superficies ${s})` : ""}.` });
      out.items.push({
        key: `it:obt:${tooth}`, procId: "obt-resina", phase: 2, tooth, surfaces: s, quantity: Math.max(1, caries.size),
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

    // Diente ausente: los terceros molares ausentes no se consideran un hallazgo.
    if (whole("MISSING") && !isThirdMolar(tooth)) {
      out.diagnoses.push({ key: `dx:ausente:${tooth}`, code: "K08.1", tooth, note: "Diente ausente en el odontograma. Valora si requiere reposición." });
    }

    // Retenido / impactado
    if (whole("IMPACTED")) {
      out.diagnoses.push({ key: `dx:impactado:${tooth}`, code: "K01.1", tooth, note: "Diente retenido o impactado." });
      out.items.push({
        key: `it:exo-incluido:${tooth}`, procId: "exo-incluido", phase: 2, tooth, surfaces: "", quantity: 1,
        note: "Valora con radiografía panorámica si hay síntomas o si afecta al diente vecino; si no, puede mantenerse en control.",
      });
    }

    // Parcialmente erupcionado: diagnóstico siempre; exodoncia solo si afecta al segundo molar vecino.
    if (whole("PARTIAL")) {
      out.diagnoses.push({ key: `dx:parcial:${tooth}`, code: "K00.6", tooth, note: "Parcialmente erupcionado: riesgo de pericoronitis y de caries en el diente vecino. Opciones: higiene y control, o exodoncia." });
      const neighbor = tooth - 1;
      if (isThirdMolar(tooth) && (has(neighbor, "CARIES", "D") || has(neighbor, "CARIES_ENAMEL", "D"))) {
        out.items.push({
          key: `it:exo-parcial:${tooth}`, procId: "exo-quir-multi", phase: 2, tooth, surfaces: "", quantity: 1,
          note: `El tercer molar afecta al diente ${neighbor} (caries distal). Valora la exodoncia.`,
        });
      }
    }

    // Endodoncia: posteriores con corona (zirconio por defecto); anteriores, a elegir.
    if (whole("ROOT_CANAL")) {
      if (position(tooth) >= 4) {
        out.items.push({ key: `it:corona-post-endo:${tooth}`, procId: "corona-definitiva", phase: 3, tooth, surfaces: "", quantity: 1, material: "Zirconio", note: "Restauración definitiva posterior a la endodoncia." });
      } else {
        out.items.push({
          key: `it:restauracion-post-endo:${tooth}`, procId: "restauracion-por-definir", phase: 3, tooth, surfaces: "", quantity: 1,
          note: "Elige la restauración definitiva según la estructura remanente: resina directa, carilla o corona.",
        });
      }
    }
  }

  if (enamelTeeth.length) {
    out.items.push({ key: "it:fluor", procId: "fluor-gel", phase: 2, tooth: null, surfaces: "", quantity: 1, note: `Remineralización de las lesiones de esmalte (dientes ${enamelTeeth.join(", ")}).` });
    out.items.push({ key: "it:ctrl-esmalte", procId: "consulta-control", phase: 4, tooth: null, surfaces: "", quantity: 1, note: "Control de las lesiones de esmalte a los 3–6 meses." });
  }
  return out;
}

export function suggestFromPerio(p: Perio | null | undefined): Suggestions {
  const out: Suggestions = { diagnoses: [], items: [] };
  if (!p || !Object.keys(p).length) return out;
  const sum = summarize(p);
  if (!sum.sites) return out;

  const quadrantsDeep = new Set<number>();
  const lossTeeth: number[] = [];
  for (const [t, tooth] of Object.entries(p)) {
    if (tooth.missing) continue;
    const sites = sitesOf(tooth);
    if (sites.some((s) => (s.pd ?? 0) >= 4)) quadrantsDeep.add(quadrantOf(Number(t)));
    // Pérdida de inserción: NIC ≥ 3 mm con sondaje ≥ 4 mm en el mismo sitio (criterio de la clasificación de 2017)
    if (sites.some((s) => (s.pd ?? 0) >= 4 && (cal(s) ?? 0) >= 3)) lossTeeth.push(Number(t));
    // Recesión gingival de 3 mm o más
    if (sites.some((s) => (s.gm ?? 0) >= 3)) {
      out.diagnoses.push({ key: `dx:recesion:${t}`, code: "K06.0", tooth: Number(t), note: "Recesión de 3 mm o más en el periodontograma." });
    }
  }

  // Periodontitis: pérdida de inserción detectable en al menos 2 dientes.
  const periodontitis = lossTeeth.length >= 2;
  const gingivitis = !periodontitis && sum.bopPct >= 10;

  if (periodontitis) {
    out.diagnoses.push({
      key: "dx:periodontitis", code: "K05.3", tooth: null,
      note: `Pérdida de inserción (NIC ≥ 3 mm con sondaje ≥ 4 mm) en ${lossTeeth.length} dientes (${lossTeeth.sort((a, b) => a - b).join(", ")}); NIC máximo ${sum.maxCal} mm, sangrado ${sum.bopPct}%. Define estadio y grado (clasificación 2017).`,
    });
    for (const q of [...quadrantsDeep].sort()) {
      out.items.push({ key: `it:perio-sub:q${q}`, procId: "detartraje-sub", phase: 2, tooth: null, surfaces: "", quantity: 1, note: `Cuadrante ${q}: sitios con sondaje ≥ 4 mm.` });
    }
    out.items.push({ key: "it:perio-reeval", procId: "consulta-control", phase: 4, tooth: null, surfaces: "", quantity: 1, note: "Reevaluación periodontal a las 4–6 semanas del tratamiento." });
  } else if (gingivitis) {
    out.diagnoses.push({ key: "dx:gingivitis", code: "K05.1", tooth: null, note: `Sangrado al sondaje en ${sum.bopPct}% de los sitios, sin pérdida de inserción en 2 o más dientes.` });
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
