"use client";

import { useActionState, useState } from "react";
import { CONSENT_TEMPLATES } from "@/lib/consents";
import { requestConsentSignature, signConsent } from "./actions";
import SignaturePad from "./signature-pad";

export default function ConsentForm({ patientId, patientName, patientDocument }: { patientId: string; patientName: string; patientDocument: string }) {
  const [state, action, pending] = useActionState(signConsent.bind(null, patientId), undefined);
  const [req, reqAction, reqPending] = useActionState(requestConsentSignature.bind(null, patientId), undefined);
  const [remote, setRemote] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async (link: string) => {
    try { await navigator.clipboard.writeText(link); setCopied(true); } catch { /* el enlace queda visible para copiarlo a mano */ }
  };

  return (
    <form action={remote ? reqAction : action} key={state?.ok ? "ok" : "form"} className="card space-y-4">
      <h2 className="section-title">Nuevo consentimiento</h2>
      <p className="rounded-lg border border-amber-600 bg-amber-50 p-3 text-sm text-amber-900">
        Plantillas en borrador: deben ser revisadas por asesoría jurídica antes de usarse con pacientes reales.
      </p>
      <fieldset className="grid gap-2 sm:grid-cols-2">
        <legend className="label mb-1">¿Cómo se firma?</legend>
        {([[false, "Aquí, en esta pantalla", "El paciente firma con el dedo o un lápiz en este aparato."], [true, "El paciente, en su celular", "Genera un QR (en el consultorio) o un enlace (a distancia)."]] as const).map(([v, t, d]) => (
          <label key={String(v)} className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${remote === v ? "border-teal-700 bg-teal-50" : "border-slate-400 bg-white"}`}>
            <input type="radio" name="how" checked={remote === v} onChange={() => setRemote(v)} className="mt-1 h-5 w-5 accent-teal-700" />
            <span><span className="block font-semibold text-slate-900">{t}</span><span className="text-slate-800">{d}</span></span>
          </label>
        ))}
      </fieldset>
      <label className="label">Tipo de consentimiento
        <select name="templateId" className="field">
          {CONSENT_TEMPLATES.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
      </label>
      <label className="label">Procedimiento específico (opcional)
        <input name="procedureNote" placeholder="Ej.: exodoncia del diente 38" className="field" />
      </label>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="label">Nombre de quien firma<input name="signerName" defaultValue={patientName} required className="field" /></label>
        <label className="label">Documento de quien firma<input name="signerDocument" defaultValue={patientDocument} className="field" /></label>
        <label className="label">Calidad
          <select name="signerRelation" className="field">
            {["Paciente", "Padre o madre", "Representante legal", "Acudiente"].map((r) => <option key={r}>{r}</option>)}
          </select>
        </label>
        {remote ? (
          <label className="label">¿Dónde está el paciente?
            <select name="method" className="field">
              <option value="QR">En el consultorio (QR, vence en 2 horas)</option>
              <option value="ENLACE">A distancia (enlace por WhatsApp, vence en 48 horas)</option>
            </select>
          </label>
        ) : (
          <label className="label">Testigo (opcional)<input name="witnessName" className="field" /></label>
        )}
      </div>

      {remote ? (
        <>
          <p className="muted">El paciente verá el documento en su celular, escribirá los últimos 4 dígitos del documento de quien firma y firmará. Queda registrada la fecha, la hora, la red y el aparato desde donde firmó.</p>
          {req?.error && <p role="alert" className="error-text">{req.error}</p>}
          <button disabled={reqPending} className="btn-primary w-full md:w-auto">{reqPending ? "Generando…" : "Generar QR o enlace"}</button>
          {req?.link && (
            <div className="space-y-3 rounded-lg border border-teal-700 bg-teal-50 p-4">
              {req.qr ? (
                <>
                  <p className="font-semibold text-slate-900">Pídele al paciente que escanee este código con la cámara de su celular</p>
                  <div className="mx-auto w-full max-w-64 rounded bg-white p-2" dangerouslySetInnerHTML={{ __html: req.qr }} aria-label="Código QR para firmar" role="img" />
                </>
              ) : (
                <p className="font-semibold text-slate-900">Envía el enlace al paciente</p>
              )}
              <div className="flex flex-wrap gap-2">
                {req.whatsapp && <a href={req.whatsapp} target="_blank" rel="noopener" className="btn-primary min-h-11">Enviar por WhatsApp</a>}
                <button type="button" onClick={() => copy(req.link as string)} className="btn-secondary min-h-11">{copied ? "Enlace copiado" : "Copiar enlace"}</button>
              </div>
              {!req.whatsapp && req.method === "ENLACE" && <p className="muted">El paciente no tiene un celular válido en su ficha: copia el enlace y envíalo por otro medio.</p>}
              <input readOnly value={req.link} onFocus={(e) => e.currentTarget.select()} aria-label="Enlace de firma" className="field text-xs" />
              <p className="muted">Aparece abajo en «Esperando firma» y pasa a «firmados» solo cuando el paciente firme. Este enlace no se vuelve a mostrar.</p>
            </div>
          )}
        </>
      ) : (
        <>
          <SignaturePad name="signature" />
          {state?.error && <p role="alert" className="error-text">{state.error}</p>}
          {state?.ok && <p className="ok-text">Consentimiento firmado y guardado</p>}
          <button disabled={pending} className="btn-primary w-full md:w-auto">{pending ? "Guardando…" : "Firmar consentimiento"}</button>
        </>
      )}
    </form>
  );
}
