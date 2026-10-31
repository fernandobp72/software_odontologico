"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CIE10, CUPS, NOTE_TEMPLATES } from "@/lib/catalogs";
import { buildEvolutionText, replaceBlock, type DoneItem } from "@/lib/evolution-text";
import { signEvolution, type EvolutionState } from "./actions";
import VoiceButton from "./voice-button";

export default function EvolutionForm({ patientId, openItems = [] }: { patientId: string; openItems?: DoneItem[] }) {
  const [note, setNote] = useState("");
  const [checked, setChecked] = useState<string[]>([]);
  const [dx, setDx] = useState("");
  const [proc, setProc] = useState("");
  const block = useRef(""); // texto que redactó el sistema, para reemplazarlo sin tocar lo que escribas
  const autoDx = useRef("");
  const autoProc = useRef("");
  const [state, action, pending] = useActionState(async (prev: EvolutionState, fd: FormData) => {
    const res = await signEvolution(prev, fd);
    if (res?.ok) {
      setNote("");
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
    // Recupera el borrador guardado en este dispositivo.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    try { setNote(localStorage.getItem(draftKey) ?? ""); } catch {}
  }, [draftKey]);

  useEffect(() => {
    try { if (note) localStorage.setItem(draftKey, note); else localStorage.removeItem(draftKey); } catch {}
  }, [note, draftKey]);

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
      <h2 className="section-title">Nueva evolución</h2>
      <input type="hidden" name="patientId" value={patientId} />
      <label className="label">Motivo de consulta<input name="reason" className="field" /></label>
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
          <VoiceButton label="🎤 Dictar" onPhrase={(text) => setNote((cur) => (cur ? cur + " " : "") + text)} />
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
