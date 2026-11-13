"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { CIE10, CUPS, NOTE_TEMPLATES } from "@/lib/catalogs";
import { applyDictation, isUndoCommand } from "@/lib/dictation";
import { buildEvolutionText, replaceBlock, type DoneItem } from "@/lib/evolution-text";
import { prepareEvolutionSign, signEvolution, type EvolutionState } from "./actions";
import { useSello } from "../../sello-client";
import VoiceButton from "./voice-button";
import { addPhrase, removePhrase } from "./phrase-actions";

export type Phrase = { id: string; label: string; text: string };

type AttendingAppointment = { id: string; time: string; reason: string | null };

// Con «appointment» (cita de hoy o la que llega desde «Atender»), la evolución se liga a la cita: el motivo viene precargado
// y al firmar la cita queda como atendida.
export default function EvolutionForm({ patientId, openItems = [], appointment = null, phrases = [] }: { patientId: string; openItems?: DoneItem[]; appointment?: AttendingAppointment | null; phrases?: Phrase[] }) {
  const [note, setNote] = useState("");
  const [reason, setReason] = useState(appointment?.reason ?? "");
  const [phraseMsg, setPhraseMsg] = useState<string>();
  const [phraseLabel, setPhraseLabel] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [dx, setDx] = useState("");
  const [proc, setProc] = useState("");
  const noteRef = useRef("");
  const history = useRef<string[]>([]); // notas anteriores, para «deshacer» por voz
  const block = useRef(""); // texto que redactó el sistema, para reemplazarlo sin tocar lo que escribas
  const autoDx = useRef("");
  const autoProc = useRef("");
  const { confirm, dialog } = useSello();
  const [state, action, pending] = useActionState(async (prev: EvolutionState, fd: FormData) => {
    // Sello digital: primero se prepara lo que firma el dispositivo y el profesional lo confirma.
    const c = await confirm(await prepareEvolutionSign(fd));
    if (c.error) return { error: c.error };
    fd.set("proof", c.proof ?? "");
    const res = await signEvolution(prev, fd);
    if (res?.ok) {
      setNote("");
      setReason("");
      setChecked([]);
      setDx("");
      setProc("");
      block.current = "";
      autoDx.current = "";
      autoProc.current = "";
    }
    return res;
  }, undefined);
  const draftKey = `evolucion-${patientId}`;

  useEffect(() => {
    // Recupera el borrador guardado en este dispositivo: nota, motivo y códigos (los borradores viejos solo traían la nota).
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      let d: { note?: string; reason?: string; dx?: string; proc?: string } = { note: raw };
      try { const j = JSON.parse(raw); if (j && typeof j === "object") d = j; } catch {}
      /* eslint-disable react-hooks/set-state-in-effect */
      if (d.note) setNote(d.note);
      if (d.reason) setReason(d.reason);
      if (d.dx) setDx(d.dx);
      if (d.proc) setProc(d.proc);
      /* eslint-enable react-hooks/set-state-in-effect */
    } catch {}
  }, [draftKey]);

  useEffect(() => {
    noteRef.current = note;
  }, [note]);

  // Dictado: entiende «coma», «punto», «punto y aparte», «dos puntos», «nueva línea» y «deshacer».
  function dictate(text: string) {
    if (isUndoCommand(text)) {
      const prev = history.current.pop();
      if (prev !== undefined) { noteRef.current = prev; setNote(prev); }
      return;
    }
    const next = applyDictation(noteRef.current, text);
    if (next === noteRef.current) return;
    history.current = [...history.current.slice(-19), noteRef.current];
    noteRef.current = next;
    setNote(next);
  }

  useEffect(() => {
    try {
      if (note || dx || proc || (reason && reason !== (appointment?.reason ?? ""))) localStorage.setItem(draftKey, JSON.stringify({ note, reason, dx, proc }));
      else localStorage.removeItem(draftKey);
    } catch {}
  }, [note, reason, dx, proc, draftKey, appointment?.reason]);

  async function savePhrase() {
    setPhraseMsg(undefined);
    const r = await addPhrase(phraseLabel, note);
    setPhraseMsg(r.error ?? "Frase guardada");
    if (!r.error) setPhraseLabel("");
  }

  // Al marcar lo realizado hoy, la nota y los códigos se completan solos (y se pueden editar).
  function toggleItem(id: string) {
    const next = checked.includes(id) ? checked.filter((x) => x !== id) : [...checked, id];
    setChecked(next);
    const selected = openItems.filter((i) => next.includes(i.id));
    const oldBlock = block.current;
    const newBlock = buildEvolutionText(selected);
    block.current = newBlock;
    setNote((cur) => replaceBlock(cur, oldBlock, newBlock));

    const newDx = selected.find((i) => i.diagnosisCode)?.diagnosisCode ?? "";
    const newProc = selected.find((i) => i.procedureCode)?.procedureCode ?? "";
    const oldDx = autoDx.current;
    const oldProc = autoProc.current;
    autoDx.current = newDx;
    autoProc.current = newProc;
    // Solo se reemplaza el código si está vacío o es el que puso el sistema antes.
    setDx((cur) => (cur === "" || cur === oldDx ? newDx : cur));
    setProc((cur) => (cur === "" || cur === oldProc ? newProc : cur));
  }

  return (
    <form action={action} className="card space-y-4">
      {dialog}
      <h2 className="section-title">Nueva evolución</h2>
      <input type="hidden" name="patientId" value={patientId} />
      {appointment && !state?.ok && (
        <>
          <input type="hidden" name="appointmentId" value={appointment.id} />
          <p className="rounded-lg border border-teal-700 bg-teal-50 px-3 py-2 text-sm text-slate-900">Atendiendo la cita del <strong>{appointment.time}</strong> · Al firmar, la cita queda como atendida.</p>
        </>
      )}
      <label className="label">Motivo de consulta<input name="reason" value={reason} onChange={(e) => setReason(e.target.value)} className="field" /></label>
      {openItems.length > 0 && (
        <fieldset>
          <legend className="label">Procedimientos del plan realizados hoy</legend>
          <p className="muted">Márcalos y la nota y los códigos se completan solos; puedes editarlos.</p>
          <div className="mt-2 space-y-2">
            {openItems.map((i) => (
              <label key={i.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm text-slate-900 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50">
                <input type="checkbox" name="doneItems" value={i.id} checked={checked.includes(i.id)} onChange={() => toggleItem(i.id)} className="h-5 w-5 accent-teal-700" />
                {i.name}{i.tooth ? ` · diente ${i.tooth}` : ""}{i.surfaces ? ` (${i.surfaces})` : ""}{i.material ? ` · ${i.material}` : ""}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="label">Diagnóstico (CIE-10)
          <input name="diagnosisCode" list="cie10" placeholder="K02.1" value={dx} onChange={(e) => setDx(e.target.value)} className="field" />
        </label>
        <label className="label">Procedimiento (CUPS)
          <input name="procedureCode" list="cups" inputMode="numeric" placeholder="890303" value={proc} onChange={(e) => setProc(e.target.value)} className="field" />
        </label>
      </div>
      <datalist id="cie10">{CIE10.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</datalist>
      <datalist id="cups">{CUPS.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</datalist>

      <div>
        <div className="flex items-center justify-between">
          <label htmlFor="note" className="label">Evolución</label>
          <VoiceButton label="🎤 Dictar" onPhrase={dictate} />
        </div>
        <p className="muted">Al dictar di «coma», «punto», «punto y aparte», «dos puntos» o «nueva línea». Para borrar lo último que dictaste di «deshacer».</p>
        <textarea id="note" name="note" rows={5} value={note} onChange={(e) => setNote(e.target.value)} className="field" />
        <div className="mt-2 flex flex-wrap gap-2">
          {[...phrases, ...NOTE_TEMPLATES.map((t) => ({ id: t.label, ...t }))].map((t) => (
            <button key={t.id} type="button" title={t.text} onClick={() => setNote((cur) => (cur ? cur + " " : "") + t.text)} className={`min-h-9 rounded-full border px-3 py-1 text-sm text-slate-900 hover:bg-slate-100 ${phrases.some((p) => p.id === t.id) ? "border-teal-700 bg-teal-50" : "border-slate-500 bg-white"}`}>
              {t.label}
            </button>
          ))}
        </div>
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-semibold text-teal-800">Mis frases frecuentes</summary>
          <div className="mt-2 space-y-2">
            <p className="muted">Escribe la frase en la nota, ponle un nombre corto y guárdala. Solo tú la ves.</p>
            <div className="flex flex-wrap gap-2">
              <input value={phraseLabel} onChange={(e) => setPhraseLabel(e.target.value)} maxLength={40} placeholder="Nombre corto, ej.: Endodoncia 1.ª cita" aria-label="Nombre de la frase" className="field mt-0 min-w-48 flex-1" />
              <button type="button" onClick={savePhrase} disabled={!note.trim() || phraseLabel.trim().length < 2} className="btn-secondary">Guardar la nota como frase</button>
            </div>
            {phraseMsg && <p role="status" className="text-sm font-semibold text-slate-800">{phraseMsg}</p>}
            {phrases.length > 0 && (
              <ul className="space-y-1">
                {phrases.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 text-sm"><span><strong>{p.label}</strong> · {p.text.slice(0, 80)}{p.text.length > 80 ? "…" : ""}</span><button type="button" onClick={() => removePhrase(p.id)} className="text-sm font-semibold text-red-700 underline">Quitar</button></li>
                ))}
              </ul>
            )}
          </div>
        </details>
      </div>

      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && (
        <div role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-teal-700 bg-teal-50 px-3 py-2">
          <p className="ok-text">Evolución firmada{state.attended ? " y cita marcada como atendida" : ""}.</p>
          <Link href={`/agenda?paciente=${patientId}`} className="btn-primary min-h-10">Agendar control</Link>
        </div>
      )}
      <button disabled={pending} className="btn-primary w-full md:w-auto">
        {pending ? "Firmando…" : "Firmar evolución"}
      </button>
      <p className="muted">Una vez firmada no se puede editar; las correcciones se registran como una nueva evolución.</p>
    </form>
  );
}
