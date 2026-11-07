// Orden de voz para terminar de dictar: «finalizar dictado», «terminar odontograma», «detener», «fin del dictado»…
// Funciona sola o al final de una frase («…y eso es todo, finalizar dictado»): lo anterior se conserva y se apaga el micrófono.
const WORDS = "finalizar|finaliza|finalice|terminar|termina|termine|detener|detén|deten|parar|fin|cerrar|cierra|apagar|apaga";
const OBJECT = "(?:(?:de|del|el|la|los|las|mi|mis)\\s+)?(?:dictado|dictar|odontograma|periodontograma|inventario|evolucion|evolución|nota|grabacion|grabación|microfono|micrófono|voz|escucha|escuchar|todo)";
const RE = new RegExp(`(?:^|[\\s,.;:¡!¿?])(?:${WORDS})\\s+${OBJECT}[\\s.,;:!?]*$`, "i");
const ONLY = /^(?:finalizar|finaliza|terminar|detener|deten|detén|parar)[\s.,;:!?]*$/i;

export function stopCommand(text: string): { stop: boolean; rest: string } {
  const t = text.trim();
  if (ONLY.test(t)) return { stop: true, rest: "" };
  const m = RE.exec(t);
  if (!m) return { stop: false, rest: t };
  return { stop: true, rest: t.slice(0, m.index).trim().replace(/[\s,;:]+$/, "").replace(/\s+(?:y|e|ya)$/i, "") };
}
