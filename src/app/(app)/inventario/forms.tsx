"use client";

import { useActionState } from "react";
import { SUPPLY_CATALOG, SUPPLY_CATEGORIES, SUPPLY_UNITS } from "@/lib/supplies-catalog";
import { addFromCatalog, consumeStock, createItem, discardExpired, receiveStock, saveItem } from "./actions";

const Msg = ({ s }: { s: { error?: string; ok?: string } | undefined }) => (
  <>
    {s?.error && <p role="alert" className="error-text">{s.error}</p>}
    {s?.ok && <p className="ok-text">{s.ok}</p>}
  </>
);

export function ReceiveForm({ itemId, unit, perishable }: { itemId: string; unit: string; perishable: boolean }) {
  const [state, action, pending] = useActionState(receiveStock.bind(null, itemId), undefined);
  return (
    <form action={action} className="space-y-3">
      <h3 className="font-semibold text-slate-900">Ingreso</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">Cantidad ({unit})<input name="quantity" type="number" inputMode="numeric" min={1} required className="field" /></label>
        <label className="label">{perishable ? "Vence" : "Vence (opcional)"}<input name="expiresAt" type="date" required={perishable} className="field" /></label>
      </div>
      <label className="label">Lote (opcional)<input name="lotCode" maxLength={40} className="field" /></label>
      <Msg s={state} />
      <button disabled={pending} className="btn-primary min-h-11">{pending ? "Guardando…" : "Registrar ingreso"}</button>
    </form>
  );
}

export function ConsumeForm({ itemId, unit }: { itemId: string; unit: string }) {
  const [state, action, pending] = useActionState(consumeStock.bind(null, itemId), undefined);
  return (
    <form action={action} className="space-y-3">
      <h3 className="font-semibold text-slate-900">Salida</h3>
      <label className="label">Cantidad ({unit})<input name="quantity" type="number" inputMode="numeric" min={1} required className="field" /></label>
      <label className="label">Nota (opcional)<input name="note" maxLength={120} placeholder="Ej. consultorio 2" className="field" /></label>
      <p className="muted">Sale primero lo que vence antes.</p>
      <Msg s={state} />
      <button disabled={pending} className="btn-secondary min-h-11">{pending ? "Guardando…" : "Registrar salida"}</button>
    </form>
  );
}

export function DiscardButton({ itemId }: { itemId: string }) {
  return (
    <form action={discardExpired.bind(null, itemId)}>
      <button className="btn-danger min-h-11">Retirar lo vencido</button>
    </form>
  );
}

export function ItemSettings({ itemId, minStock, warnDays, perishable, active }: { itemId: string; minStock: number; warnDays: number; perishable: boolean; active: boolean }) {
  const [state, action, pending] = useActionState(saveItem.bind(null, itemId), undefined);
  return (
    <form action={action} className="space-y-3">
      <h3 className="font-semibold text-slate-900">Ajustes del producto</h3>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">Mínimo en existencia<input name="minStock" type="number" inputMode="numeric" min={0} defaultValue={minStock} className="field" /></label>
        <label className="label">Avisar días antes de vencer<input name="warnDays" type="number" inputMode="numeric" min={1} max={365} defaultValue={warnDays} className="field" /></label>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900"><input type="checkbox" name="perishable" defaultChecked={perishable} className="h-5 w-5 accent-teal-700" /> Vence (pedir fecha al ingresar)</label>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900"><input type="checkbox" name="active" defaultChecked={active} className="h-5 w-5 accent-teal-700" /> Lo uso (si lo quitas, sale de la lista y de las alertas)</label>
      <Msg s={state} />
      <button disabled={pending} className="btn-secondary min-h-11">{pending ? "Guardando…" : "Guardar ajustes"}</button>
    </form>
  );
}

export function CatalogPicker({ existing }: { existing: string[] }) {
  const [state, action, pending] = useActionState(addFromCatalog, undefined);
  const have = new Set(existing);
  const groups = [...new Set(SUPPLY_CATALOG.map((c) => c.category))];
  return (
    <form action={action} className="space-y-4">
      <p className="muted">Marca lo que usas en tu consultorio. Ya vienen con un mínimo y unos días de aviso sugeridos que puedes cambiar después.</p>
      {groups.map((g) => (
        <fieldset key={g} className="space-y-1">
          <legend className="font-semibold text-slate-900">{g}</legend>
          <div className="grid gap-x-4 sm:grid-cols-2">
            {SUPPLY_CATALOG.filter((c) => c.category === g).map((c) => (
              <label key={c.key} className={`flex min-h-11 items-center gap-3 text-sm ${have.has(c.name) ? "text-slate-500" : "cursor-pointer text-slate-900"}`}>
                <input type="checkbox" name="key" value={c.key} disabled={have.has(c.name)} className="h-5 w-5 accent-teal-700" />
                {c.name}{have.has(c.name) ? " — ya agregado" : ""}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <Msg s={state} />
      <button disabled={pending} className="btn-primary min-h-11">{pending ? "Agregando…" : "Agregar los marcados"}</button>
    </form>
  );
}

export function CustomItemForm() {
  const [state, action, pending] = useActionState(createItem, undefined);
  return (
    <form action={action} className="space-y-3">
      <p className="muted">¿Algo que no está en la lista? Agrégalo aquí.</p>
      <label className="label">Nombre<input name="name" required maxLength={80} className="field" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="label">Categoría<select name="category" className="field">{SUPPLY_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="label">Unidad<select name="unit" className="field">{SUPPLY_UNITS.map((u) => <option key={u}>{u}</option>)}</select></label>
        <label className="label">Mínimo<input name="minStock" type="number" inputMode="numeric" min={0} defaultValue={1} className="field" /></label>
        <label className="label">Aviso (días antes de vencer)<input name="warnDays" type="number" inputMode="numeric" min={1} max={365} defaultValue={60} className="field" /></label>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900"><input type="checkbox" name="perishable" defaultChecked className="h-5 w-5 accent-teal-700" /> Vence (pedir fecha al ingresar)</label>
      <Msg s={state} />
      <button disabled={pending} className="btn-secondary min-h-11">{pending ? "Agregando…" : "Agregar producto"}</button>
    </form>
  );
}
