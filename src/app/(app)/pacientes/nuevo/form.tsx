"use client";

import { useActionState } from "react";
import { createPatient } from "../actions";

const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base";

export default function PatientForm() {
  const [state, action, pending] = useActionState(createPatient, undefined);
  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <label className="text-sm font-medium">Tipo
          <select name="documentType" className={input}>
            {["CC", "TI", "CE", "RC", "PA", "PT"].map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
        <label className="col-span-2 text-sm font-medium">Número
          <input name="documentNumber" inputMode="numeric" required className={input} />
        </label>
      </div>
      <label className="block text-sm font-medium">Nombres<input name="firstName" required className={input} /></label>
      <label className="block text-sm font-medium">Apellidos<input name="lastName" required className={input} /></label>
      <label className="block text-sm font-medium">Celular<input name="phone" type="tel" inputMode="tel" className={input} /></label>
      <label className="block text-sm font-medium">Correo<input name="email" type="email" className={input} /></label>
      <label className="block text-sm font-medium">EPS<input name="eps" className={input} /></label>
      <label className="block text-sm font-medium">Alergias<input name="allergies" className={input} /></label>
      <label className="flex items-start gap-2 text-sm">
        <input name="consent" type="checkbox" className="mt-1 h-5 w-5" />
        El paciente autoriza el tratamiento de sus datos personales (Ley 1581 de 2012).
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-teal-600 py-3 font-medium text-white disabled:opacity-60">
        {pending ? "Guardando…" : "Guardar paciente"}
      </button>
    </form>
  );
}
