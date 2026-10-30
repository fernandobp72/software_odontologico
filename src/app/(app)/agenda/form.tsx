"use client";

import { useActionState } from "react";
import { createAppointment } from "./actions";

export default function AppointmentForm({ patients }: { patients: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(createAppointment, undefined);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="section-title">Nueva cita</h2>
      <label className="label">Paciente
        <select name="patientId" required className="field" defaultValue="">
          <option value="" disabled>Selecciona…</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">Fecha y hora<input name="startsAt" type="datetime-local" required className="field" /></label>
        <label className="label">Minutos<input name="minutes" type="number" defaultValue={30} step={5} className="field" /></label>
      </div>
      <label className="label">Motivo<input name="reason" className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Cita creada</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Guardando…" : "Agendar"}</button>
    </form>
  );
}
