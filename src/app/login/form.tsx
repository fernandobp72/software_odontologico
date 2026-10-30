"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="label">
        Correo
        <input name="email" type="email" autoComplete="username" required className="field" />
      </label>
      <label className="label">
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required className="field" />
      </label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Ingresando…" : "Ingresar"}</button>
    </form>
  );
}
