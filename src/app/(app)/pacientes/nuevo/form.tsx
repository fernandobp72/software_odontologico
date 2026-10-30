"use client";

import { useActionState } from "react";
import { createPatient } from "../actions";

export default function PatientForm() {
  const [state, action, pending] = useActionState(createPatient, undefined);
  return (
    <form action={action} className="card space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <label className="label">Tipo
          <select name="documentType" className="field">
            {["CC", "TI", "CE", "RC", "PA", "PT"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="label col-span-2">Número
          <input name="documentNumber" inputMode="numeric" required className="field" />
        </label>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="label">Nombres<input name="firstName" required className="field" /></label>
        <label className="label">Apellidos<input name="lastName" required className="field" /></label>
        <label className="label">Celular<input name="phone" type="tel" inputMode="tel" className="field" /></label>
        <label className="label">Correo<input name="email" type="email" className="field" /></label>
        <label className="label">EPS<input name="eps" className="field" /></label>
        <label className="label">Alergias<input name="allergies" className="field" /></label>
      </div>
      <label className="flex items-start gap-3 text-sm text-slate-900">
        <input name="consent" type="checkbox" className="mt-0.5 h-5 w-5 accent-teal-700" />
        El paciente autoriza el tratamiento de sus datos personales (Ley 1581 de 2012).
      </label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full md:w-auto">{pending ? "Guardando…" : "Guardar paciente"}</button>
    </form>
  );
}
