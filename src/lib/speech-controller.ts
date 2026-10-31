// Controlador del reconocimiento de voz del navegador, sin React para poder probarlo.
//
// Safari en iPhone se comporta distinto a Chrome: la sesión se corta sola tras la primera frase o un silencio, y reiniciarla
// en el mismo instante a veces no escucha nada sin avisar. Por eso:
//  - en iPhone/iPad se usa el modo continuo (una sola sesión larga) y cada resultado final se entrega una sola vez;
//  - en los demás navegadores se escucha frase por frase (modo no continuo evita las repeticiones de Chrome en Android);
//  - al terminar una sesión se reinicia tras una pausa corta, no de inmediato;
//  - si el reinicio no llega a «escuchar» (onstart) pasa a «stalled» y se pide un toque, que sí cuenta como gesto del usuario.

export type SpeechState = "idle" | "starting" | "listening" | "stalled";

export type RecognizerLike = {
  lang: string; continuous: boolean; interimResults: boolean;
  onstart: (() => void) | null;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void; stop(): void; abort(): void;
};
export type RecognizerCtor = new () => RecognizerLike;

export type SpeechOptions = {
  ctor: RecognizerCtor;
  ios: boolean;
  onPhrase: (text: string) => void;
  onInterim?: (text: string) => void;
  onState: (s: SpeechState, message?: string) => void;
  restartDelayMs?: number;
  startTimeoutMs?: number;
  lang?: string;
};

export class SpeechController {
  private want = false;
  private rec: RecognizerLike | null = null;
  private state: SpeechState = "idle";
  private lastHeard = "";
  private done = new Set<number>(); // resultados finales ya entregados (modo continuo)
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private failures = 0;

  constructor(private o: SpeechOptions) {}

  private set(s: SpeechState, message?: string) {
    this.state = s;
    this.o.onState(s, message);
  }

  private clearTimers() {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.watchdog) clearTimeout(this.watchdog);
    this.restartTimer = this.watchdog = null;
  }

  // Debe llamarse desde un toque del usuario (el navegador lo exige para empezar a escuchar).
  start() {
    this.want = true;
    this.failures = 0;
    this.begin();
  }

  stop() {
    this.want = false;
    this.clearTimers();
    const r = this.rec;
    this.rec = null;
    try { r?.stop(); } catch { /* ya estaba detenido */ }
    this.set("idle");
  }

  private begin() {
    this.clearTimers();
    const prev = this.rec;
    if (prev) { prev.onend = prev.onresult = prev.onerror = prev.onstart = null; try { prev.abort(); } catch { /* nada */ } }
    const r = new this.o.ctor();
    this.rec = r;
    this.lastHeard = "";
    this.done.clear();
    r.lang = this.o.lang ?? "es-CO";
    r.continuous = this.o.ios;
    r.interimResults = this.o.ios || !!this.o.onInterim;
    r.onstart = () => {
      if (this.rec !== r) return;
      if (this.watchdog) clearTimeout(this.watchdog);
      this.failures = 0;
      this.set("listening");
    };
    r.onresult = (e) => {
      if (this.rec !== r) return;
      let partial = "";
      const finals: string[] = [];
      for (let i = this.o.ios ? 0 : e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        const text = res[0]?.transcript ?? "";
        if (res.isFinal) {
          if (this.done.has(i)) continue;
          this.done.add(i);
          finals.push(text);
        } else partial += `${text} `;
      }
      if (partial.trim()) this.o.onInterim?.(partial.trim());
      for (const f of finals) {
        const text = f.trim();
        if (!text) continue;
        if (!this.o.ios && text === this.lastHeard) continue; // Chrome en Android repite resultados
        this.lastHeard = text;
        this.o.onPhrase(text);
      }
    };
    r.onerror = (e) => {
      if (this.rec !== r) return;
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        this.want = false;
        this.clearTimers();
        this.set("idle", "El navegador no tiene permiso para usar el micrófono. Actívalo en los ajustes del sitio y vuelve a intentar.");
      } else if (e.error === "audio-capture") {
        this.want = false;
        this.clearTimers();
        this.set("idle", "No se encontró un micrófono disponible.");
      }
      // «no-speech» y «aborted» son normales: onend decide si se reinicia.
    };
    r.onend = () => {
      if (this.rec !== r) return;
      if (!this.want) { this.set("idle"); return; }
      this.schedule();
    };
    this.set("starting");
    try {
      r.start();
      // Si no empieza a escuchar, se avisa en vez de quedarse mudo.
      this.watchdog = setTimeout(() => {
        if (this.rec === r && this.state !== "listening") this.stall(r);
      }, this.o.startTimeoutMs ?? 2500);
    } catch {
      this.stall(r);
    }
  }

  private schedule() {
    this.set("starting");
    this.restartTimer = setTimeout(() => { if (this.want) this.begin(); }, this.o.restartDelayMs ?? 350);
  }

  private stall(r: RecognizerLike) {
    this.failures++;
    try { r.abort(); } catch { /* nada */ }
    this.clearTimers();
    // Un reintento automático más; si tampoco sirve hace falta un toque del usuario.
    if (this.failures < 2 && this.want) { this.schedule(); return; }
    this.rec = null;
    this.set("stalled");
  }
}
