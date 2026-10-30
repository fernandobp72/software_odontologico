"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CIE10, PHASES, PROCEDURES, SURFACES, QUADRANTS } from "@/lib/catalogs";
import { addDiagnosis, addItem, createPlan, generateFromFindings, updateDiagnosis, updateItem } from "./actions";

const TEETH = QUADRANTS.flat().sort((a, b) => a - b);

export function DiagnosisForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(addDiagnosis.bind(null, patientId), undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="label">Diagnóstico (CIE-10)
          <input name="code" list="cie10-all" required placeholder="Escribe código o nombre, ej. K02.1" className="field" autoComplete="off" />
        </label>
        <label className="label">Diente
          <select name="tooth" className="field" defaultValue=""><option value="">—</option>{TEETH.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
      </div>
      <datalist id="cie10-all">{CIE10.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)}</datalist>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Agregar diagnóstico"}</button>
    </form>
  );
}

export function PlanForm({ patientId }: { patientId: string }) {
  const [state, action, pending] = useActionState(createPlan.bind(null, patientId), undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="label min-w-60 flex-1">Nuevo plan
        <input name="title" placeholder="Plan de tratamiento" className="field" />
      </label>
      <button disabled={pending} className="btn-primary">{pending ? "Creando…" : "Crear plan"}</button>
      {state?.error && <p role="alert" className="error-text w-full">{state.error}</p>}
    </form>
  );
}

