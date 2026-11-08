"use client";

import { useActionState, useState } from "react";
import { rescheduleAppointment } from "./actions";

const DURATIONS: [number, string][] = [[15, "15 minutos"], [20, "20 minutos"], [30, "30 minutos"], [45, "45 minutos"], [60, "1 hora"], [90, "1 hora 30 minutos"], [120, "2 horas"]];

// Botón «Reprogramar» que despliega el formulario de nueva fecha en la misma tarjeta.
export default function RescheduleButton({ id, current, minutes }: { id: string; current: string; minutes: number }) {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: Awaited<ReturnType<typeof rescheduleAppointment>>, fd: FormData) => {
    const r = await rescheduleAppointment(id, prev, fd);
    if (r?.ok) setOpen(false);
    return r;
  }, undefined);
  const nearest = DURATIONS.some(([m]) => m === minutes) ? minutes : 30;

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="btn-secondary">Reprogramar</button>;
  return (
    <form action={action} className="w-full space-y-2 rounded-lg border border-slate-300 bg-slate-50 p-3">
      <p className="text-sm font-semibold text-slate-900">Nueva fecha y hora</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="label">Fecha y hora<input name="startsAt" type="datetime-local" required defaultValue={current} className="field" /></label>
        <label className="label">Duración
          <select name="minutes" defaultValue={nearest} className="field">
            {DURATIONS.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
          </select>
        </label>
      </div>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <div className="flex gap-2">
        <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar nueva fecha"}</button>
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary">Cerrar</button>
      </div>
    </form>
  );
}
