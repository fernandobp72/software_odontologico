// Inventario por voz, por reglas (sin IA): el reconocimiento del navegador entrega texto y aquí se arma una lista de borradores
// (ingresos y salidas) que la persona revisa antes de guardar. Lo que no se entienda con seguridad queda marcado, nunca se adivina.

export type VoiceItem = { id: string; name: string; category: string; unit: string; packLabel: string | null; packSize: number | null };
export type Draft = {
  key: string;
  kind: "IN" | "OUT";
  itemId: string | null;
  candidates: { id: string; name: string }[];
  quantity: number;
  inPack: boolean;
  expiresAt: string; // YYYY-MM-DD o ""
  heard: string;
  warnings: string[];
};

const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const ONES: Record<string, number> = { cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
const TEENS: Record<string, number> = { diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20, veintiun: 21, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28, veintinueve: 29 };
const TENS: Record<string, number> = { treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70, ochenta: 80, noventa: 90 };
const HUNDREDS: Record<string, number> = { cien: 100, ciento: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500, seiscientos: 600, setecientos: 700, ochocientos: 800, novecientos: 900 };
const isNumWord = (w: string) => w in ONES || w in TEENS || w in TENS || w in HUNDREDS || w === "mil";

// Números dichos en palabras → dígitos: «dos mil veintiocho» → 2028, «treinta y cinco» → 35, «una docena» → 12.
function numberTokens(raw: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    if (w === "media" && raw[i + 1] === "docena") { out.push("6"); i++; continue; }
    if (!isNumWord(w)) { out.push(w); continue; }
    let total = 0, cur = 0, j = i;
    for (; j < raw.length; j++) {
      const t = raw[j];
      if (t in ONES) cur += ONES[t];
      else if (t in TEENS) cur += TEENS[t];
      else if (t in TENS) cur += TENS[t];
      else if (t in HUNDREDS) cur += HUNDREDS[t];
      else if (t === "mil") { total += (cur || 1) * 1000; cur = 0; }
      else if (t === "y" && raw[j - 1] in TENS && raw[j + 1] in ONES) continue;
      else break;
    }
    let n = total + cur;
    if (raw[j] === "docena" || raw[j] === "docenas") { n *= 12; j++; }
    out.push(String(n));
    i = j - 1;
  }
  return out;
}

const IN_VERBS = new Set(["entraron", "entro", "ingresaron", "ingreso", "ingresamos", "llegaron", "llego", "recibi", "recibimos", "recibieron", "compre", "compramos", "agregue", "agregamos", "anadi", "anadimos", "entrada", "ingresar", "entran"]);
const OUT_VERBS = new Set(["salieron", "salio", "gaste", "gastamos", "gastaron", "use", "usamos", "usaron", "saque", "sacamos", "sacaron", "consumi", "consumimos", "consumieron", "salida", "descarte", "descartamos", "salen"]);
const EXPIRY = new Set(["vence", "vencen", "vencimiento", "vencia", "caduca", "caducan", "caducidad", "vencera", "vencieron"]);
const MONTHS: Record<string, number> = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
const STOP = new Set(["de", "del", "la", "el", "los", "las", "con", "para", "y", "e", "al", "en", "por", "ciento", "porciento", "mg", "ml", "a", "que", "lote", "numero", "nuevo", "nueva", "nuevos", "nuevas", "otra", "otro", "otras", "otros", "mas", "tambien", "ademas", "luego", "de", "un", "una", "unos", "unas", "ese", "esa", "se", "me", "nos", "hoy", "ayer"]);

const stem = (w: string) => (w.length > 4 && w.endsWith("es") ? w.slice(0, -2) : w.length > 3 && w.endsWith("s") ? w.slice(0, -1) : w);
const UNIT_STEMS = new Set(["caja", "paquete", "bolsa", "frasco", "tubo", "jeringa", "kit", "sobre", "unidad", "par", "carpule", "aplicacion", "aguja", "pieza", "docena"]);
// «cajas» → «caja», «carpules» → «carpule», «aplicaciones» → «aplicacion», «pares» → «par»; "" si no es una unidad conocida.
const unitOf = (w: string) => [w, w.replace(/s$/, ""), w.replace(/es$/, "")].find((c) => UNIT_STEMS.has(c)) ?? "";

