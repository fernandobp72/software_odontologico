"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import ConfirmButton from "@/app/confirm-button";
import { copFmt } from "@/lib/cartera";
import { SUGGESTED_RETENTION } from "@/lib/pro-pay";
import PayChoice from "../pay-choice";
import { saveAgreement, settlePro, voidSettlement, type ProState } from "./actions";

export function AgreementForm({ userId, name, percent, deductLab, note }: { userId: string; name: string; percent?: number; deductLab?: boolean; note?: string | null }) {
  const [state, action, pending] = useActionState<ProState, FormData>(saveAgreement.bind(null, userId), undefined);
  const [p, setP] = useState(percent ?? 40);
  const [lab, setLab] = useState(deductLab ?? true);
  return (
    <form action={action} className="space-y-3">
      <p className="text-base text-slate-900">
        A <strong>{name}</strong> le pago el{" "}
        <input name="percent" type="number" min={0} max={100} step={1} value={p} onChange={(e) => setP(Number(e.target.value))} inputMode="numeric" aria-label="Porcentaje" className="field inline-block w-20 text-center font-bold" /> % de lo que el paciente ya pagó
        {lab ? ", después de descontar el laboratorio." : "."}
      </p>
      <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-800">
        <input type="checkbox" name="deductLab" checked={lab} onChange={(e) => setLab(e.target.checked)} className="h-5 w-5" /> Descontar el costo del laboratorio antes del porcentaje
      </label>
      <label className="label">Nota (opcional)<input name="note" defaultValue={note ?? ""} maxLength={200} className="field" placeholder="Ej.: acuerdo firmado en enero" /></label>
      <p className="muted">Como referencia de mercado, no como norma: 30 a 40 % para odontología general y 40 a 50 % para especialistas.</p>
      <div className="flex flex-wrap items-center gap-3">
        <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar acuerdo"}</button>
        {state?.ok && <span className="ok-text">Acuerdo guardado</span>}
        {state?.error && <span role="alert" className="error-text">{state.error}</span>}
      </div>
    </form>
  );
}

export function SettleForm({ userId, due, today, hasOpenCash, retRate = SUGGESTED_RETENTION * 100, applyRetention = false }: { userId: string; due: number; today: string; hasOpenCash: boolean; retRate?: number; applyRetention?: boolean }) {
  const [state, action, pending] = useActionState<ProState, FormData>(settlePro.bind(null, userId), undefined);
  const [adj, setAdj] = useState<{ amount: string; note: string }[]>([]);
  const adjTotal = adj.reduce((s, a) => s + (Number(a.amount) || 0), 0);
  const total = due + adjTotal;
  const [retention, setRetention] = useState("");

  if (state?.ok && state.settlementId) {
    return (
      <div className="card space-y-3 border-teal-700">
        <p className="ok-text text-base">Liquidación cerrada. Quedó registrada como gasto en Finanzas.</p>
        <Link href={`/finanzas/profesionales/liquidacion/${state.settlementId}`} className="btn-primary">Ver el comprobante</Link>
      </div>
    );
  }

  return (
    <form action={action} className="card space-y-4">
      <h2 className="section-title">Liquidar y pagar</h2>
      <input type="hidden" name="expectedTotal" value={due} />
      <div className="space-y-2">
        <p className="label">Ajustes (opcional)</p>
        {adj.map((a, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[10rem_1fr_auto]">
            <input name="adjAmount" type="number" step={1} value={a.amount} onChange={(e) => setAdj(adj.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} inputMode="numeric" aria-label="Valor del ajuste" placeholder="-50000 o 20000" className="field mt-0" />
            <input name="adjNote" value={a.note} onChange={(e) => setAdj(adj.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))} required minLength={5} maxLength={200} aria-label="Por qué" placeholder="Por qué (obligatorio)" className="field mt-0" />
            <button type="button" onClick={() => setAdj(adj.filter((_, j) => j !== i))} className="btn-secondary">Quitar</button>
          </div>
        ))}
        <button type="button" onClick={() => setAdj([...adj, { amount: "", note: "" }])} className="btn-secondary">+ Ajuste</button>
        <p className="muted">Un valor negativo resta (anticipo, material que asumió la clínica); uno positivo suma.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Soporte que entrega el profesional
          <select name="docKind" defaultValue="CUENTA_COBRO" className="field">
            <option value="FACTURA">Factura electrónica</option>
            <option value="DOC_SOPORTE">Documento soporte</option>
            <option value="CUENTA_COBRO">Cuenta de cobro</option>
            <option value="NONE">Sin especificar</option>
          </select>
        </label>
        <label className="label">Número del soporte (opcional)<input name="docNumber" maxLength={40} className="field" /></label>
      </div>
      <label className="label">Retención (opcional)
        <input name="retention" type="number" min={0} step={1} value={retention} onChange={(e) => setRetention(e.target.value)} inputMode="numeric" className="field" />
        <button type="button" onClick={() => setRetention(String(Math.round((total * retRate) / 100)))} className="mt-1 text-sm font-semibold text-teal-800 underline">Sugerir {retRate.toLocaleString("es-CO")} %</button>
      </label>
      <p className="muted">{applyRetention ? "Tu contador confirmó que el consultorio practica retención: revisa el valor sugerido." : "Este pago podría llevar retención; revísalo con tu contador."} Antes de pagar, pide la planilla de seguridad social del profesional.</p>

      <PayChoice today={today} hasOpenCash={hasOpenCash} />

      <dl className="rounded-lg bg-slate-100 p-3 text-sm">
        <div className="flex justify-between"><dt>Lo que se le debe</dt><dd className="font-semibold">{copFmt.format(due)}</dd></div>
        {adjTotal !== 0 && <div className="flex justify-between"><dt>Ajustes</dt><dd className="font-semibold">{copFmt.format(adjTotal)}</dd></div>}
        {Number(retention) > 0 && <div className="flex justify-between"><dt>Retención</dt><dd className="font-semibold">−{copFmt.format(Number(retention))}</dd></div>}
        <div className="mt-1 flex justify-between border-t border-slate-300 pt-1 text-base"><dt className="font-bold">A pagar</dt><dd className="font-bold">{copFmt.format(total - (Number(retention) || 0))}</dd></div>
      </dl>

      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <ConfirmButton className="btn-primary w-full text-base" confirmClassName="btn-primary" confirmLabel={`Sí, liquidar ${copFmt.format(total - (Number(retention) || 0))}`} pendingLabel={pending ? "Guardando…" : undefined}>Liquidar</ConfirmButton>
    </form>
  );
}

export function VoidSettlement({ id }: { id: string }) {
  const [state, action] = useActionState<ProState, FormData>(voidSettlement.bind(null, id), undefined);
  return (
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-red-700">Anular esta liquidación</summary>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input name="reason" required minLength={5} placeholder="Motivo" aria-label="Motivo de la anulación" className="field mt-0 min-w-48 flex-1" />
        <ConfirmButton confirmLabel="Sí, anular">Anular</ConfirmButton>
      </form>
      {state?.error && <p role="alert" className="error-text mt-1">{state.error}</p>}
      {state?.ok && <p className="ok-text mt-1">Anulada. Lo que cubría vuelve a aparecer como pendiente.</p>}
    </details>
  );
}
