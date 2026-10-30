"use client";

import { useActionState } from "react";
import { createBranch, updateBranch } from "./actions";

type B = { id: string; name: string; address: string | null; phone: string | null };

function Fields({ b }: { b?: B }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="label">Nombre<input name="name" defaultValue={b?.name} required className="field" /></label>
      <label className="label">Dirección<input name="address" defaultValue={b?.address ?? ""} className="field" /></label>
      <label className="label">Teléfono<input name="phone" defaultValue={b?.phone ?? ""} className="field" /></label>
    </div>
  );
}

export function CreateBranchForm() {
  const [state, action, pending] = useActionState(createBranch, undefined);
  return (
    <form action={action} key={state?.ok ? "ok" : "form"} className="card space-y-3">
      <h2 className="section-title">Nueva sede</h2>
      <Fields />
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Sede creada. Asigna personas desde Equipo.</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Creando…" : "Crear sede"}</button>
    </form>
  );
}

export function EditBranchForm({ b }: { b: B }) {
  const [state, action, pending] = useActionState(updateBranch.bind(null, b.id), undefined);
  return (
    <form action={action} className="space-y-3">
      <Fields b={b} />
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Guardado</p>}
      <button disabled={pending} className="btn-secondary">{pending ? "Guardando…" : "Guardar cambios"}</button>
    </form>
  );
}
