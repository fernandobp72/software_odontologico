"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  const [show, setShow] = useState(false);
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
