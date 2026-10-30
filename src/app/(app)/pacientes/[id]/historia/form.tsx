"use client";

import { useActionState } from "react";
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

export default function AssessmentForm({ patientId, initial }: { patientId: string; initial: AssessmentData | null }) {
  const [state, action, pending] = useActionState(saveAssessment.bind(null, patientId), undefined);
  return (
    <form action={action} className="space-y-3">
      {ASSESSMENT_SECTIONS.map((section, i) => (
        <details key={section.id} open={i === 0} className="card group p-0">
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
