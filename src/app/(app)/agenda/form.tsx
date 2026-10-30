"use client";

import { useActionState } from "react";
import { createAppointment } from "./actions";

const input = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-base";

export default function AppointmentForm({ patients }: { patients: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(createAppointment, undefined);
  return (
    <form action={action} className="space-y-3 rounded-xl bg-white p-4 ring-1 ring-slate-200">
      <h2 className="font-medium">Nueva cita</h2>
      <label className="block text-sm font-medium">Paciente
        <select name="patientId" required className={input} defaultValue="">
          <option value="" disabled>Selecciona…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm font-medium">Fecha y hora<input name="startsAt" type="datetime-local" required className={input} /></label>
        <label className="text-sm font-medium">Minutos<input name="minutes" type="number" defaultValue={30} step={5} className={input} /></label>
      </div>
      <label className="block text-sm font-medium">Motivo<input name="reason" className={input} /></label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-teal-700">Cita creada</p>}
      <button disabled={pending} className="w-full rounded-lg bg-teal-600 py-3 font-medium text-white disabled:opacity-60">
        {pending ? "Guardando…" : "Agendar"}
      </button>
    </form>
  );
}