const iso = (y: number, m: number, d: number) => `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();
const year = (n: number) => (n < 100 ? 2000 + n : n);

// «marzo de 2028», «15 de marzo del 28», «03 2028», «en seis meses», «en 2 años» → fecha (sin día = último día del mes).
export function parseExpiry(tokens: string[], today = new Date()): string {
  const t = tokens.filter((x) => !["de", "del", "el", "en", "a", "para"].includes(x));
  const ty = today.getUTCFullYear(), tm = today.getUTCMonth() + 1;
  const mi = t.findIndex((x) => x in MONTHS);
  if (mi >= 0) {
    const m = MONTHS[t[mi]];
    const yTok = t.slice(mi + 1).find((x) => /^\d{2}$|^\d{4}$/.test(x));
    const dTok = mi > 0 && /^\d{1,2}$/.test(t[mi - 1]) ? Number(t[mi - 1]) : null;
    const y = yTok ? year(Number(yTok)) : m >= tm ? ty : ty + 1;
    const d = dTok && dTok >= 1 && dTok <= lastDay(y, m) ? dTok : lastDay(y, m);
    return iso(y, m, d);
  }
  const nums = t.filter((x) => /^\d+$/.test(x));
  const rel = t.findIndex((x) => /^(mes|meses|ano|anos|semana|semanas|dia|dias)$/.test(x));
  if (rel > 0 && /^\d+$/.test(t[rel - 1])) {
    const n = Number(t[rel - 1]);
    const d = new Date(Date.UTC(ty, tm - 1, today.getUTCDate()));
    const u = t[rel];
    if (u.startsWith("mes")) d.setUTCMonth(d.getUTCMonth() + n);
    else if (u.startsWith("ano")) d.setUTCFullYear(d.getUTCFullYear() + n);
    else if (u.startsWith("semana")) d.setUTCDate(d.getUTCDate() + 7 * n);
    else d.setUTCDate(d.getUTCDate() + n);
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  if (nums.length >= 2 && Number(nums[0]) >= 1 && Number(nums[0]) <= 12 && /^\d{2,4}$/.test(nums[1]) && nums.length === 2) {
    const y = year(Number(nums[1]));
    return iso(y, Number(nums[0]), lastDay(y, Number(nums[0])));
  }
  if (nums.length >= 3 && /^\d{4}$/.test(nums[2]) && Number(nums[1]) >= 1 && Number(nums[1]) <= 12) {
    const y = Number(nums[2]), m = Number(nums[1]);
    return iso(y, m, Math.min(Math.max(Number(nums[0]), 1), lastDay(y, m)));
  }
  return "";
}

function score(phrase: string[], item: VoiceItem) {
  const P = [...new Set(phrase.map(stem))];
  if (!P.length) return 0;
  const N = new Set(strip(item.name).replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w) && !/^\d+$/.test(w)).map(stem));
  const C = new Set(strip(item.category).split(/\s+/).map(stem));
  const hit = (p: string, set: Set<string>) => set.has(p) || [...set].some((n) => n.length >= 5 && p.length >= 5 && (n.startsWith(p) || p.startsWith(n)));
  const inName = P.filter((p) => hit(p, N)).length;
  const inCat = P.filter((p) => !hit(p, N) && hit(p, C)).length;
  return ((inName + 0.4 * inCat) / P.length) * 0.7 + (inName / Math.max(N.size, 1)) * 0.3;
}

export function matchItem(phrase: string[], items: VoiceItem[]): { itemId: string | null; candidates: { id: string; name: string }[] } {
  const ranked = items.map((i) => ({ i, s: score(phrase, i) })).filter((x) => x.s >= 0.25).sort((a, b) => b.s - a.s);
  const [a, b] = ranked;
  const sure = a && a.s >= 0.55 && (!b || a.s - b.s >= 0.15);
  return { itemId: sure ? a.i.id : null, candidates: ranked.slice(0, 4).map((x) => ({ id: x.i.id, name: x.i.name })) };
}

export function parseInventory(text: string, items: VoiceItem[], today = new Date()): Draft[] {
  const raw = strip(text).replace(/[,.;:]/g, " ; ").replace(/%/g, " porciento ").replace(/[^a-z0-9;\s]/g, " ").split(/\s+/).filter(Boolean);
  const tok = numberTokens(raw);

  // Trozos: cada verbo abre uno nuevo; «,» o «y» seguido de una cantidad también.
  type Chunk = { kind: "IN" | "OUT" | null; t: string[] };
  const chunks: Chunk[] = [];
  let verb: "IN" | "OUT" | null = null;
  let cur: Chunk = { kind: null, t: [] };
  const flush = () => { if (cur.t.length) chunks.push(cur); };
  for (let i = 0; i < tok.length; i++) {
    const w = tok[i];
    const v = IN_VERBS.has(w) ? "IN" : OUT_VERBS.has(w) ? "OUT" : null;
    if (v) { flush(); verb = v; cur = { kind: v, t: [] }; continue; }
    if (w === ";" || (w === "y" && /^\d+$/.test(tok[i + 1] ?? "") && unitOf(tok[i + 2] ?? ""))) {
      flush(); cur = { kind: verb, t: [] };
      continue;
    }
    cur.t.push(w);
  }
  flush();

  const drafts: Draft[] = [];
  chunks.forEach((c, idx) => {
    const t = c.t;
    const ex = t.findIndex((w) => EXPIRY.has(w));
    const head = ex >= 0 ? t.slice(0, ex) : t;
    const tail = ex >= 0 ? t.slice(ex + 1) : [];
    const warnings: string[] = [];
    const digits = head.map((w, i) => ({ w, i })).filter((x) => /^\d+$/.test(x.w) && !["por", "porciento"].includes(head[x.i + 1] ?? ""));
    const withUnit = digits.find((x) => unitOf(head[x.i + 1] ?? ""));
    const q = withUnit ?? digits[0];
    const quantity = q ? Number(q.w) : 0;
    const unitWord = q ? unitOf(head[q.i + 1] ?? "") : "";
    const phrase = head.filter((w, i) => w !== ";" && i !== q?.i && !(q && i === q.i + 1 && unitWord) && !STOP.has(w) && !/^\d+$/.test(w));
    const m = matchItem(phrase, items);
    const item = items.find((i) => i.id === m.itemId);
    const inPack = !!(item?.packLabel && item.packSize && unitWord && unitWord === unitOf(strip(item.packLabel)) && unitWord !== unitOf(strip(item.unit)));
    const kind = c.kind ?? (ex >= 0 ? "IN" : "OUT");
    if (!c.kind) warnings.push("No oí si entró o salió: revísalo");
    if (!quantity) warnings.push("No oí la cantidad");
    if (item && unitWord && unitWord !== unitOf(strip(item.unit)) && !inPack) warnings.push(`Ese producto se cuenta en ${item.unit}${item.packLabel ? ` o en ${item.packLabel}` : ""}: revisa la cantidad`);
    if (!m.itemId) warnings.push(m.candidates.length ? "Elige el producto" : "No reconocí el producto");
    const expiresAt = tail.length ? parseExpiry(tail, today) : "";
    if (tail.length && !expiresAt) warnings.push("No entendí la fecha de vencimiento");
    if (!phrase.length && !quantity) return;
    drafts.push({ key: `${idx}`, kind, itemId: m.itemId, candidates: m.candidates, quantity, inPack, expiresAt, heard: t.filter((w) => w !== ";").join(" "), warnings });
  });
  return drafts;
}
