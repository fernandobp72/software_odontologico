"use client";

import { useRef, useState, useSyncExternalStore } from "react";

type SpeechEvent = { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> };
type Recognizer = { start(): void; stop(): void; lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: SpeechEvent) => void) | null; onend: (() => void) | null };
type RecognizerCtor = new () => Recognizer;
type SpeechWindow = { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };

const speechCtor = () => {
  const w = window as unknown as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
const noSubscribe = () => () => {};

// Escucha frase por frase (continuous=false evita las repeticiones de Chrome en Android) y entrega
// cada frase final a onPhrase. No se muestra si el navegador no tiene reconocimiento de voz.
export default function VoiceButton({ onPhrase, onInterim, label = "🎤 Dictar" }: { onPhrase: (text: string) => void; onInterim?: (text: string) => void; label?: string }) {
  const [listening, setListening] = useState(false);
  const ok = useSyncExternalStore(noSubscribe, () => !!speechCtor(), () => false);
  const want = useRef(false);
  const last = useRef("");
  const handler = useRef(onPhrase);
  handler.current = onPhrase;
  const interim = useRef(onInterim);
  interim.current = onInterim;

  function start() {
    const Ctor = speechCtor();
    if (!Ctor) return;
    const r = new Ctor();
    last.current = "";
    r.lang = "es-CO";
    r.continuous = false;
    r.interimResults = !!interim.current; // los parciales solo avisan (p. ej. marcar el diente); la orden se aplica con el resultado final
    r.onresult = (e) => {
      let text = "";
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript + " ";
        else partial += e.results[i][0].transcript + " ";
      }
      if (partial.trim()) interim.current?.(partial.trim());
      text = text.trim();
      if (!text || text === last.current) return;
      last.current = text;
      handler.current(text);
    };
    r.onend = () => (want.current ? start() : setListening(false));
    try { r.start(); } catch { want.current = false; setListening(false); }
  }

  if (!ok) return null;
  return (
    <button
      type="button"
      onClick={() => {
        if (listening) { want.current = false; setListening(false); return; }
        want.current = true;
        setListening(true);
        start();
      }}
      className={listening ? "btn bg-red-700 text-white hover:bg-red-800" : "btn-secondary"}
      aria-pressed={listening}
    >
      {listening ? "Detener voz" : label}
    </button>
  );
}

// Respaldo escrito: sirve donde el navegador no reconoce voz (Firefox, algunos iPhone) y para corregir.
export function VoiceBox({ onPhrase }: { onPhrase: (text: string) => void }) {
  const [typed, setTyped] = useState("");
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (typed.trim()) onPhrase(typed.trim());
        setTyped("");
      }}
    >
      <input value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Escribir un comando" placeholder="o escríbelo aquí y pulsa Enter" className="field mt-0 min-w-0 flex-1" />
    </form>
  );
}
