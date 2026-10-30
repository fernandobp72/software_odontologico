import { CONDITIONS, VALID_TEETH, type ConditionKey } from "./catalogs";

// Comandos de voz por reglas (sin IA): el reconocimiento del navegador entrega texto y aquí se
// interpreta con vocabulario fijo. Todo lo que no se entienda se devuelve como aviso, nunca se adivina.

const UNITS: Record<string, number> = { cero: 0, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9 };
const WORD_NUM: Record<string, number> = {
  ...UNITS, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15, dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19,
  veinte: 20, veintiuno: 21, veintiuna: 21, veintidos: 22, veintitres: 23, veinticuatro: 24, veinticinco: 25, veintiseis: 26, veintisiete: 27, veintiocho: 28,
  treinta: 30, cuarenta: 40,
};

const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// Texto → fichas. Los números dichos en palabras pasan a dígitos ("treinta y seis" → "36").
export function tokenize(text: string, mergeDigits: "always" | "after-diente" = "always"): string[] {
  const raw = strip(text)
    .replace(/mesioclusal/g, "mesial oclusal").replace(/distoclusal/g, "distal oclusal")
    .replace(/mesio|disto|vestibulo|linguo|ocluso|palato/g, (m) => ({ mesio: "mesial ", disto: "distal ", vestibulo: "vestibular ", linguo: "lingual ", ocluso: "oclusal ", palato: "palatino " })[m]!)
    .replace(/[^a-z0-9\-\s]/g, " ")
    .split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    const next = raw[i + 1];
    const afterY = raw[i + 2];
    if ((w === "treinta" || w === "cuarenta" || w === "veinte") && next === "y" && afterY && UNITS[afterY] !== undefined && w !== "veinte") {
      out.push(String(WORD_NUM[w] + UNITS[afterY]));
      i += 2;
    } else if (w === "diez" && next === "y" && afterY && UNITS[afterY] !== undefined) {
      out.push(String(10 + UNITS[afterY]));
      i += 2;
    } else if (WORD_NUM[w] !== undefined) out.push(String(WORD_NUM[w]));
    else out.push(w);
  }
  // "1 6" → 16 cuando juntos forman un diente (los dientes se dicen dígito a dígito con frecuencia).
  const merged: string[] = [];
  for (let i = 0; i < out.length; i++) {
    const a = out[i], b = out[i + 1];
    if (/^[1-4]$/.test(a) && b && /^[1-8]$/.test(b) && VALID_TEETH.has(Number(a + b)) && (mergeDigits === "always" || out[i - 1] === "diente")) {
      merged.push(a + b);
      i++;
    } else merged.push(a);
  }
  return merged;
}

const isTooth = (t: string) => /^\d{2}$/.test(t) && VALID_TEETH.has(Number(t));

// ---------- Odontograma ----------

const CONDITION_PHRASES: [string, ConditionKey][] = [
  ["caries de esmalte", "CARIES_ENAMEL"], ["caries esmalte", "CARIES_ENAMEL"], ["mancha blanca", "CARIES_ENAMEL"],
  ["caries de dentina", "CARIES"], ["caries profunda", "CARIES"], ["caries", "CARIES"], ["cariado", "CARIES"], ["cariada", "CARIES"],
  ["obturacion", "FILLING"], ["obturado", "FILLING"], ["obturada", "FILLING"], ["resina", "FILLING"], ["restauracion", "FILLING"], ["empaste", "FILLING"], ["amalgama", "FILLING"], ["ionomero", "FILLING"],
  ["sellante", "SEALANT"], ["sellado", "SEALANT"],
  ["fractura", "FRACTURE"], ["fracturado", "FRACTURE"], ["fracturada", "FRACTURE"],
  ["corona", "CROWN"],
  ["tratamiento de conducto", "ROOT_CANAL"], ["endodoncia", "ROOT_CANAL"], ["conducto", "ROOT_CANAL"],
  ["implante", "IMPLANT"],
  ["retenido", "IMPACTED"], ["retenida", "IMPACTED"], ["impactado", "IMPACTED"], ["impactada", "IMPACTED"], ["incluido", "IMPACTED"], ["incluida", "IMPACTED"],
  ["parcialmente erupcionado", "PARTIAL"], ["parcialmente erupcionada", "PARTIAL"], ["semierupcionado", "PARTIAL"], ["erupcion parcial", "PARTIAL"],
  ["extraido", "EXTRACTED"], ["extraidos", "EXTRACTED"], ["extraida", "EXTRACTED"], ["extraccion", "EXTRACTED"],
  ["ausente", "MISSING"], ["ausentes", "MISSING"], ["falta", "MISSING"], ["faltan", "MISSING"], ["perdido", "MISSING"], ["perdidos", "MISSING"], ["perdida", "MISSING"],
  ["sano", "HEALTHY"], ["sana", "HEALTHY"], ["borrar", "HEALTHY"], ["limpiar", "HEALTHY"], ["quitar", "HEALTHY"],
].sort((a, b) => b[0].split(" ").length - a[0].split(" ").length) as [string, ConditionKey][];

