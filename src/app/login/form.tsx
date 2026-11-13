"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, verifyMfa } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [show, setShow] = useState(false);
  if (state?.mfa) return <MfaForm />;
  return (
    <form action={action} className="space-y-4">
      <label className="label">
        Correo
        <input key={state?.email ?? ""} name="email" type="email" autoComplete="username" required defaultValue={state?.email ?? ""} className="field" />
      </label>
      <label className="label">
        Contraseña
        <input name="password" type={show ? "text" : "password"} autoComplete="current-password" required className="field" />
      </label>
      <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-slate-800">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} className="h-4 w-4 accent-teal-700" /> Mostrar la contraseña
      </label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Ingresando…" : "Ingresar"}</button>
      <p className="text-center text-sm"><Link href="/olvide" className="font-semibold text-teal-800 underline">¿Olvidaste tu contraseña?</Link></p>
    </form>
  );
}

// Segundo paso: el código de 6 dígitos de la app autenticadora del celular.
function MfaForm() {
  const [state, action, pending] = useActionState(verifyMfa, undefined);
  if (state && !state.mfa && state.error) {
    return (
      <div className="space-y-3">
        <p role="alert" className="error-text">{state.error}</p>
        <a href="/login" className="btn-primary block w-full text-center">Volver a ingresar</a>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <p className="text-sm text-slate-900">Abre la app autenticadora de tu celular y escribe el código de 6 dígitos que aparece con el nombre de tu consultorio.</p>
      <label className="label">Código
        <input name="code" required autoFocus inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} className="field text-center text-2xl font-bold tracking-widest" />
      </label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Verificando…" : "Verificar"}</button>
      <p className="muted text-center">¿Perdiste el celular? Pide al administrador de tu cuenta que desactive la verificación en dos pasos desde Equipo.</p>
    </form>
  );
}
