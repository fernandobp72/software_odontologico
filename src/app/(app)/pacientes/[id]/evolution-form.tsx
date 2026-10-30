"use client";

import { useActionState, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { CIE10, CUPS, NOTE_TEMPLATES } from "@/lib/catalogs";
import { signEvolution, type EvolutionState } from "./actions";

type SpeechEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>> };
type Recognizer = { start(): void; stop(): void; lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: SpeechEvent) => void) | null; onend: (() => void) | null };
type RecognizerCtor = new () => Recognizer;
type SpeechWindow = { SpeechRecognition?: RecognizerCtor; webkitSpeechRecognition?: RecognizerCtor };

const speechCtor = () => {
  const w = window as unknown as SpeechWindow;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
};
const noSubscribe = () => () => {};

export default function EvolutionForm({ patientId }: { patientId: string }) {
  const [note, setNote] = useState("");
  const [state, action, pending] = useActionState(async (prev: EvolutionState, fd: FormData) => {
    const res = await signEvolution(prev, fd);
    if (res?.ok) setNote("");
    return res;
  }, undefined);
  const draftKey = `evolucion-${patientId}`;
  const [listening, setListening] = useState(false);
  const voiceOk = useSyncExternalStore(noSubscribe, () => !!speechCtor(), () => false);
  const rec = useRef<Recognizer | null>(null);

  useEffect(() => {
    // Recupera el borrador guardado en este dispositivo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setNote(localStorage.getItem(draftKey) ?? ""); } catch {}
  }, [draftKey]);

  useEffect(() => {
    try { if (note) localStorage.setItem(draftKey, note); else localStorage.removeItem(draftKey); } catch {}
  }, [note, draftKey]);

  function toggleVoice() {
    if (listening) return rec.current?.stop();
    const Ctor = speechCtor();
    if (!Ctor) return;
    const r = new Ctor();
    r.lang = "es-CO";
    r.continuous = true;
    r.interimResults = false;
    r.onresult = (e) => {
      const last = e.results[e.results.length - 1][0].transcript;
      setNote((cur) => (cur ? cur + " " : "") + last.trim());
    };
    r.onend = () => setListening(false);
    rec.current = r;
    r.start();
    setListening(true);
  }

  return (
    <form action={action} className="card space-y-4">
      <h2 className="section-title">Nueva evolución</h2>
      <input type="hidden" name="patientId" value={patientId} />
      <label className="label">Motivo de consulta<input name="reason" className="field" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">Diagnóstico (CIE-10)
          <input name="diagnosisCode" list="cie10" placeholder="K02.1" className="field" />
        </label>
        <label className="label">Procedimiento (CUPS)
          <input name="procedureCode" list="cups" inputMode="numeric" placeholder="890303" className="field" />
        </label>
      </div>
      <datalist id="cie10">{CIE10.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</datalist>
      <datalist id="cups">{CUPS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</datalist>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="note" className="label">Evolución</label>
          {voiceOk && (
            <button type="button" onClick={toggleVoice} className={listening ? "btn bg-red-700 text-white hover:bg-red-800" : "btn-secondary"}>
              {listening ? "Detener dictado" : "🎤 Dictar"}
            </button>
          )}
        </div>
        <textarea id="note" name="note" rows={5} value={note} onChange={(e) => setNote(e.target.value)} className="field" />
        <div className="mt-2 flex flex-wrap gap-2">
          {NOTE_TEMPLATES.map((t) => (
            <button key={t} type="button" onClick={() => setNote((cur) => (cur ? cur + " " : "") + t)} className="min-h-9 rounded-full border border-slate-500 bg-white px-3 py-1 text-sm text-slate-900 hover:bg-slate-100">
              {t.split(" ").slice(0, 4).join(" ")}…
            </button>
          ))}
        </div>
      </div>

      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Evolución firmada</p>}
      <button disabled={pending} className="btn-primary w-full md:w-auto">
        {pending ? "Firmando…" : "Firmar evolución"}
      </button>
      <p className="muted">Una vez firmada no se puede editar; las correcciones se registran como una nueva evolución.</p>
    </form>
  );
}
