"use client";

import { useActionState } from "react";
import { deleteTestPatient } from "./actions";

export default function DeleteTestPatient({ patientId, documentNumber }: { patientId: string; documentNumber: string }) {
  const [state, action, pending] = useActionState(deleteTestPatient.bind(null, patientId), undefined);
  return (
    <details className="card border-red-700">
      <summary className="cursor-pointer font-semibold text-red-800">Eliminar paciente de prueba</summary>
      <form action={action} className="mt-3 space-y-3">
        <p className="muted">
          Borra el paciente y todo lo registrado (odontograma, historia, evoluciones, plan, consentimientos, imágenes y citas). No se deshace.
          Solo para datos de prueba: la historia clínica de pacientes reales se conserva por ley. No se puede si tiene recibos o cuentas de cobro.
        </p>
        <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-slate-900">
          <input type="checkbox" name="isTest" className="mt-1 h-5 w-5 accent-teal-700" /> Confirmo que es un paciente de prueba, no una persona real
        </label>
        <label className="label">Escribe el documento ({documentNumber}) para confirmar<input name="document" autoComplete="off" inputMode="numeric" className="field" /></label>
        {state?.error && <p role="alert" className="error-text">{state.error}</p>}
        <button disabled={pending} className="btn-danger">{pending ? "Eliminando…" : "Eliminar definitivamente"}</button>
      </form>
    </details>
  );
}
