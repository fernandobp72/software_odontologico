"use client";

import { useActionState, useState, useTransition } from "react";
import { confirmTwoFactor, disableTwoFactor, startTwoFactor, type TfaState } from "./two-factor-actions";

export default function TwoFactor({ enabled, since }: { enabled: boolean; since: string | null }) {
  const [setup, setSetup] = useState<TfaState>(undefined);
  const [starting, start] = useTransition();
  const [conf, confirmAction, confirming] = useActionState(confirmTwoFactor, undefined);
  const [off, offAction, turningOff] = useActionState(disableTwoFactor, undefined);

  if (enabled && !off?.ok) {
    return (
      <section className="card max-w-md space-y-3">
        <h2 className="section-title">Verificación en dos pasos</h2>
        <p className="ok-text">Activa{since ? ` desde ${since}` : ""}. Al ingresar te pedimos tu contraseña y el código de la app del celular.</p>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-red-700">Desactivarla</summary>
          <form action={offAction} className="mt-2 space-y-3">
            <label className="label">Contraseña actual<input name="current" type="password" required autoComplete="current-password" className="field" /></label>
            <label className="label">Código de la app<input name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="field" /></label>
            {off?.error && <p role="alert" className="error-text">{off.error}</p>}
            <button disabled={turningOff} className="btn-danger">{turningOff ? "Desactivando…" : "Desactivar"}</button>
          </form>
        </details>
        <p className="muted">Si cambias o pierdes el celular, el administrador puede quitarla desde Equipo para que vuelvas a configurarla.</p>
      </section>
    );
  }

  if (conf?.ok) {
    return (
      <section className="card max-w-md space-y-2">
        <h2 className="section-title">Verificación en dos pasos</h2>
        <p className="ok-text">Lista. Desde ahora, al ingresar te pediremos el código de la app. Se cerró la sesión en tus otros dispositivos.</p>
      </section>
    );
  }

  return (
    <section className="card max-w-md space-y-3">
      <h2 className="section-title">Verificación en dos pasos</h2>
      {off?.ok && <p className="ok-text">Desactivada.</p>}
      <p className="muted">Protege tu cuenta aunque alguien conozca tu contraseña: además de la contraseña, se pide un código de 6 números que cambia cada 30 segundos en tu celular (Google Authenticator, Microsoft Authenticator o similar). Recomendada para quien ve historias clínicas.</p>
      {!setup?.qr ? (
        <>
          <button type="button" disabled={starting} onClick={() => start(async () => setSetup(await startTwoFactor()))} className="btn-primary">{starting ? "Preparando…" : "Activar"}</button>
          {setup?.error && <p role="alert" className="error-text">{setup.error}</p>}
        </>
      ) : (
        <form action={confirmAction} className="space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-900">
            <li>Abre la app de códigos en tu celular y toca «Agregar» o «+».</li>
            <li>Escanea este código QR.</li>
            <li>Escribe aquí el código de 6 números que aparece.</li>
          </ol>
          <div className="w-56 rounded-lg bg-white p-2" dangerouslySetInnerHTML={{ __html: setup.qr }} />
          <p className="muted">¿No puedes escanear? Escribe esta clave en la app: <code className="font-mono font-semibold text-slate-900">{setup.secret}</code></p>
          <label className="label">Código de 6 números<input name="code" required inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} className="field" /></label>
          {conf?.error && <p role="alert" className="error-text">{conf.error}</p>}
          <button disabled={confirming} className="btn-primary">{confirming ? "Comprobando…" : "Confirmar y activar"}</button>
        </form>
      )}
    </section>
  );
}
