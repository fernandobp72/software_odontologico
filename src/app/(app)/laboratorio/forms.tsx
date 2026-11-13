"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import ConfirmButton from "@/app/confirm-button";
import { copFmt } from "@/lib/cartera";
import { addDays } from "@/lib/finanzas";
import { REDO_PAYER, WORK_TYPES, type LabStatus } from "@/lib/labs";
import type { PatientOption } from "@/lib/patient-fields";
import PatientPicker from "../patient-picker";
import PayChoice from "../finanzas/pay-choice";
import { createLabOrder, registerLabInvoice, setLabCost, setLabStatus, voidLabOrder, type LabState } from "./actions";

export type OrderPrefill = { patient: PatientOption | null; itemId?: string; itemLabel?: string; tooth?: number | null; material?: string | null; workType?: string; redoOf?: { id: string; number: number; labName: string; cost: number } };

export function LabOrderForm({ today, labs, prefill }: { today: string; labs: string[]; prefill: OrderPrefill }) {
  const [state, action, pending] = useActionState<LabState, FormData>(createLabOrder, undefined);
  const [payer, setPayer] = useState<string>("LAB");
  if (state?.ok && state.orderId) {
    return (
      <div className="card space-y-3 border-teal-700">
        <p className="ok-text text-base">Orden enviada al laboratorio.</p>
        <div className="flex flex-wrap gap-2">
          <Link href={`/laboratorio/${state.orderId}`} className="btn-primary">Ver la orden</Link>
          <Link href="/laboratorio" className="btn-secondary">Volver a Laboratorio</Link>
        </div>
      </div>
    );
  }
  const redo = prefill.redoOf;
  return (
    <form action={action} className="card space-y-4">
      {prefill.itemId && <input type="hidden" name="itemId" value={prefill.itemId} />}
      {redo && <input type="hidden" name="redoOfId" value={redo.id} />}
      {prefill.patient && (prefill.itemId || redo) ? (
        <>
          <input type="hidden" name="patientId" value={prefill.patient.id} />
          <p className="text-base"><span className="font-semibold">{prefill.patient.label}</span>{prefill.itemLabel ? ` · ${prefill.itemLabel}` : ""}</p>
        </>
      ) : (
        <PatientPicker initial={prefill.patient} />
      )}
      {redo && (
        <fieldset className="space-y-3 rounded-lg border border-amber-600 p-3">
          <legend className="px-1 text-sm font-semibold">Repetición de la orden {redo.number}</legend>
          <label className="label">Causa<input name="redoReason" required minLength={5} maxLength={200} className="field" placeholder="Ej.: no ajustó el margen, color equivocado" /></label>
          <label className="label">¿Quién asume el costo?
            <select name="redoPayer" value={payer} onChange={(e) => setPayer(e.target.value)} className="field">{Object.entries(REDO_PAYER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </label>
        </fieldset>
      )}
      <label className="label">Laboratorio
        <input name="labName" required minLength={2} maxLength={120} list="labs" defaultValue={redo?.labName} className="field" autoComplete="off" placeholder="Ej.: Laboratorio Dental Express" />
        <datalist id="labs">{labs.map((l) => <option key={l} value={l} />)}</datalist>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Tipo de trabajo
          <input name="workType" required minLength={2} maxLength={80} list="work-types" defaultValue={prefill.workType} className="field" />
          <datalist id="work-types">{WORK_TYPES.map((w) => <option key={w} value={w} />)}</datalist>
        </label>
        <label className="label">Diente (opcional)<input name="tooth" type="number" min={11} max={85} defaultValue={prefill.tooth ?? undefined} inputMode="numeric" className="field" /></label>
        <label className="label">Color (opcional)<input name="shade" maxLength={20} className="field" placeholder="Ej.: A2" /></label>
        <label className="label">Material (opcional)<input name="material" maxLength={60} defaultValue={prefill.material ?? ""} className="field" /></label>
        <label className="label">Fecha prometida<input name="promisedAt" type="date" min={today} defaultValue={addDays(today, 8)} className="field" /></label>
        {!(redo && payer === "LAB") && <label className="label">Costo del laboratorio (COP)<input name="cost" type="number" min={0} step={1} required defaultValue={redo?.cost} inputMode="numeric" className="field font-bold" /></label>}
        {redo && payer === "LAB" && <input type="hidden" name="cost" value={0} />}
      </div>
      <label className="label">Indicaciones (opcional)<textarea name="instructions" maxLength={500} rows={3} className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full text-base">{pending ? "Guardando…" : "Enviar a laboratorio"}</button>
    </form>
  );
}

const STEP_LABEL: Partial<Record<LabStatus, string>> = { RECEIVED: "Marcar recibido", PLACED: "Marcar colocado", ADJUST: "Devolver para ajuste" };

export function LabStatusButton({ id, to, compact = false }: { id: string; to: LabStatus; compact?: boolean }) {
  const [state, action, pending] = useActionState<LabState, FormData>(setLabStatus.bind(null, id, to), undefined);
  return (
    <form action={action} className={to === "ADJUST" && !compact ? "w-full space-y-2" : "inline"}>
      {to === "ADJUST" && <input name="note" required maxLength={300} placeholder="Qué hay que ajustar" aria-label="Qué hay que ajustar" className="field mt-0" />}
      <button disabled={pending} className={to === "ADJUST" ? "btn-secondary min-h-10" : "btn-primary min-h-10"}>{pending ? "Guardando…" : STEP_LABEL[to]}</button>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
    </form>
  );
}

export function LabCostForm({ id, cost }: { id: string; cost: number }) {
  const [state, action, pending] = useActionState<LabState, FormData>(setLabCost.bind(null, id), undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <label className="label">Costo (COP)<input name="cost" type="number" min={0} step={1} defaultValue={cost} inputMode="numeric" className="field mt-1 w-40" /></label>
      <button disabled={pending} className="btn-secondary">{pending ? "Guardando…" : "Corregir costo"}</button>
      {state?.ok && <span className="ok-text">Guardado</span>}
      {state?.error && <span role="alert" className="error-text">{state.error}</span>}
    </form>
  );
}

export function VoidLabOrder({ id }: { id: string }) {
  const [state, action] = useActionState<LabState, FormData>(voidLabOrder.bind(null, id), undefined);
  return (
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-red-700">Anular esta orden</summary>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input name="reason" required minLength={5} placeholder="Motivo" aria-label="Motivo de la anulación" className="field mt-0 min-w-48 flex-1" />
        <ConfirmButton confirmLabel="Sí, anular">Anular</ConfirmButton>
      </form>
      {state?.error && <p role="alert" className="error-text mt-1">{state.error}</p>}
    </details>
  );
}

type InvoiceOrder = { id: string; number: number; label: string; cost: number };

export function LabInvoiceForm({ payeeId, orders, today, hasOpenCash }: { payeeId: string; orders: InvoiceOrder[]; today: string; hasOpenCash: boolean }) {
  const [state, action, pending] = useActionState<LabState, FormData>(registerLabInvoice.bind(null, payeeId), undefined);
  const [checked, setChecked] = useState<Set<string>>(new Set(orders.map((o) => o.id)));
  const expected = orders.filter((o) => checked.has(o.id)).reduce((s, o) => s + o.cost, 0);
  const [amount, setAmount] = useState(String(expected));
  const diff = (Number(amount) || 0) - expected;
  if (state?.ok && state.expenseId) {
    return (
      <div className="space-y-2">
        <p className="ok-text">Factura registrada como gasto.</p>
        <Link href={`/finanzas/gastos/${state.expenseId}`} className="btn-secondary">Ver el gasto</Link>
      </div>
    );
  }
  function toggle(id: string) {
    const n = new Set(checked);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setChecked(n);
    setAmount(String(orders.filter((o) => n.has(o.id)).reduce((s, o) => s + o.cost, 0)));
  }
  return (
    <form action={action} className="space-y-3">
      <fieldset className="space-y-1">
        <legend className="label">Trabajos que cubre la factura</legend>
        {orders.map((o) => (
          <label key={o.id} className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="orderId" value={o.id} checked={checked.has(o.id)} onChange={() => toggle(o.id)} className="h-5 w-5" />
            <span className="flex-1">Orden {o.number} · {o.label}</span>
            <span className="font-semibold">{copFmt.format(o.cost)}</span>
          </label>
        ))}
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="label">Valor de la factura<input name="amount" type="number" min={1} step={1} required value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" className="field font-bold" /></label>
        <label className="label">Tipo de soporte
          <select name="docKind" defaultValue="FACTURA" className="field"><option value="FACTURA">Factura electrónica</option><option value="DOC_SOPORTE">Documento soporte</option><option value="CUENTA_COBRO">Cuenta de cobro</option><option value="RECIBO">Recibo</option></select>
        </label>
        <label className="label">Número<input name="docNumber" maxLength={40} className="field" /></label>
      </div>
      {diff !== 0 && checked.size > 0 && <p className="font-semibold text-amber-800">Diferencia: la factura es {copFmt.format(Math.abs(diff))} {diff > 0 ? "mayor" : "menor"} que lo registrado en las órdenes. Revísala con el laboratorio.</p>}
      <PayChoice today={today} hasOpenCash={hasOpenCash} />
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending || checked.size === 0} className="btn-primary">{pending ? "Guardando…" : "Registrar factura"}</button>
    </form>
  );
}
