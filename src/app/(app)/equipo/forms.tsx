"use client";

import { useActionState, useState, useTransition } from "react";
import { createReset, invite } from "./actions";

export const ROLE_LABEL: Record<string, string> = { ADMIN: "Administrador", DENTIST: "Odontólogo", RECEPTION: "Recepción" };

function LinkBox({ path, kind }: { path: string; kind: "invite" | "reset" }) {
  const [copied, setCopied] = useState(false);
  const url = `${typeof window === "undefined" ? "" : window.location.origin}${path}`;
  return (
    <div className="space-y-2 rounded-lg border border-teal-700 bg-teal-50 p-3">
      <p className="text-sm font-semibold text-teal-900">{kind === "invite" ? "Enlace de invitación (válido 7 días, un solo uso)" : "Enlace para restablecer (válido 24 horas, un solo uso)"}</p>
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="field mt-0 text-sm" aria-label="Enlace" />
      <button type="button" className="btn-secondary" onClick={async () => { await navigator.clipboard.writeText(url); setCopied(true); }}>{copied ? "Copiado" : "Copiar enlace"}</button>
      <p className="muted">Envíalo por WhatsApp o correo. Solo se muestra ahora: no se puede volver a ver.</p>
    </div>
  );
}

export function InviteForm() {
  const [state, action, pending] = useActionState(invite, undefined);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="section-title">Invitar a una persona</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Correo<input name="email" type="email" required className="field" /></label>
        <label className="label">Rol
          <select name="role" className="field" defaultValue="DENTIST">{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
      </div>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && state.token && <LinkBox path={`/invitacion/${state.token}`} kind="invite" />}
      <button disabled={pending} className="btn-primary">{pending ? "Creando…" : "Crear invitación"}</button>
    </form>
  );
}

export function ResetButton({ userId }: { userId: string }) {
  const [token, setToken] = useState<string>();
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  return (
    <div className="space-y-2">
      <button type="button" disabled={pending} className="btn-secondary min-h-10" onClick={() => start(async () => {
        const r = await createReset(userId);
        if (r?.token) setToken(r.token); else setError(r?.error);
      })}>Enlace para restablecer contraseña</button>
      {error && <p role="alert" className="error-text">{error}</p>}
      {token && <LinkBox path={`/restablecer/${token}`} kind="reset" />}
    </div>
  );
}
