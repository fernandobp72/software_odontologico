"use client";

import { useState } from "react";
import { useIsIOS, useSpeech } from "@/lib/use-speech";

// Botón de dictado. Muestra si de verdad está escuchando; si el navegador se queda sin escuchar (pasa en iPhone),
// lo dice y pide un toque para seguir. No se muestra si el navegador no tiene reconocimiento de voz.
export default function VoiceButton({ onPhrase, onInterim, label = "🎤 Dictar" }: { onPhrase: (text: string) => void; onInterim?: (text: string) => void; label?: string }) {
  const { supported, state, message, toggle, heard, last } = useSpeech(onPhrase, onInterim);
  if (!supported) return null;
  const on = state === "listening";
  const cls = on ? "btn bg-red-700 text-white hover:bg-red-800" : state === "starting" ? "btn bg-amber-500 text-slate-900 hover:bg-amber-600" : state === "stalled" ? "btn bg-orange-500 text-slate-900 hover:bg-orange-600" : "btn-secondary";
  const text = on ? "● Escuchando… (toca para detener)" : state === "starting" ? "Preparando micrófono…" : state === "stalled" ? "🎤 Toca para seguir escuchando" : label;
  return (
    <span className="inline-flex flex-col gap-1">
      <button type="button" onClick={toggle} className={cls} aria-pressed={on}>{text}</button>
      {message && <span role="alert" className="error-text max-w-xs">{message}</span>}
      {on && (
        <span role="status" aria-live="polite" className="max-w-xs rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-slate-900">
          <span className="block text-xs font-semibold text-red-800">Se oye: {heard ? <em className="not-italic font-normal">«{heard}»</em> : "…"}</span>
          {last && <span className="block text-xs text-slate-700">Última frase: «{last}»</span>}
          <span className="mt-1 block text-xs text-slate-700">Di «finalizar dictado» para terminar. La pantalla no se apaga mientras escuchas.</span>
        </span>
      )}
    </span>
  );
}

// Respaldo escrito: sirve donde el navegador no reconoce voz y para corregir. En iPhone también se puede dictar con el micrófono del teclado.
export function VoiceBox({ onPhrase }: { onPhrase: (text: string) => void }) {
  const [typed, setTyped] = useState("");
  const ios = useIsIOS();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (typed.trim()) onPhrase(typed.trim());
        setTyped("");
      }}
    >
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        aria-label="Escribir un comando"
        placeholder={ios ? "o dicta aquí con el micrófono del teclado y pulsa Ir" : "o escríbelo aquí y pulsa Enter"}
        enterKeyHint="send"
        className="field mt-0 min-w-0 flex-1"
      />
    </form>
  );
}
