"use client";

import { useActionState } from "react";
import { createPatient } from "../actions";
import PatientFields from "../patient-fields";

export default function PatientForm() {
  const [state, action, pending] = useActionState(createPatient, undefined);
  return (
    <form action={action} className="card space-y-4">
      <PatientFields />
      <label className="flex items-start gap-3 text-sm text-slate-900">
        <input name="consent" type="checkbox" className="mt-0.5 h-5 w-5 accent-teal-700" />
        El paciente autoriza el tratamiento de sus datos personales (Ley 1581 de 2012).
      </label>
      <label className="flex items-start gap-3 text-sm text-slate-900">
        <input name="whatsapp" type="checkbox" className="mt-0.5 h-5 w-5 accent-teal-700" />
        El paciente autoriza recibir recordatorios de sus citas por WhatsApp (opcional).
      </label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full md:w-auto">{pending ? "Guardando…" : "Guardar paciente"}</button>
    </form>
  );
}
