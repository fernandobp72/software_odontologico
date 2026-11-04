"use client";

import { useActionState } from "react";
import { SUPPLY_CATALOG, SUPPLY_CATEGORIES, SUPPLY_UNITS } from "@/lib/supplies-catalog";
import { unitLabel } from "@/lib/inventory";
import { addFromCatalog, addKitLine, upgradeOldItems, consumeStock, createItem, discardExpired, receiveStock, removeKitLine, saveItem } from "./actions";

const Msg = ({ s }: { s: { error?: string; ok?: string } | undefined }) => (
  <>
    {s?.error && <p role="alert" className="error-text">{s.error}</p>}
    {s?.ok && <p className="ok-text">{s.ok}</p>}
  </>
);

type Pack = { packLabel: string | null; packSize: number | null };

// «Cantidad» con la unidad de uso o, si el producto viene empacado, también por empaque (2 cajas = 100 carpules).
function QtyField({ unit, pack }: { unit: string; pack: Pack }) {
  return (
    <div className="label">
      <span>Cantidad</span>
      <div className="flex gap-2">
        <input name="quantity" type="number" inputMode="numeric" min={1} required aria-label="Cantidad" className="field min-w-0 flex-1" />
        {pack.packSize && pack.packLabel ? (
          <select name="inPack" aria-label="Unidad" className="field w-auto shrink-0" defaultValue="unit">
            <option value="unit">{unitLabel(unit, 2)}</option>
            <option value="pack">{unitLabel(pack.packLabel, 2)} de {pack.packSize}</option>
          </select>
        ) : <span className="self-center text-sm text-slate-800">{unitLabel(unit, 2)}</span>}
      </div>
    </div>
  );
}

export function ReceiveForm({ itemId, unit, perishable, pack }: { itemId: string; unit: string; perishable: boolean; pack: Pack }) {
  const [state, action, pending] = useActionState(receiveStock.bind(null, itemId), undefined);
  return (
    <form action={action} className="space-y-3">
      <h3 className="font-semibold text-slate-900">Ingreso</h3>
      <QtyField unit={unit} pack={pack} />
      <label className="label">{perishable ? "Vence" : "Vence (opcional)"}<input name="expiresAt" type="date" required={perishable} className="field" /></label>
      <label className="label">Lote (opcional)<input name="lotCode" maxLength={40} className="field" /></label>
      <Msg s={state} />
      <button disabled={pending} className="btn-primary min-h-11">{pending ? "Guardando…" : "Registrar ingreso"}</button>
    </form>
  );
}

export function ConsumeForm({ itemId, unit, pack }: { itemId: string; unit: string; pack: Pack }) {
  const [state, action, pending] = useActionState(consumeStock.bind(null, itemId), undefined);
  return (
    <form action={action} className="space-y-3">
      <h3 className="font-semibold text-slate-900">Salida</h3>
      <QtyField unit={unit} pack={pack} />
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
        <label className="label">Viene en (opcional)<input name="packLabel" maxLength={20} placeholder="caja" className="field" /></label>
        <label className="label">Trae cuántas unidades<input name="packSize" type="number" inputMode="numeric" min={2} placeholder="50" className="field" /></label>
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-slate-900"><input type="checkbox" name="perishable" defaultChecked className="h-5 w-5 accent-teal-700" /> Vence (pedir fecha al ingresar)</label>
      <Msg s={state} />
      <button disabled={pending} className="btn-secondary min-h-11">{pending ? "Agregando…" : "Agregar producto"}</button>
    </form>
  );
}

export function KitAddForm({ procId, items }: { procId: string; items: { id: string; label: string }[] }) {
  const [state, action, pending] = useActionState(addKitLine.bind(null, procId), undefined);
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[1fr_7rem]">
        <label className="label">Insumo
          <select name="itemId" required defaultValue="" className="field">
            <option value="" disabled>Selecciona…</option>
            {items.map((i) => <option key={i.id} value={i.id}>{i.label}</option>)}
          </select>
        </label>
        <label className="label">Cantidad<input name="quantity" type="number" inputMode="numeric" min={1} defaultValue={1} required className="field" /></label>
      </div>
      <Msg s={state} />
      <button disabled={pending} className="btn-secondary min-h-11">{pending ? "Guardando…" : "Agregar al kit"}</button>
    </form>
  );
}

export function KitRemoveButton({ lineId }: { lineId: string }) {
  return (
    <form action={removeKitLine.bind(null, lineId)}>
      <button className="min-h-11 px-2 text-sm font-semibold text-red-800 underline">Quitar</button>
    </form>
  );
}

export function UpgradeBanner({ names }: { names: string[] }) {
  const [state, action, pending] = useActionState(upgradeOldItems, undefined);
  return (
    <form action={action} className="card space-y-2 border-amber-500">
      <p className="font-semibold text-slate-900">{names.length} producto{names.length === 1 ? "" : "s"} se cuenta{names.length === 1 ? "" : "n"} por caja y no sirve{names.length === 1 ? "" : "n"} para los kits</p>
      <p className="muted">{names.join(", ")}. Al actualizar, las existencias pasan a unidad de uso (por ejemplo 2 cajas de guantes pasan a 100 pares), con su empaque y su mínimo. El historial y los lotes se ajustan solos.</p>
      <Msg s={state} />
      <button disabled={pending} className="btn-primary min-h-11">{pending ? "Actualizando…" : "Actualizar ahora"}</button>
    </form>
  );
}
