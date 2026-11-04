"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePatient } from "../../actions";
import PatientFields, { type PatientValues } from "../../patient-fields";

export default function EditPatientForm({ patientId, values, needsConsent }: { patientId: string; values: PatientValues; needsConsent: boolean }) {
  const [state, action, pending] = useActionState(updatePatient.bind(null, patientId), undefined);
  return (
    <form action={action} className="card space-y-4">
      <PatientFields v={values} />
      {needsConsent && (
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-slate-900">
          <input name="consent" type="checkbox" required className="mt-0.5 h-5 w-5 accent-teal-700" />
          El paciente autoriza el tratamiento de sus datos personales y de salud (Ley 1581 de 2012).
        </label>
      )}
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar cambios"}</button>
        <Link href={`/pacientes/${patientId}`} className="btn-secondary">Cancelar</Link>
      </div>
      <p className="muted">Solo se corrigen datos de identificación y contacto; la historia clínica no cambia. Cada cambio queda registrado.</p>
    </form>
  );
}
