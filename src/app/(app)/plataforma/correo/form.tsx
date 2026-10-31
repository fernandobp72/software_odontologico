"use client";

import { useActionState, useState, useTransition } from "react";
import { removeMailConfig, saveMailConfig, sendTestMail, type MailState } from "./actions";

type Cfg = { host: string; port: number; secure: boolean; username: string | null; hasPassword: boolean; fromName: string; fromEmail: string } | null;

export default function MailForm({ cfg }: { cfg: Cfg }) {
  const [state, action, pending] = useActionState(saveMailConfig, undefined);
  const [test, setTest] = useState<MailState>();
  const [testing, startTest] = useTransition();
  const [port, setPort] = useState(String(cfg?.port ?? 587));
  const [secure, setSecure] = useState(cfg?.secure ?? false);

  return (
    <div className="space-y-4">
      <form key={cfg?.host ?? "nuevo"} action={action} className="card max-w-xl space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="label sm:col-span-2">Servidor SMTP<input name="host" required defaultValue={cfg?.host ?? ""} placeholder="smtp.tu-proveedor.com" className="field" /></label>
          <label className="label">Puerto<input name="port" inputMode="numeric" required value={port} onChange={(e) => { setPort(e.target.value); setSecure(e.target.value === "465"); }} className="field" /></label>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900">
          <input type="checkbox" name="secure" checked={secure} onChange={(e) => setSecure(e.target.checked)} className="h-5 w-5 accent-teal-700" /> Conexión segura directa (SSL, normalmente puerto 465; con 587 déjalo apagado)
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">Usuario<input name="username" autoComplete="off" defaultValue={cfg?.username ?? ""} className="field" /></label>
          <label className="label">Contraseña<input name="password" type="password" autoComplete="new-password" placeholder={cfg?.hasPassword ? "Guardada (vacío para conservarla)" : ""} className="field" /></label>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">Nombre del remitente<input name="fromName" required defaultValue={cfg?.fromName ?? "Odontología"} className="field" /></label>
          <label className="label">Correo del remitente<input name="fromEmail" type="email" required defaultValue={cfg?.fromEmail ?? ""} placeholder="no-responder@tu-dominio.com" className="field" /></label>
        </div>
        {state?.error && <p role="alert" className="error-text">{state.error}</p>}
        {state?.ok && <p className="ok-text" role="status">{state.info}</p>}
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} className="btn-primary">{pending ? "Comprobando…" : "Guardar y comprobar"}</button>
          {cfg && <button type="button" disabled={testing} className="btn-secondary" onClick={() => startTest(async () => setTest(await sendTestMail()))}>{testing ? "Enviando…" : "Enviarme una prueba"}</button>}
          {cfg && <button type="button" className="btn-danger" onClick={() => { if (window.confirm("¿Quitar la conexión de correo? Dejarán de salir los correos de recuperación.")) void removeMailConfig(); }}>Quitar</button>}
        </div>
        {test?.error && <p role="alert" className="error-text">No se pudo enviar: {test.error}</p>}
        {test?.ok && <p className="ok-text" role="status">{test.info}</p>}
      </form>
      <p className="muted max-w-xl">
        Sirve cualquier proveedor con SMTP: Brevo, Resend, Amazon SES, Zoho, Mailgun o Gmail con «contraseña de aplicación». La contraseña se guarda cifrada y no se vuelve a mostrar. Para que los correos lleguen a la bandeja de entrada (y no a spam), usa un remitente de tu propio dominio con SPF y DKIM configurados en el proveedor.
      </p>
    </div>
  );
}
