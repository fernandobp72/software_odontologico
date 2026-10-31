"use client";

import { useActionState } from "react";
import { clearWhatsapp, saveClinic, saveWhatsapp } from "./actions";

export default function ClinicForm({ clinic }: { clinic: { name: string; noun: string; nit: string | null; address: string | null; phone: string | null } }) {
  const [state, action, pending] = useActionState(saveClinic, undefined);
  return (
    <form action={action} className="card max-w-xl space-y-4">
      <label className="label">¿Cómo le llamas a tu centro?
        <select name="noun" defaultValue={clinic.noun} className="field">
          <option value="consultorio">Consultorio</option>
          <option value="clinica">Clínica</option>
          <option value="centro">Centro odontológico</option>
        </select>
      </label>
      <label className="label">Nombre<input name="name" defaultValue={clinic.name} required className="field" /></label>
      <label className="label">NIT<input name="nit" defaultValue={clinic.nit ?? ""} className="field" /></label>
      <label className="label">Dirección<input name="address" defaultValue={clinic.address ?? ""} className="field" /></label>
      <label className="label">Teléfono<input name="phone" defaultValue={clinic.phone ?? ""} className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Datos guardados</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar"}</button>
      <p className="muted">Estos datos aparecen en los recibos y en las cuentas de cobro.</p>
    </form>
  );
}

export type WaInfo = { phoneId: string | null; hasToken: boolean; template: string | null; lang: string | null; auto: boolean };

export function WhatsappForm({ wa, noun }: { wa: WaInfo; noun: string }) {
  const [state, action, pending] = useActionState(saveWhatsapp, undefined);
  return (
    <section className="card max-w-xl space-y-4">
      <div>
        <h2 className="section-title">WhatsApp de recordatorios</h2>
        <p className="muted">
          <strong>Sin configurar nada</strong> ya funciona el modo manual: en Recordatorios se abre tu WhatsApp (o WhatsApp Business del celular o computador) con el mensaje listo y solo pulsas enviar.
          Para que los recordatorios salgan <strong>solos desde el número de tu {noun}</strong> conecta aquí tu cuenta de WhatsApp Business (API de Meta).
        </p>
      </div>
      <form key={wa.phoneId ?? "nuevo"} action={action} className="space-y-4">
        <label className="label">Identificador del número (Phone number ID)<input name="phoneId" inputMode="numeric" defaultValue={wa.phoneId ?? ""} placeholder="123456789012345" className="field" /></label>
        <label className="label">Token de acceso permanente
          <input name="token" type="password" autoComplete="off" placeholder={wa.hasToken ? "Guardado (déjalo vacío para conservarlo)" : "Pega el token"} className="field" />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="label">Plantilla aprobada<input name="template" defaultValue={wa.template ?? ""} placeholder="recordatorio_cita" className="field" /></label>
          <label className="label">Idioma de la plantilla<input name="lang" defaultValue={wa.lang ?? ""} placeholder="es" className="field" /></label>
        </div>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900">
          <input type="checkbox" name="auto" defaultChecked={wa.auto} className="h-5 w-5 accent-teal-700" />
          Enviar los recordatorios automáticamente (a quienes autorizaron)
        </label>
        {state?.error && <p role="alert" className="error-text">{state.error}</p>}
        {state?.ok && <p className="ok-text">{state.info}</p>}
        <div className="flex flex-wrap gap-2">
          <button disabled={pending} className="btn-primary">{pending ? "Conectando…" : "Guardar y comprobar"}</button>
          {wa.hasToken && <button className="btn-danger" formAction={clearWhatsapp}>Quitar conexión</button>}
        </div>
      </form>
      <p className="muted">
        La plantilla debe ser de categoría <em>Utilidad</em>, en español, con este cuerpo: «Hola {"{{1}}"}, te recordamos tu cita en {"{{2}}"} el {"{{3}}"} a las {"{{4}}"}. Confirma o cancela aquí: {"{{5}}"}». El token se guarda cifrado y no se vuelve a mostrar. Antes de guardar se comprueba con Meta.
      </p>
    </section>
  );
}
