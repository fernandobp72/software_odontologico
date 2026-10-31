"use client";

import { useActionState } from "react";
import { changeEmail, changePassword, saveProfile } from "./actions";

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

export function ProfileForm({ name, phone, license, clinical }: { name: string; phone: string | null; license: string | null; clinical: boolean }) {
  const [state, action, pending] = useActionState(saveProfile, undefined);
  return (
    <form action={action} className="card max-w-md space-y-4">
      <h2 className="section-title">Mis datos</h2>
      <label className="label">Nombre completo<input name="name" defaultValue={name} required autoComplete="name" className="field" /></label>
      <label className="label">Celular<input name="phone" type="tel" inputMode="tel" defaultValue={phone ?? ""} autoComplete="tel" className="field" /></label>
      {clinical && (
        <label className="label">Registro profesional (RETHUS o tarjeta profesional)
          <input name="license" defaultValue={license ?? ""} placeholder="Ej. 12345678" className="field" />
        </label>
      )}
      <p className="muted">Tu nombre aparece en las evoluciones, fórmulas y recibos que firmas{clinical ? "; el registro profesional es obligatorio para firmar fórmulas médicas" : ""}.</p>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text" role="status">Guardado</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

export function EmailForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(changeEmail, undefined);
  return (
    <form action={action} key={state?.ok ? "ok" : "form"} className="card max-w-md space-y-4">
      <h2 className="section-title">Correo de ingreso</h2>
      <label className="label">Correo<input name="email" type="email" required defaultValue={email} autoComplete="username" className="field" /></label>
      <label className="label">Contraseña actual (para confirmar)<input name="current" type="password" required autoComplete="current-password" className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text" role="status">Correo actualizado</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Cambiar correo"}</button>
      <p className="muted">Es el correo con el que ingresas y al que llegan los enlaces de recuperación.</p>
    </form>
  );
}
