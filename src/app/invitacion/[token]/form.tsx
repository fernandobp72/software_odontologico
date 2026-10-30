"use client";

import { useActionState } from "react";
import { accept } from "./actions";

export default function AcceptForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(accept.bind(null, token), undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="label">Tu nombre<input name="name" autoComplete="name" required className="field" /></label>
      <label className="label">Crea una contraseña (mínimo 10 caracteres)<input name="password" type="password" autoComplete="new-password" required minLength={10} className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Creando…" : "Crear mi cuenta"}</button>
      <p className="muted">Al continuar aceptas los <a href="/terminos" target="_blank" className="font-semibold underline">términos y la política de datos</a>.</p>
    </form>
  );
}
