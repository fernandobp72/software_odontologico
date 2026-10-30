// Periodontograma: 6 sitios por diente (vestibular y palatino/lingual, cada uno distal, central y mesial).
// Los arreglos de sitios usan el orden anatómico: 0 = distal, 1 = central, 2 = mesial.
export type Site = { pd?: number; gm?: number; bop?: boolean; plq?: boolean };
export type PerioTooth = { missing?: boolean; mob?: number; furc?: number; sup?: boolean; v: Site[]; l: Site[] };
export type Perio = Record<string, PerioTooth>;

export const emptyTooth = (): PerioTooth => ({ v: [{}, {}, {}], l: [{}, {}, {}] });

// Margen gingival: positivo = recesión (el margen está apical a la unión cemento-esmalte).
// Nivel de inserción clínica (NIC) = profundidad de sondaje + recesión.
export const cal = (s: Site) => (s.pd === undefined ? undefined : s.pd + (s.gm ?? 0));

export function sitesOf(t: PerioTooth) {
  return [...t.v, ...t.l];
}

export function hasData(t: PerioTooth) {
  return !!t.missing || !!t.mob || !!t.furc || !!t.sup || sitesOf(t).some((s) => s.pd !== undefined || s.gm !== undefined || s.bop || s.plq);
}

export function summarize(p: Perio) {
  let sites = 0, sumPd = 0, n4 = 0, n6 = 0, bop = 0, plq = 0, maxCal = 0, missing = 0, mobile = 0, furcations = 0, teeth = 0;
  for (const t of Object.values(p)) {
    if (t.missing) { missing++; continue; }
    if ((t.mob ?? 0) >= 1) mobile++;
    if ((t.furc ?? 0) >= 1) furcations++;
    let charted = false;
    for (const s of sitesOf(t)) {
      if (s.pd === undefined) continue;
      charted = true;
      sites++;
      sumPd += s.pd;
      if (s.pd >= 4) n4++;
      if (s.pd >= 6) n6++;
      if (s.bop) bop++;
      if (s.plq) plq++;
      maxCal = Math.max(maxCal, cal(s) ?? 0);
    }
    if (charted) teeth++;
  }
  const pct = (n: number) => (sites ? Math.round((n / sites) * 100) : 0);
  return { teeth, sites, meanPd: sites ? Math.round((sumPd / sites) * 10) / 10 : 0, n4, n6, bopPct: pct(bop), plaquePct: pct(plq), maxCal, missing, mobile, furcations };
}
export type PerioSummary = ReturnType<typeof summarize>;
