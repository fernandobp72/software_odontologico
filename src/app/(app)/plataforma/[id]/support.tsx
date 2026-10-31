"use client";

import { useActionState, useState, useTransition } from "react";
import { supportChangeEmail, supportReset, supportSetActive } from "../actions";

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