const SURFACE_WORDS: Record<string, string[]> = {
  vestibular: ["V"], bucal: ["V"], lingual: ["L"], palatino: ["L"], palatina: ["L"], mesial: ["M"], distal: ["D"],
  oclusal: ["O"], incisal: ["O"], masticatoria: ["O"], mod: ["M", "O", "D"], mo: ["M", "O"],
};
const WHOLE_WORDS = new Set(["todo", "todas", "completo", "completa", "entero", "entera"]);

export type OdontoCommand = { tooth: number; surfaces: string[] | null; condition: ConditionKey };
export type OdontoParse = { commands: OdontoCommand[]; warnings: string[] };

export function parseOdontogram(text: string, current?: number | null): OdontoParse {
  const tokens = tokenize(text);
  const commands: OdontoCommand[] = [];
  const warnings: string[] = [];
  // El diente seleccionado solo vale si no se nombra ninguno.
  let teeth: number[] = current && !tokens.some(isTooth) ? [current] : [];
  let group: (typeof open)[number] | null = null;
  let preCond: ConditionKey | null = null;
  let pending: string[] = [];
  let pendingWhole = false;
  let open: { teeth: number[]; condition: ConditionKey; surfaces: string[]; whole: boolean }[] = [];
  const emitted: typeof open = [];

  const flush = () => {
    for (const o of emitted) {
      const scope = CONDITIONS[o.condition].scope;
      for (const t of o.teeth) {
        if (o.condition === "HEALTHY" || scope === "tooth") commands.push({ tooth: t, surfaces: null, condition: o.condition });
        else if (o.whole) commands.push({ tooth: t, surfaces: null, condition: o.condition });
        else if (o.surfaces.length) commands.push({ tooth: t, surfaces: [...new Set(o.surfaces)], condition: o.condition });
        else warnings.push(`Diente ${t}: falta la superficie para «${CONDITIONS[o.condition].label}»`);
      }
    }
    emitted.length = 0;
    open = [];
  };

  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    if (isTooth(w)) {
      // Dientes seguidos comparten la misma instrucción; un diente nuevo cierra la anterior.
      if (i > 0 && isTooth(tokens[i - 1])) {
        teeth.push(Number(w));
        group?.teeth.push(Number(w));
      } else {
        flush();
        pending = [];
        pendingWhole = false;
        teeth = [Number(w)];
        group = null;
        if (preCond) {
          // «ausentes 18 28…»: el estado se dijo antes de los dientes.
          group = { teeth: [...teeth], condition: preCond, surfaces: [], whole: false };
          emitted.push(group);
          preCond = null;
        }
      }
      continue;
    }
    let matched = false;
    for (const [phrase, condition] of CONDITION_PHRASES) {
      const p = phrase.split(" ");
      if (p.every((x, k) => tokens[i + k] === x)) {
        // Si lo siguiente es un diente, el estado se dijo antes de los dientes («ausentes 18 28»).
        if (!teeth.length || isTooth(tokens[i + p.length] ?? "")) {
          preCond = condition;
          pending = [];
          pendingWhole = false;
        } else {
          group = null;
          const cmd = { teeth: [...teeth], condition, surfaces: [...pending], whole: pendingWhole };
          emitted.push(cmd);
          open = pending.length || pendingWhole ? [] : [cmd];
        }
        pending = [];
        pendingWhole = false;
        i += p.length - 1;
        matched = true;
        break;
      }
    }
    if (matched) continue;
    if (SURFACE_WORDS[w]) {
      if (open.length) open[0].surfaces.push(...SURFACE_WORDS[w]);
      else pending.push(...SURFACE_WORDS[w]);
    } else if (WHOLE_WORDS.has(w)) {
      if (open.length) open[0].whole = true;
      else pendingWhole = true;
    }
    // Palabras de relleno («diente», «de», «el»…) se ignoran.
  }
  flush();
  if (preCond) warnings.push(`«${CONDITIONS[preCond].label}» sin diente: di el número del diente`);
  if (!commands.length && !warnings.length) warnings.push("No entendí ningún hallazgo. Ejemplo: «diente 16 oclusal mesial caries de dentina»");
  return { commands, warnings };
}

// ---------- Periodontograma ----------

import { emptyTooth, type Perio, type Site } from "./perio";

export type PerioSel = { tooth: number; side: "v" | "l"; col: number };
export type PerioField = "pd" | "gm";

