"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ASSESSMENT_SECTIONS, type AssessmentData, type Field } from "@/lib/assessment";
import { saveAssessment } from "./actions";

function Input({ f, value }: { f: Field; value: string | string[] | undefined }) {
  if (f.type === "checks") {
    const sel = Array.isArray(value) ? value : [];
    return (
      <fieldset>
        <legend className="label">{f.label}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {f.options!.map((o) => (
            <label key={o} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm text-slate-900 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:checked]:font-semibold">
              <input type="checkbox" name={f.name} value={o} defaultChecked={sel.includes(o)} className="h-4 w-4 accent-teal-700" />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  const v = typeof value === "string" ? value : "";
  return (
    <label className="label">
      {f.label}
      {f.type === "textarea" ? (
        <textarea name={f.name} rows={3} defaultValue={v} className="field" />
      ) : f.type === "select" ? (
        <select name={f.name} defaultValue={v} className="field">
          <option value="">—</option>
          {f.options!.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input name={f.name} type={f.type === "number" ? "number" : "text"} inputMode={f.type === "number" ? "decimal" : undefined} step="any" placeholder={f.hint} defaultValue={v} className="field" />
      )}
    </label>
  );
}

export default function AssessmentForm({ patientId, initial, intakeId }: { patientId: string; initial: AssessmentData | null; intakeId?: string }) {
  const [state, action, pending] = useActionState(saveAssessment.bind(null, patientId), undefined);
  const form = useRef<HTMLFormElement>(null);
  const key = `valoracion-${patientId}`;
  const [draft, setDraft] = useState<{ at: number; data: Record<string, string[]> } | null>(null);

  // Borrador en este dispositivo: si la sesión vence o se cae la señal, lo escrito no se pierde.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setDraft(JSON.parse(raw));
    } catch {}
  }, [key]);
  useEffect(() => {
    if (state?.ok) try { localStorage.removeItem(key); } catch {}
  }, [state, key]);

  function remember() {
    if (!form.current) return;
    const data: Record<string, string[]> = {};
    for (const [k, v] of new FormData(form.current).entries()) if (typeof v === "string" && k !== "intakeId") (data[k] ??= []).push(v);
    try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch {}
  }

  function restore() {
    const f = form.current;
    if (!f || !draft) return;
    for (const el of Array.from(f.elements) as (HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement)[]) {
      if (!el.name || el.name === "intakeId") continue;
      const vals = draft.data[el.name] ?? [];
      if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = vals.includes(el.value);
      else el.value = vals[0] ?? "";
    }
    setDraft(null);
  }

  return (
    <form ref={form} action={action} onChange={remember} className="space-y-3">
      {draft && (
        <div role="status" className="card flex flex-wrap items-center justify-between gap-2 border-amber-600 bg-amber-50">
          <p className="text-sm font-semibold text-slate-900">Hay cambios sin guardar en este aparato ({new Date(draft.at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}).</p>
          <span className="flex gap-2">
            <button type="button" onClick={restore} className="btn-primary min-h-10">Recuperar</button>
            <button type="button" onClick={() => { try { localStorage.removeItem(key); } catch {} setDraft(null); }} className="btn-secondary min-h-10">Descartar</button>
          </span>
        </div>
      )}
      {intakeId && <input type="hidden" name="intakeId" value={intakeId} />}
      {ASSESSMENT_SECTIONS.map((section, i) => (
        <details key={section.id} open={i === 0 || !!intakeId} className="card group p-0">
          <summary className="cursor-pointer list-none px-4 py-4 text-lg font-semibold text-slate-900 marker:hidden">
            {section.title}
            <span className="float-right text-slate-600 group-open:rotate-180">⌄</span>
          </summary>
          <div className="grid gap-4 border-t border-slate-200 p-4 md:grid-cols-2">
            {section.fields.map((f) => (
              <div key={f.name} className={f.type === "textarea" || f.type === "checks" ? "md:col-span-2" : undefined}>
                <Input f={f} value={initial?.[f.name]} />
              </div>
            ))}
          </div>
        </details>
      ))}
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Valoración guardada como una nueva versión</p>}
      <button disabled={pending} className="btn-primary w-full md:w-auto">{pending ? "Guardando…" : "Guardar valoración"}</button>
      <p className="muted">Cada guardado crea una versión nueva; las anteriores se conservan y no se pueden modificar.</p>
    </form>
  );
}
