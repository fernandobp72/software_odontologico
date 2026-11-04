// Dictado con puntuación hablada: «coma», «punto», «punto y aparte», «dos puntos», «nueva línea»… para que quien tiene las
// manos ocupadas (guantes) no tenga que tocar el teclado. Se usa en la nota de evolución; el reconocimiento entrega la frase
// en minúsculas y sin signos, y aquí se arma el texto con su puntuación y mayúsculas.

const strip = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[.,;:!?¿¡"“”()]/g, "");

type Tok = { k: "w" | "p" | "nl" | "open" | "close"; t: string };

// «punto» seguido de estas palabras es el sustantivo («punto de contacto», «punto de sutura»), no el signo.
const NOT_PUNCT_AFTER = new Set(["de", "del", "por", "en", "con", "para", "a", "la", "el", "entre", "cero", "medio", "critico", "anatomico", "doloroso", "dolorosos", "gatillo"]);

const MULTI: { words: string[]; make: () => Tok[] }[] = [
  { words: ["punto", "y", "aparte"], make: () => [{ k: "p", t: "." }, { k: "nl", t: "\n" }] },
  { words: ["punto", "y", "seguido"], make: () => [{ k: "p", t: "." }] },
  { words: ["punto", "y", "coma"], make: () => [{ k: "p", t: ";" }] },
  { words: ["punto", "final"], make: () => [{ k: "p", t: "." }] },
  { words: ["puntos", "suspensivos"], make: () => [{ k: "p", t: "…" }] },
  { words: ["dos", "puntos"], make: () => [{ k: "p", t: ":" }] },
  { words: ["nueva", "linea"], make: () => [{ k: "nl", t: "\n" }] },
  { words: ["siguiente", "linea"], make: () => [{ k: "nl", t: "\n" }] },
  { words: ["otra", "linea"], make: () => [{ k: "nl", t: "\n" }] },
  { words: ["salto", "de", "linea"], make: () => [{ k: "nl", t: "\n" }] },
  { words: ["nuevo", "parrafo"], make: () => [{ k: "nl", t: "\n\n" }] },
  { words: ["parrafo", "nuevo"], make: () => [{ k: "nl", t: "\n\n" }] },
  { words: ["abrir", "parentesis"], make: () => [{ k: "open", t: "(" }] },
  { words: ["abre", "parentesis"], make: () => [{ k: "open", t: "(" }] },
  { words: ["cerrar", "parentesis"], make: () => [{ k: "close", t: ")" }] },
  { words: ["cierra", "parentesis"], make: () => [{ k: "close", t: ")" }] },
  { words: ["abrir", "comillas"], make: () => [{ k: "open", t: "“" }] },
  { words: ["abre", "comillas"], make: () => [{ k: "open", t: "“" }] },
  { words: ["cerrar", "comillas"], make: () => [{ k: "close", t: "”" }] },
  { words: ["cierra", "comillas"], make: () => [{ k: "close", t: "”" }] },
  { words: ["signo", "de", "interrogacion"], make: () => [{ k: "p", t: "?" }] },
  { words: ["signo", "de", "exclamacion"], make: () => [{ k: "p", t: "!" }] },
];

const UNDO = new Set(["deshacer", "borra eso", "borrar eso", "quita eso", "borra la ultima frase", "borrar la ultima frase", "borrar ultima frase", "deshacer ultima frase", "deshacer eso"]);
export const isUndoCommand = (phrase: string) => UNDO.has(strip(phrase).replace(/\s+/g, " ").trim());

function tokenize(phrase: string): Tok[] {
  const words = phrase.trim().split(/\s+/).filter(Boolean);
  const keys = words.map(strip);
  const out: Tok[] = [];
  for (let i = 0; i < words.length; i++) {
    const m = MULTI.find((c) => c.words.every((w, j) => keys[i + j] === w));
    if (m) { out.push(...m.make()); i += m.words.length - 1; continue; }
    if (keys[i] === "coma" && keys[i - 1] !== "en") { out.push({ k: "p", t: "," }); continue; }
    if (keys[i] === "punto" && !NOT_PUNCT_AFTER.has(keys[i + 1] ?? "")) { out.push({ k: "p", t: "." }); continue; }
    out.push({ k: "w", t: words[i] });
  }
  return out;
}

const upFirst = (s: string) => s.replace(/^(\p{L})/u, (c) => c.toUpperCase());

// Agrega la frase dictada al texto que ya hay, con espacios, signos y mayúsculas.
export function applyDictation(current: string, phrase: string): string {
  const toks = tokenize(phrase);
  if (!toks.length) return current;
  let cap = current.trim() === "" || /[.!?…\n]\s*$/.test(current);
  let out = current;
  let prev: Tok | null = null;
  for (const tk of toks) {
    if (tk.k === "w") {
      const glue = out === "" || /[\n(“]$/.test(out) ? "" : " ";
      out += glue + (cap ? upFirst(tk.t) : tk.t);
      cap = false;
    } else if (tk.k === "p" || tk.k === "close") {
      out = out.replace(/ +$/, "") + tk.t;
      if (/[.!?…]/.test(tk.t)) cap = true;
    } else if (tk.k === "nl") {
      out = out.replace(/ +$/, "") + tk.t;
      cap = true;
    } else if (tk.k === "open") {
      out += (out === "" || /[\n(“]$/.test(out) ? "" : " ") + tk.t;
    }
    prev = tk;
  }
  void prev;
  return out;
}
