"use client";

import { useActionState } from "react";
import { changePassword } from "./actions";

export default function PasswordForm() {
  const [state, action, pending] = useActionState(changePassword, undefined);
  return (
    <form action={action} key={state?.ok ? "ok" : "form"} className="card max-w-md space-y-4">
      <h2 className="section-title">Cambiar contraseña</h2>
      <label className="label">Contraseña actual<input name="current" type="password" autoComplete="current-password" required className="field" /></label>
      <label className="label">Contraseña nueva (mínimo 10 caracteres)<input name="next" type="password" autoComplete="new-password" required minLength={10} className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Contraseña actualizada</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Cambiar contraseña"}</button>
    </form>
  );
}