export function ItemForm({ patientId, planId }: { patientId: string; planId: string }) {
  const [state, action, pending] = useActionState(addItem.bind(null, patientId), undefined);
  const [procId, setProcId] = useState(PROCEDURES[0].id);
  const proc = PROCEDURES.find((p) => p.id === procId)!;
  const groups = [...new Set(PROCEDURES.map((p) => p.group))];
  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <input type="hidden" name="planId" value={planId} />
      <p className="font-semibold text-slate-900">Agregar procedimiento</p>
      <label className="label">Procedimiento
        <select name="procedure" value={procId} onChange={(e) => setProcId(e.target.value)} className="field">
          {groups.map((g) => (
            <optgroup key={g} label={g}>
              {PROCEDURES.filter((p) => p.group === g).map((p) => <option key={p.id} value={p.id}>{p.name}{p.cups ? ` · ${p.cups}` : ""}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      {procId === "otro" && <label className="label">Descripción<input name="customName" className="field" /></label>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="label">Fase
          <select name="phase" className="field" defaultValue={2}>{PHASES.map((p) => <option key={p.n} value={p.n}>{p.n}. {p.label}</option>)}</select>
        </label>
        {(proc.scope === "tooth" || proc.scope === "surface") && (
          <label className="label">Diente
            <select name="tooth" className="field" defaultValue=""><option value="">—</option>{TEETH.map((t) => <option key={t}>{t}</option>)}</select>
          </label>
        )}
        <label className="label">Cantidad<input name="quantity" type="number" min={1} defaultValue={1} className="field" /></label>
        <label className="label">Valor unitario (COP)<input name="unitPrice" type="number" min={0} step={1000} defaultValue={0} inputMode="numeric" className="field" /></label>
      </div>
      {proc.scope === "surface" && (
        <fieldset>
          <legend className="label">Superficies</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {SURFACES.map((s) => (
              <label key={s.key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm text-slate-900 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:checked]:font-semibold">
                <input type="checkbox" name="surfaces" value={s.key} className="h-4 w-4 accent-teal-700" />{s.key} · {s.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <label className="label">Notas<input name="notes" className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Agregando…" : "Agregar al plan"}</button>
    </form>
  );
}

// Primera vez: genera solo los diagnósticos y el plan a partir del odontograma y del periodontograma.
export function AutoGenerate({ patientId }: { patientId: string }) {
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string>();
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    generateFromFindings(patientId, true).then((r) => (r.error ? setError(r.error) : router.refresh()));
  }, [patientId, router]);
  return (
    <p role="status" className="rounded-lg border border-teal-700 bg-teal-50 p-3 text-sm font-semibold text-teal-900">
      {error ?? "Generando los diagnósticos y el plan a partir de los hallazgos del odontograma y del periodontograma…"}
    </p>
  );
}

// Hallazgos nuevos desde la última vez: se agregan con un toque (sin tocar lo que ya editaste).
export function SuggestionCard({ patientId, diagnoses, items }: { patientId: string; diagnoses: string[]; items: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <section className="card space-y-3 border-teal-700">
      <h2 className="section-title">Sugerencias nuevas de los hallazgos</h2>
      <p className="muted">Hay hallazgos que todavía no están en tus diagnósticos o plan. Se agregan como sugerencias que puedes modificar o eliminar; lo que ya editaste no se toca y lo que eliminaste no vuelve.</p>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-900">
        {diagnoses.map((d) => <li key={d}>Diagnóstico: {d}</li>)}
        {items.map((d) => <li key={d}>Procedimiento: {d}</li>)}
      </ul>
      <button type="button" disabled={pending} className="btn-primary" onClick={() => start(async () => { await generateFromFindings(patientId, false); router.refresh(); })}>
        {pending ? "Agregando…" : "Agregar sugerencias"}
      </button>
    </section>
  );
}

export function DiagnosisEditForm({ d }: { d: { id: string; code: string; tooth: number | null; note: string | null } }) {
  const [state, action, pending] = useActionState(updateDiagnosis.bind(null, d.id), undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="label">Diagnóstico (CIE-10)<input name="code" list="cie10-all" defaultValue={d.code} required className="field" autoComplete="off" /></label>
        <label className="label">Diente
          <select name="tooth" className="field" defaultValue={d.tooth ?? ""}><option value="">—</option>{TEETH.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
      </div>
      <label className="label">Nota<input name="note" defaultValue={d.note ?? ""} maxLength={300} className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Guardado</p>}
      <button disabled={pending} className="btn-secondary">{pending ? "Guardando…" : "Guardar cambios"}</button>
    </form>
  );
}

export function ItemEditForm({ item }: { item: { id: string; name: string; phase: number; tooth: number | null; surfaces: string | null; quantity: number; unitPrice: number; notes: string | null } }) {
  const [state, action, pending] = useActionState(updateItem.bind(null, item.id), undefined);
  return (
    <form action={action} className="space-y-3">
      <label className="label">Procedimiento<input name="name" defaultValue={item.name} required className="field" /></label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="label">Fase
          <select name="phase" className="field" defaultValue={item.phase}>{PHASES.map((p) => <option key={p.n} value={p.n}>{p.n}. {p.label}</option>)}</select>
        </label>
        <label className="label">Diente
          <select name="tooth" className="field" defaultValue={item.tooth ?? ""}><option value="">—</option>{TEETH.map((t) => <option key={t}>{t}</option>)}</select>
        </label>
        <label className="label">Cantidad<input name="quantity" type="number" min={1} defaultValue={item.quantity} className="field" /></label>
        <label className="label">Valor unitario (COP)<input name="unitPrice" type="number" min={0} step={1000} defaultValue={item.unitPrice} inputMode="numeric" className="field" /></label>
      </div>
      <fieldset>
        <legend className="label">Superficies</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {SURFACES.map((sf) => (
            <label key={sf.key} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm text-slate-900 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:checked]:font-semibold">
              <input type="checkbox" name="surfaces" value={sf.key} defaultChecked={item.surfaces?.includes(sf.key)} className="h-4 w-4 accent-teal-700" />{sf.key} · {sf.label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="label">Notas<input name="notes" defaultValue={item.notes ?? ""} maxLength={500} className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Guardado</p>}
      <button disabled={pending} className="btn-secondary">{pending ? "Guardando…" : "Guardar cambios"}</button>
    </form>
  );
}
