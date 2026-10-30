"use client";

import Link from "next/link";
import { useActionState } from "react";
import { METHODS } from "@/lib/cartera";
import { closeSession, openSession, registerPayment } from "./actions";

export function OpenForm() {
  const [state, action, pending] = useActionState(openSession, undefined);
  return (
    <form action={action} className="card max-w-md space-y-3">
      <h2 className="section-title">Abrir caja</h2>
      <label className="label">Efectivo inicial (COP)
        <input name="openingAmount" type="number" min={0} step={1000} defaultValue={0} inputMode="numeric" className="field" />
      </label>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Abriendo…" : "Abrir caja"}</button>
    </form>
  );
}

export function CloseForm({ sessionId }: { sessionId: string }) {
  const [state, action, pending] = useActionState(closeSession.bind(null, sessionId), undefined);
  return (
    <form action={action} className="card space-y-3">
      <h2 className="section-title">Cerrar caja</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Efectivo contado (COP)
          <input name="countedCash" type="number" min={0} step={1} required inputMode="numeric" className="field" />
        </label>
        <label className="label">Nota (opcional)<input name="note" className="field" /></label>
      </div>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <button disabled={pending} className="btn-danger">{pending ? "Cerrando…" : "Cerrar caja"}</button>
      <p className="muted">Al cerrar se compara el efectivo contado con el esperado y no se pueden registrar más pagos en esta sesión.</p>
    </form>
  );
}

export function PaymentForm({ patients, fixedPatientId, suggested }: { patients?: { id: string; label: string }[]; fixedPatientId?: string; suggested?: number }) {
  const [state, action, pending] = useActionState(registerPayment, undefined);
  return (
    <form action={action} key={state?.receiptId ?? "form"} className="card space-y-3">
      <h2 className="section-title">Registrar pago</h2>
      {fixedPatientId ? (
        <input type="hidden" name="patientId" value={fixedPatientId} />
      ) : (
        <label className="label">Paciente
          <select name="patientId" required className="field" defaultValue="">
            <option value="" disabled>Selecciona…</option>
            {patients?.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Valor recibido (COP)
          <input name="amount" type="number" min={1} step={1} required inputMode="numeric" defaultValue={suggested && suggested > 0 ? suggested : undefined} className="field" />
        </label>
        <label className="label">Medio de pago
          <select name="method" className="field">{Object.entries(METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Referencia (voucher, transferencia)<input name="reference" className="field" /></label>
        <label className="label">Nota<input name="note" className="field" /></label>
      </div>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && state.receiptId && (
        <p className="ok-text">Pago registrado. <Link href={`/recibo/${state.receiptId}`} target="_blank" className="underline">Ver recibo</Link></p>
      )}
      <button disabled={pending} className="btn-primary w-full sm:w-auto">{pending ? "Registrando…" : "Registrar pago"}</button>
    </form>
  );
}
