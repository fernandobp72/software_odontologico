"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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
  const ctl = useRef<SpeechController | null>(null);
  const phrase = useRef(onPhrase);
  const interim = useRef(onInterim);
  useEffect(() => { phrase.current = onPhrase; interim.current = onInterim; });
  useEffect(() => () => ctl.current?.stop(), []);

  function toggle() {
    const Ctor = getCtor();
    if (!Ctor) return;
    if (state === "listening" || state === "starting") { ctl.current?.stop(); return; }
    setMessage(undefined);
    // Un controlador nuevo en cada toque: es un gesto válido para el navegador y evita estados viejos.
    ctl.current?.stop();
    ctl.current = new SpeechController({
      ctor: Ctor, ios: detectIOS(),
      onPhrase: (t) => phrase.current(t),
      onInterim: interim.current ? (t) => interim.current?.(t) : undefined,
      onState: (s, m) => { setState(s); if (m) setMessage(m); },
    });
    ctl.current.start();
  }

  return { supported, state, message, toggle };
}
