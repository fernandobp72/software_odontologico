"use client";

import Link from "next/link";
import { useActionState } from "react";
import { updatePatient } from "../../actions";
import PatientFields, { type PatientValues } from "../../patient-fields";

export default function EditPatientForm({ patientId, values }: { patientId: string; values: PatientValues }) {
  const [state, action, pending] = useActionState(updatePatient.bind(null, patientId), undefined);
  return (
    <form action={action} className="card space-y-4">
      <PatientFields v={values} />
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <div className="flex flex-wrap gap-2">
        <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar cambios"}</button>
        <Link href={`/pacientes/${patientId}`} className="btn-secondary">Cancelar</Link>
      </div>
      <p className="muted">Solo se corrigen datos de identificación y contacto; la historia clínica no cambia. Cada cambio queda registrado.</p>
    </form>
  );
}
