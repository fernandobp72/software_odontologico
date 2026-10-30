"use client";

import { useActionState } from "react";
import { saveClinic } from "./actions";

export default function ClinicForm({ clinic }: { clinic: { name: string; nit: string | null; address: string | null; phone: string | null } }) {
  const [state, action, pending] = useActionState(saveClinic, undefined);
  return (
    <form action={action} className="card max-w-xl space-y-4">
      <label className="label">Nombre del consultorio<input name="name" defaultValue={clinic.name} required className="field" /></label>
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
