"use client";

import { useActionState, useState } from "react";
import type { CatalogEntry, CatalogMaterial } from "@/lib/catalog";
import { adjustPrices, createProcedure, saveProcedure } from "./actions";

export function ProcedureEditor({ e }: { e: CatalogEntry }) {
  const [state, action, pending] = useActionState(saveProcedure.bind(null, e.id), undefined);
  const [mats, setMats] = useState<CatalogMaterial[]>(e.materials);
  const patch = (i: number, p: Partial<CatalogMaterial>) => setMats((cur) => cur.map((m, j) => (j === i ? { ...m, ...p } : p.isDefault ? { ...m, isDefault: false } : m)));
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="materials" value={JSON.stringify(mats)} />
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="label">Tarifa base (COP)
          <input name="price" type="number" min={0} step={1000} defaultValue={e.price} inputMode="numeric" className="field" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold text-slate-900">
          <input name="active" type="checkbox" defaultChecked={e.active} className="h-5 w-5 accent-teal-700" /> Lo ofrece el consultorio
        </label>
      </div>
      <fieldset className="space-y-2">
        <legend className="label">Materiales (si un material tiene precio, reemplaza a la tarifa base)</legend>
        {mats.map((m, i) => (
          <div key={i} className="grid grid-cols-[1fr_8rem] items-center gap-2 sm:grid-cols-[1fr_9rem_auto_auto]">
            <input value={m.name} onChange={(ev) => patch(i, { name: ev.target.value })} aria-label="Material" placeholder="Material" className="field mt-0" />
            <input type="number" min={0} step={1000} value={m.price} onChange={(ev) => patch(i, { price: Number(ev.target.value) || 0 })} aria-label="Precio del material" inputMode="numeric" className="field mt-0" />
            <label className="flex min-h-11 items-center gap-1 text-sm text-slate-900"><input type="radio" name={`default-${e.id}`} checked={m.isDefault} onChange={() => patch(i, { isDefault: true })} className="h-4 w-4 accent-teal-700" />Por defecto</label>
            <button type="button" className="btn-secondary min-h-10" onClick={() => setMats((cur) => cur.filter((_, j) => j !== i))}>Quitar</button>
          </div>
        ))}
        <button type="button" className="btn-secondary min-h-10" onClick={() => setMats((cur) => [...cur, { name: "", price: 0, isDefault: false }])}>Agregar material</button>
      </fieldset>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Guardado</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}

export function CreateProcedureForm({ groups }: { groups: string[] }) {
  const [state, action, pending] = useActionState(createProcedure, undefined);
  return (
    <form action={action} key={state?.ok ? "ok" : "form"} className="card space-y-3">
      <h2 className="section-title">Agregar un procedimiento propio</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Nombre<input name="name" required className="field" /></label>
        <label className="label">Grupo<select name="group" className="field" defaultValue="Otros">{groups.map((g) => <option key={g}>{g}</option>)}</select></label>
        <label className="label">Se aplica a
          <select name="scope" className="field" defaultValue="tooth">
            <option value="tooth">Un diente</option><option value="surface">Superficies de un diente</option><option value="quadrant">Un cuadrante</option><option value="mouth">Toda la boca</option>
          </select>
        </label>
        <label className="label">CUPS (opcional, 6 dígitos)<input name="cups" inputMode="numeric" maxLength={6} className="field" /></label>
        <label className="label">Tarifa base (COP)<input name="price" type="number" min={0} step={1000} defaultValue={0} className="field" /></label>
      </div>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Procedimiento agregado</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Agregando…" : "Agregar"}</button>
    </form>
  );
}

export function AdjustForm({ groups }: { groups: string[] }) {
  const [state, action, pending] = useActionState(adjustPrices, undefined);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="section-title">Ajustar tarifas</h2>
      <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
        <label className="label">Porcentaje (ej. 8 sube 8 %, -5 baja 5 %)<input name="percent" type="number" step="0.5" required className="field" /></label>
        <label className="label">Grupo<select name="group" className="field" defaultValue=""><option value="">Todos</option>{groups.map((g) => <option key={g}>{g}</option>)}</select></label>
        <button disabled={pending} className="btn-secondary">{pending ? "Aplicando…" : "Aplicar"}</button>
      </div>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Tarifas actualizadas (redondeadas a miles de pesos)</p>}
    </form>
  );
}

