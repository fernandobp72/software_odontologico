"use client";

import { useActionState } from "react";
import { INTAKE_SECTIONS } from "@/lib/intake";
import type { Field } from "@/lib/assessment";
import SignaturePad from "@/app/(app)/pacientes/[id]/consentimientos/signature-pad";
import { submitIntake } from "./actions";

function Question({ f }: { f: Field }) {
  if (f.type === "checks") {
    return (
      <fieldset>
        <legend className="label">{f.label}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {f.options!.map((o) => (
            <label key={o} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm text-slate-900 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:checked]:font-semibold">
              <input type="checkbox" name={f.name} value={o} className="h-4 w-4 accent-teal-700" />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  return (
    <label className="label">
      {f.label}
      {f.type === "textarea" ? (
        <textarea name={f.name} rows={3} className="field" />
      ) : f.type === "select" ? (
        <select name={f.name} className="field">
          <option value="">—</option>
          {f.options!.map((o) => <option key={o}>{o}</option>)}
        </select>
      ) : (
        <input name={f.name} className="field" />
      )}
    </label>
  );
}

export default function IntakeForm({ token, clinic, patientName }: { token: string; clinic: string; patientName: string }) {
  const [state, action, pending] = useActionState(submitIntake.bind(null, token), undefined);
  if (state?.ok) {
    return (
      <div className="card space-y-2 p-6 text-center">
        <h1 className="text-xl font-bold">¡Gracias, {patientName}!</h1>
        <p className="ok-text">Recibimos tu información. {clinic} la revisará antes de tu cita.</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <div className="card space-y-1">
        <p className="text-sm font-semibold text-teal-800">{clinic}</p>
        <h1 className="text-xl font-bold">Hola {patientName}, cuéntanos sobre ti</h1>
        <p className="muted">Toma unos 5 minutos. Contesta lo que sepas; si algo no aplica, déjalo en blanco. Tu odontólogo lo revisará contigo en la cita.</p>
      </div>
      {INTAKE_SECTIONS.map((s) => (
        <section key={s.id} className="card space-y-4">
          <h2 className="section-title">{s.title}</h2>
          {s.fields.map((f) => <Question key={f.name} f={f} />)}
        </section>
      ))}
      <section className="card space-y-4">
        <h2 className="section-title">Autorización y firma</h2>
        <label className="label">Tu nombre completo<input name="signerName" autoComplete="name" className="field" /></label>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-slate-900">
          <input type="checkbox" name="accept" className="mt-1 h-5 w-5 accent-teal-700" />
          <span>
            Declaro que la información es veraz y autorizo a {clinic} a tratar mis datos personales y de salud para mi atención odontológica, conforme a la Ley 1581 de 2012. Puedo consultarlos, corregirlos o pedir su supresión cuando lo necesite.
          </span>
        </label>
        <SignaturePad name="signature" />
      </section>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Enviando…" : "Enviar formulario"}</button>
    </form>
  );
}
