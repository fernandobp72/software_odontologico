"use client";

import { useActionState } from "react";
import { CONSENT_TEMPLATES } from "@/lib/consents";
import { signConsent } from "./actions";
import SignaturePad from "./signature-pad";

export default function ConsentForm({ patientId, patientName, patientDocument }: { patientId: string; patientName: string; patientDocument: string }) {
  const [state, action, pending] = useActionState(signConsent.bind(null, patientId), undefined);
  return (
    <form action={action} key={state?.ok ? "ok" : "form"} className="card space-y-4">
      <h2 className="section-title">Nuevo consentimiento</h2>
      <p className="rounded-lg border border-amber-600 bg-amber-50 p-3 text-sm text-amber-900">
        Plantillas en borrador: deben ser revisadas por asesoría jurídica antes de usarse con pacientes reales.
      </p>
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
        <label className="label">Testigo (opcional)<input name="witnessName" className="field" /></label>
      </div>
      <SignaturePad name="signature" />
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Consentimiento firmado y guardado</p>}
      <button disabled={pending} className="btn-primary w-full md:w-auto">{pending ? "Guardando…" : "Firmar consentimiento"}</button>
    </form>
  );
}
