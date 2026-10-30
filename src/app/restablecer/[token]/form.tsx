"use client";

import { useActionState } from "react";
import { resetPassword } from "./actions";

export default function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPassword.bind(null, token), undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="label">Contraseña nueva (mínimo 10 caracteres)<input name="password" type="password" autoComplete="new-password" required minLength={10} className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Guardando…" : "Guardar contraseña"}</button>
    </form>
  );
}
