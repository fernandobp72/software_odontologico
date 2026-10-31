"use client";

import { useActionState } from "react";
import { sendBroadcast } from "./actions";

export default function BroadcastForm() {
  const [state, action, pending] = useActionState(sendBroadcast, undefined);
  return (
    <form action={action} className="card max-w-xl space-y-4" onSubmit={(e) => { if (!window.confirm("¿Enviar este comunicado? No se puede deshacer.")) e.preventDefault(); }}>
      <label className="label">Para
        <select name="audience" defaultValue="ALL" className="field">
          <option value="ALL">Todos los clientes</option>
          <option value="ACTIVE">Solo clientes activos</option>
          <option value="TRIAL">Solo clientes en prueba</option>
          <option value="SUSPENDED">Solo clientes suspendidos</option>
        </select>
      </label>
      <label className="label">Asunto<input name="subject" required className="field" /></label>
      <label className="label">Mensaje<textarea name="message" rows={7} required className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text" role="status">{state.info}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Enviando…" : "Enviar comunicado"}</button>
      <p className="muted">Se envía un correo a cada administrador activo, con su nombre. Queda anotado en Actividad.</p>
    </form>
  );
}
