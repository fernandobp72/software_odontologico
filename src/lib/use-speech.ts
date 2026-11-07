"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { stopCommand } from "./stop-command";
import { SpeechController, type RecognizerCtor, type SpeechState } from "./speech-controller";

type W = { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };
const getCtor = () => (typeof window === "undefined" ? undefined : (window as unknown as W).SpeechRecognition ?? (window as unknown as W).webkitSpeechRecognition);
const noSubscribe = () => () => {};

// iPhone y iPad (todos sus navegadores usan el motor de Safari) y iPadOS que se presenta como Mac.
export const detectIOS = () => typeof navigator !== "undefined" && (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));
export const useIsIOS = () => useSyncExternalStore(noSubscribe, detectIOS, () => false);

export function useSpeech(onPhrase: (t: string) => void, onInterim?: (t: string) => void) {
  const supported = useSyncExternalStore(noSubscribe, () => !!getCtor(), () => false);
  const [state, setState] = useState<SpeechState>("idle");
  const [message, setMessage] = useState<string>();
  const [heard, setHeard] = useState(""); // lo que se está oyendo ahora (aún sin confirmar)
  const [last, setLast] = useState(""); // última frase entregada
  const ctl = useRef<SpeechController | null>(null);
  const phrase = useRef(onPhrase);
  const interim = useRef(onInterim);
  useEffect(() => { phrase.current = onPhrase; interim.current = onInterim; });
  useEffect(() => () => ctl.current?.stop(), []);

  // Mientras escucha, la pantalla no se apaga (el odontólogo dicta con las manos ocupadas y sin tocar el equipo).
  useEffect(() => {
    if (state !== "listening" && state !== "starting") return;
    type Lock = { release: () => Promise<void> };
    const wl = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<Lock> } }).wakeLock;
    if (!wl) return;
    let lock: Lock | null = null;
    let closed = false;
    const take = () => { wl.request("screen").then((l) => { if (closed) void l.release().catch(() => {}); else lock = l; }).catch(() => {}); };
    const onVisible = () => { if (document.visibilityState === "visible" && !closed) take(); };
    take();
    document.addEventListener("visibilitychange", onVisible);
    return () => { closed = true; document.removeEventListener("visibilitychange", onVisible); void lock?.release().catch(() => {}); };
  }, [state]);

  function toggle() {
    const Ctor = getCtor();
    if (!Ctor) return;
    if (state === "listening" || state === "starting") { ctl.current?.stop(); return; }
    setMessage(undefined);
    // Un controlador nuevo en cada toque: es un gesto válido para el navegador y evita estados viejos.
    ctl.current?.stop();
    ctl.current = new SpeechController({
      ctor: Ctor, ios: detectIOS(),
      onPhrase: (t) => {
        // «finalizar dictado», «terminar odontograma»… detienen el micrófono con la voz; lo dicho antes se conserva.
        const c = stopCommand(t);
        setHeard("");
        if (c.rest) { setLast(c.rest); phrase.current(c.rest); }
        if (c.stop) ctl.current?.stop();
      },
      onInterim: (t) => { setHeard(t); interim.current?.(t); },
      onState: (s, m) => { setState(s); if (s === "idle") setHeard(""); if (m) setMessage(m); },
    });
    ctl.current.start();
  }

  return { supported, state, message, toggle, heard, last };
}
