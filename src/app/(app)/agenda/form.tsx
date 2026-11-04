"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createAppointment } from "./actions";

const DURATIONS: [number, string][] = [[15, "15 minutos"], [20, "20 minutos"], [30, "30 minutos"], [45, "45 minutos"], [60, "1 hora"], [90, "1 hora 30 minutos"], [120, "2 horas"]];

export default function AppointmentForm({ patients, professionals, defaultDentistId }: { patients: { id: string; label: string }[]; professionals: { id: string; name: string }[]; defaultDentistId: string | null }) {
  const [state, action, pending] = useActionState(createAppointment, undefined);
  const [isNew, setIsNew] = useState(false);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="section-title">Nueva cita</h2>
      <div className="flex gap-2" role="group" aria-label="Tipo de paciente">
        <button type="button" aria-pressed={!isNew} onClick={() => setIsNew(false)} className={`min-h-11 flex-1 rounded-lg border px-3 text-sm font-semibold ${!isNew ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-400 bg-white text-slate-900"}`}>Ya es paciente</button>
        <button type="button" aria-pressed={isNew} onClick={() => setIsNew(true)} className={`min-h-11 flex-1 rounded-lg border px-3 text-sm font-semibold ${isNew ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-400 bg-white text-slate-900"}`}>Paciente nuevo</button>
      </div>
      {isNew ? (
        <>
          <input type="hidden" name="newPatient" value="on" />
          <label className="label">Nombre<input name="newName" required autoComplete="off" placeholder="Nombre y apellido" className="field" /></label>
          <label className="label">Celular<input name="newPhone" type="tel" inputMode="tel" required autoComplete="off" className="field" /></label>
          <p className="muted">Se crea la ficha solo con nombre y celular. Los demás datos y la autorización de datos se completan cuando llegue.</p>
        </>
      ) : (
        <label className="label">Paciente
          <select name="patientId" required className="field" defaultValue="">
            <option value="" disabled>Selecciona…</option>
            {patients.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      )}
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
      {state?.ok && <p className="ok-text">Cita creada{state.newPatient ? <> y ficha de {state.newPatient.name} creada. <Link href={`/pacientes/${state.newPatient.id}/editar`} className="font-semibold underline">Completar datos</Link></> : ""}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Guardando…" : "Agendar"}</button>
    </form>
  );
}
