"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);
  return (
    <form action={action} className="space-y-4">
      <label className="block text-sm font-medium text-slate-700">
        Correo
        <input name="email" type="email" autoComplete="username" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base" />
      </label>
      <label className="block text-sm font-medium text-slate-700">
        Contraseña
        <input name="password" type="password" autoComplete="current-password" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-3 text-base" />
      </label>
      {state?.error && <p role="alert" className="text-sm text-red-600">{state.error}</p>}
      <button disabled={pending} className="w-full rounded-lg bg-teal-600 py-3 font-medium text-white disabled:opacity-60">
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
