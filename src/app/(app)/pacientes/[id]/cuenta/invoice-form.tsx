"use client";

import Link from "next/link";
import { useActionState } from "react";
import { copFmt } from "@/lib/cartera";
import { createInvoice } from "./actions";

export type Unbilled = { id: string; label: string; amount: number };

export default function InvoiceForm({ patientId, items, defaultName, defaultDocument }: { patientId: string; items: Unbilled[]; defaultName: string; defaultDocument: string }) {
  const [state, action, pending] = useActionState(createInvoice.bind(null, patientId), undefined);
  return (
    <form action={action} key={state?.invoiceId ?? "form"} className="card space-y-4">
      <h2 className="section-title">Generar cuenta de cobro</h2>
      <fieldset>
        <legend className="label">Procedimientos realizados sin cuenta de cobro</legend>
        <div className="mt-2 space-y-2">
          {items.map((i) => (
            <label key={i.id} className="flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm text-slate-900 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50">
              <span className="flex items-center gap-3"><input type="checkbox" name="itemIds" value={i.id} defaultChecked className="h-5 w-5 accent-teal-700" />{i.label}</span>
              <span className="font-semibold">{copFmt.format(i.amount)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Cliente (a nombre de quién)<input name="customerName" defaultValue={defaultName} required className="field" /></label>
        <label className="label">Documento del cliente<input name="customerDocument" defaultValue={defaultDocument} className="field" /></label>
      </div>
      <label className="label">Nota (opcional)<input name="note" maxLength={300} className="field" /></label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && state.invoiceId && <p className="ok-text">Cuenta de cobro generada. <Link href={`/cuenta-de-cobro/${state.invoiceId}`} target="_blank" className="underline">Abrir documento</Link></p>}
      <button disabled={pending} className="btn-primary w-full sm:w-auto">{pending ? "Generando…" : "Generar cuenta de cobro"}</button>
      <p className="muted">Es un documento interno de cobro. No es factura electrónica de venta ante la DIAN.</p>
    </form>
  );
}
