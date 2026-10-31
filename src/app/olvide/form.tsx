"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestReset } from "./actions";

export default function ForgotForm() {
  const [state, action, pending] = useActionState(requestReset, undefined);
  if (state?.sent) {
    return (
      <div className="space-y-3">
        <p className="ok-text" role="status">Si <strong>{state.email}</strong> tiene una cuenta, te enviamos un correo con el enlace para crear una contraseña nueva. Vence en 1 hora; revisa también la carpeta de spam.</p>
        <Link href="/login" className="btn-secondary w-full">Volver a ingresar</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <label className="label">Correo de tu cuenta<input key={state?.email ?? ""} name="email" type="email" autoComplete="username" required defaultValue={state?.email ?? ""} className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Enviando…" : "Enviarme el enlace"}</button>
      <p className="text-center text-sm"><Link href="/login" className="font-semibold underline">Volver</Link></p>
    </form>
  );
}
