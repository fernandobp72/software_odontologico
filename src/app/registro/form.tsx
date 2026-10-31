"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signup } from "./actions";

export default function SignupForm() {
  const [state, action, pending] = useActionState(signup, undefined);
  return (
    <form key={state?.values?.email ?? "nuevo"} action={action} className="space-y-4">
      <label className="label">Tu centro es un
        <select name="noun" defaultValue={state?.values?.noun ?? "consultorio"} className="field">
          <option value="consultorio">Consultorio</option>
          <option value="clinica">Clínica</option>
          <option value="centro">Centro odontológico</option>
        </select>
      </label>
      <label className="label">Nombre<input name="clinicName" required defaultValue={state?.values?.clinicName ?? ""} className="field" /></label>
      <label className="label">NIT o documento (opcional)<input name="nit" defaultValue={state?.values?.nit ?? ""} className="field" /></label>
      <label className="label">Tu nombre<input name="name" autoComplete="name" required defaultValue={state?.values?.name ?? ""} className="field" /></label>
      <label className="label">Correo<input name="email" type="email" autoComplete="username" required defaultValue={state?.values?.email ?? ""} className="field" /></label>
      <label className="label">Contraseña (mínimo 10 caracteres)<input name="password" type="password" autoComplete="new-password" required minLength={10} className="field" /></label>
      <label className="flex items-start gap-3 text-sm text-slate-900">
        <input name="terms" type="checkbox" className="mt-0.5 h-5 w-5 accent-teal-700" />
        <span>Acepto los <Link href="/terminos" target="_blank" className="font-semibold underline">términos y la política de datos</Link>.</span>
      </label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">{pending ? "Creando cuenta…" : "Crear cuenta"}</button>
      <p className="text-center text-sm text-slate-800">¿Ya tienes cuenta? <Link href="/login" className="font-semibold underline">Ingresar</Link></p>
    </form>
  );
}