const mesialRight = (t: number) => [1, 4].includes(Math.floor(t / 10));
const anat = (t: number) => (mesialRight(t) ? [0, 1, 2] : [2, 1, 0]);
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

export type PerioResult = { data: Perio; sel: PerioSel; field: PerioField; done: string[]; warnings: string[] };

// Aplica lo dictado sobre el estado actual. Los números se escriben en orden por los 6 sitios del diente
// (igual que el teclado): primero vestibular de izquierda a derecha, luego palatino/lingual.
export function applyPerioVoice(text: string, data: Perio, sel: PerioSel, field: PerioField, order: number[]): PerioResult {
  const tokens = tokenize(text, "after-diente");
  const out = clone(data);
  const done: string[] = [];
  const warnings: string[] = [];
  let cur = { ...sel };
  let fld = field;
  let last: { tooth: number; side: "v" | "l"; idx: number } | null = null;
  let neg = false;

  const tooth = (t: number) => (out[t] ??= emptyTooth());
  const advance = () => {
    const pos = (cur.side === "v" ? 0 : 3) + cur.col;
    if (pos < 5) {
      const n = pos + 1;
      cur = { tooth: cur.tooth, side: n < 3 ? "v" : "l", col: n % 3 };
      return;
    }
    for (let i = order.indexOf(cur.tooth) + 1; i < order.length; i++) {
      if (!out[order[i]]?.missing) { cur = { tooth: order[i], side: "v", col: 0 }; return; }
    }
  };

  for (let i = 0; i < tokens.length; i++) {
    const w = tokens[i];
    if (isTooth(w)) {
      cur = { tooth: Number(w), side: "v", col: 0 };
      last = null;
    } else if (w === "vestibular" || w === "bucal") cur = { ...cur, side: "v", col: 0 };
    else if (w === "lingual" || w === "palatino" || w === "palatina") cur = { ...cur, side: "l", col: 0 };
    else if (w === "recesion") fld = "gm";
    else if (w === "sondaje" || w === "profundidad" || w === "bolsa") fld = "pd";
    else if (w === "menos") neg = true;
    else if (w === "ausente" || w === "falta") {
      tooth(cur.tooth).missing = true;
      done.push(`Diente ${cur.tooth}: ausente`);
    } else if (w === "movilidad" || w === "furca") {
      const n = Number(tokens[i + 1]);
      if (n >= 0 && n <= 3 && tokens[i + 1] !== undefined && /^\d$/.test(tokens[i + 1])) {
        const k = w === "movilidad" ? "mob" : "furc";
        const t = tooth(cur.tooth);
        if (n) t[k] = n; else delete t[k];
        done.push(`Diente ${cur.tooth}: ${w} ${n}`);
        i++;
      } else warnings.push(`Di el grado de ${w} (0 a 3)`);
    } else if (w === "supuracion" || w === "pus") {
      tooth(cur.tooth).sup = true;
      done.push(`Diente ${cur.tooth}: supuración`);
    } else if (w === "sangra" || w === "sangrado" || w === "placa") {
      if (!last) warnings.push(`«${w}» va después de un valor, para saber en qué sitio marcarlo`);
      else {
        const s: Site = tooth(last.tooth)[last.side][last.idx];
        if (w === "placa") s.plq = true; else s.bop = true;
        done.push(`Diente ${last.tooth}: ${w === "placa" ? "placa" : "sangrado"} en el último sitio`);
      }
    } else if (/^\d{1,3}$/.test(w)) {
      // Una ficha de 3 dígitos como «324» son tres valores seguidos.
      const digits = w.length > 1 && !isTooth(w) ? w.split("") : [w];
      for (const d of digits) {
        const t = tooth(cur.tooth);
        if (t.missing) { warnings.push(`El diente ${cur.tooth} está marcado ausente`); break; }
        let v = Number(d);
        if (neg) { v = -v; neg = false; }
        if (fld === "pd" && (v < 0 || v > 12)) { warnings.push(`Sondaje fuera de rango: ${v}`); continue; }
        if (fld === "gm" && (v < -3 || v > 9)) { warnings.push(`Recesión fuera de rango: ${v}`); continue; }
        const idx = anat(cur.tooth)[cur.col];
        t[cur.side][idx][fld] = v;
        last = { tooth: cur.tooth, side: cur.side, idx };
        done.push(`${cur.tooth} ${cur.side === "v" ? "V" : "L"}${cur.col + 1}: ${fld === "pd" ? "" : "rec "}${v}`);
        advance();
      }
    }
  }
  if (!done.length && !warnings.length) warnings.push("No entendí. Ejemplo: «diente 18 vestibular 3 2 3 palatino 4 3 3»");
  return { data: out, sel: cur, field: fld, done, warnings };
}
