"use client";

import { useActionState } from "react";
import { createAppointment } from "./actions";

const DURATIONS: [number, string][] = [[15, "15 minutos"], [20, "20 minutos"], [30, "30 minutos"], [45, "45 minutos"], [60, "1 hora"], [90, "1 hora 30 minutos"], [120, "2 horas"]];

export default function AppointmentForm({ patients, professionals, defaultDentistId }: { patients: { id: string; label: string }[]; professionals: { id: string; name: string }[]; defaultDentistId: string | null }) {
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
      {professionals.length > 0 && (
        <label className="label">Profesional
          <select name="dentistId" required className="field" defaultValue={defaultDentistId ?? ""}>
            {!defaultDentistId && <option value="" disabled>Selecciona…</option>}
            {professionals.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      )}
      <label className="label">Fecha y hora<input name="startsAt" type="datetime-local" required className="field" /></label>
      <label className="label">Duración
        <select name="minutes" defaultValue={30} className="field">
          {DURATIONS.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
        </select>
      </label>
      <label className="label">Motivo<input name="reason" className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Cita creada</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Guardando…" : "Agendar"}</button>
    </form>
  );
}
