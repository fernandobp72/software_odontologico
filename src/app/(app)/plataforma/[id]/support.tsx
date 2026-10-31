"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteClinic, supportChangeEmail, supportDeleteUser, supportReset, supportSetActive } from "../actions";

export function UserSupport({ userId, email, active }: { userId: string; email: string; active: boolean }) {
  const [pending, start] = useTransition();
  const [link, setLink] = useState<string>();
  const [error, setError] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [state, action, saving] = useActionState(supportChangeEmail.bind(null, userId), undefined);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <button type="button" disabled={pending} className="btn-secondary min-h-10" onClick={() => start(async () => {
          const r = await supportReset(userId);
          if (r?.token) { setLink(`${window.location.origin}/restablecer/${r.token}`); setError(undefined); setCopied(false); } else setError(r?.error);
        })}>Enlace de contraseña</button>
        <button type="button" className="btn-secondary min-h-10" onClick={() => setEditing((v) => !v)}>Cambiar correo</button>
        <button type="button" disabled={pending} className={active ? "btn-danger min-h-10" : "btn-primary min-h-10"} onClick={() => start(async () => { await supportSetActive(userId, !active); })}>
          {active ? "Desactivar" : "Reactivar"}
        </button>
        <button type="button" disabled={pending} className="btn-danger min-h-10" onClick={() => {
          if (!window.confirm(`¿Eliminar definitivamente a ${email}? Solo se puede si no dejó registros. Esta acción no se deshace.`)) return;
          start(async () => { const r = await supportDeleteUser(userId); setError(r?.error); });
        }}>Eliminar</button>
      </div>
      {error && <p role="alert" className="error-text">{error}</p>}
      {link && (
        <div className="space-y-2 rounded-lg border border-teal-700 bg-teal-50 p-3">
          <p className="text-sm font-semibold text-teal-900">Enlace para {email} (24 horas, un solo uso)</p>
          <input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="field mt-0 text-sm" aria-label="Enlace" />
          <button type="button" className="btn-secondary min-h-10" onClick={async () => { try { await navigator.clipboard.writeText(link); setCopied(true); } catch {} }}>{copied ? "Copiado" : "Copiar enlace"}</button>
          <p className="muted">Envíaselo a la persona. Solo se muestra ahora.</p>
        </div>
      )}
      {editing && (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <label className="label min-w-48 flex-1">Correo nuevo<input name="email" type="email" required defaultValue={email} className="field" /></label>
          <button disabled={saving} className="btn-primary min-h-11">{saving ? "Guardando…" : "Guardar"}</button>
          {state?.error && <p role="alert" className="error-text w-full">{state.error}</p>}
          {state?.ok && <p className="ok-text w-full">Correo actualizado</p>}
        </form>
      )}
    </div>
  );
}

export function DeleteClinic({ clinicId, name, patients }: { clinicId: string; name: string; patients: number }) {
  const [state, action, pending] = useActionState(deleteClinic.bind(null, clinicId), undefined);
  return (
    <section className="space-y-3 rounded-xl border border-red-700 bg-white p-4">
      <h2 className="section-title text-red-800">Zona de peligro</h2>
      {patients > 0 ? (
        <p className="text-sm text-slate-900">
          Este cliente tiene {patients} paciente(s) con historia clínica, que se debe conservar por ley (15 años, Res. 839 de 2017), así que no se puede eliminar. Si ya no debe usar el sistema, <strong>suspéndelo</strong>: sus datos quedan guardados y nadie puede entrar.
        </p>
      ) : (
        <form action={action} className="space-y-3">
          <p className="text-sm text-slate-900">Este cliente no tiene pacientes. Puedes eliminarlo con todas sus personas, sedes y configuración. No se deshace. Escribe el nombre exacto para confirmar.</p>
          <label className="label">Nombre: <strong>{name}</strong><input name="confirm" autoComplete="off" className="field" /></label>
          {state?.error && <p role="alert" className="error-text">{state.error}</p>}
          <button disabled={pending} className="btn-danger">{pending ? "Eliminando…" : "Eliminar definitivamente"}</button>
        </form>
      )}
    </section>
  );
}
