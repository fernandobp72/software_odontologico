"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import ConfirmButton from "@/app/confirm-button";
import { copFmt } from "@/lib/cartera";
import { CONTRACTS, NOVELTIES, type NoveltyKey } from "@/lib/empleados";
import { SOURCES, type SourceKey } from "@/lib/finanzas";
import { addNovelty, payRun, retireEmployee, saveEmployee, saveSettings, voidPayRun, type EmpState } from "./actions";

type Emp = { id: string; name: string; document: string | null; position: string; contractType: string; salary: number; payEvery: string; startDate: string; eps: string | null; pension: string | null; cesantias: string | null; arl: string | null; bank: string | null; phone: string | null; note: string | null };

export function EmployeeForm({ emp, today, minWage }: { emp?: Emp; today: string; minWage: number }) {
  const [state, action, pending] = useActionState<EmpState, FormData>(saveEmployee.bind(null, emp?.id ?? null), undefined);
  const [contract, setContract] = useState(emp?.contractType ?? "INDEFINIDO");
  const [salary, setSalary] = useState(String(emp?.salary ?? minWage));
  if (state?.ok && !emp && state.id) {
    return <div className="card space-y-3 border-teal-700"><p className="ok-text text-base">Empleado guardado.</p><Link href={`/finanzas/empleados/${state.id}`} className="btn-primary">Ver su ficha</Link></div>;
  }
  return (
    <form action={action} className="card space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="label">Nombre completo<input name="name" required minLength={3} maxLength={120} defaultValue={emp?.name} className="field" /></label>
        <label className="label">Cédula<input name="document" maxLength={30} defaultValue={emp?.document ?? ""} inputMode="numeric" className="field" /></label>
        <label className="label">Cargo<input name="position" required maxLength={80} defaultValue={emp?.position} list="positions" className="field" /></label>
        <datalist id="positions">{["Auxiliar de odontología", "Recepción", "Aseo", "Higienista", "Administración"].map((p) => <option key={p} value={p} />)}</datalist>
        <label className="label">Tipo de contrato
          <select name="contractType" value={contract} onChange={(e) => setContract(e.target.value)} className="field">{Object.entries(CONTRACTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </label>
        <label className="label">Salario mensual pactado (COP)<input name="salary" type="number" min={1} step={1} required value={salary} onChange={(e) => setSalary(e.target.value)} inputMode="numeric" className="field font-bold" /></label>
        <label className="label">Se le paga
          <select name="payEvery" defaultValue={emp?.payEvery ?? "QUINCENAL"} className="field"><option value="QUINCENAL">Cada quincena</option><option value="MENSUAL">Cada mes</option></select>
        </label>
        <label className="label">Fecha de ingreso<input name="startDate" type="date" required defaultValue={emp?.startDate ?? today} max={today} className="field" /></label>
        <label className="label">Celular<input name="phone" maxLength={30} defaultValue={emp?.phone ?? ""} inputMode="tel" className="field" /></label>
      </div>
      {contract === "PRESTACION" && <p className="font-semibold text-amber-800">Ojo: si la persona cumple horario y recibe órdenes, puede ser en realidad una relación laboral aunque el contrato diga prestación de servicios. Revísalo con un abogado laboral.</p>}
      {contract !== "PRESTACION" && Number(salary) > 0 && Number(salary) < minWage && <p className="font-semibold text-amber-800">El salario es menor al mínimo de referencia ({copFmt.format(minWage)}) para tiempo completo.</p>}
      <details className="rounded-lg border border-slate-300 px-3" open={!!emp}>
        <summary className="cursor-pointer text-sm font-semibold text-slate-800">Seguridad social y cuenta (opcional)</summary>
        <div className="grid gap-3 pb-3 sm:grid-cols-2">
          <label className="label">EPS<input name="eps" maxLength={60} defaultValue={emp?.eps ?? ""} className="field" /></label>
          <label className="label">Fondo de pensión<input name="pension" maxLength={60} defaultValue={emp?.pension ?? ""} className="field" /></label>
          <label className="label">Fondo de cesantías<input name="cesantias" maxLength={60} defaultValue={emp?.cesantias ?? ""} className="field" /></label>
          <label className="label">ARL<input name="arl" maxLength={60} defaultValue={emp?.arl ?? ""} className="field" /></label>
          <label className="label sm:col-span-2">Dónde se le consigna (banco, cuenta, Nequi)<input name="bank" maxLength={120} defaultValue={emp?.bank ?? ""} className="field" /></label>
          <label className="label sm:col-span-2">Nota<input name="note" maxLength={300} defaultValue={emp?.note ?? ""} className="field" /></label>
        </div>
      </details>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && emp && <p className="ok-text">Guardado</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : emp ? "Guardar cambios" : "Guardar empleado"}</button>
    </form>
  );
}

export function NoveltyForm({ employeeId, today }: { employeeId: string; today: string }) {
  const [state, action, pending] = useActionState<EmpState, FormData>(addNovelty.bind(null, employeeId), undefined);
  const [kind, setKind] = useState<NoveltyKey>("ADELANTO");
  const noAmount = NOVELTIES[kind].sign === 0;
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(NOVELTIES) as NoveltyKey[]).map((k) => (
          <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`min-h-11 rounded-full border px-3 text-sm font-semibold ${kind === k ? "border-teal-700 bg-teal-700 text-white" : "border-slate-500 bg-white text-slate-900"}`}>{NOVELTIES[k].label}</button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-3 sm:grid-cols-3">
        {!noAmount && <label className="label">Valor (COP)<input name="amount" type="number" min={1} step={1} required inputMode="numeric" className="field font-bold" /></label>}
        <label className="label">Fecha<input name="date" type="date" defaultValue={today} required className="field" /></label>
        <label className="label">{noAmount ? "Fechas o detalle" : "Nota (opcional)"}<input name="note" maxLength={200} required={noAmount} className="field" placeholder={noAmount ? "Ej.: del 3 al 7 de noviembre" : ""} /></label>
      </div>
      {noAmount && <p className="muted">Queda registrada para el contador; su efecto en el pago lo define él.</p>}
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Novedad guardada. Se aplica en el próximo pago.</p>}
      <button disabled={pending} className="btn-secondary">{pending ? "Guardando…" : "Agregar novedad"}</button>
    </form>
  );
}

export function RetireForm({ id, today }: { id: string; today: string }) {
  const [state, action] = useActionState<EmpState, FormData>(retireEmployee.bind(null, id), undefined);
  return (
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-red-700">Registrar retiro</summary>
      <form action={action} className="mt-2 flex flex-wrap items-end gap-2">
        <label className="label">Fecha de retiro<input name="endDate" type="date" defaultValue={today} className="field mt-1" /></label>
        <ConfirmButton confirmLabel="Sí, registrar retiro">Registrar retiro</ConfirmButton>
      </form>
      <p className="muted mt-1">La liquidación final (prestaciones, vacaciones e indemnización si aplica) la calcula tu contador.</p>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
    </details>
  );
}

export type RunRow = { id: string; name: string; position: string; base: number; transport: number; additions: number; deductions: number; contributions: number; total: number; novelties: string[]; paid: boolean };

export function PayRunForm({ periodKey, label, rows, hasOpenCash }: { periodKey: string; label: string; rows: RunRow[]; hasOpenCash: boolean }) {
  const [state, action, pending] = useActionState<EmpState, FormData>(payRun.bind(null, periodKey), undefined);
  const [on, setOn] = useState<Set<string>>(new Set(rows.filter((r) => !r.paid).map((r) => r.id)));
  const [totals, setTotals] = useState<Record<string, string>>(Object.fromEntries(rows.map((r) => [r.id, String(r.total)])));
  const [source, setSource] = useState<SourceKey>("BANK");
  const grand = rows.filter((r) => on.has(r.id)).reduce((s, r) => s + (Number(totals[r.id]) || 0), 0);
  if (state?.ok && state.id) {
    return <div className="card space-y-3 border-teal-700"><p className="ok-text text-base">Pago registrado. Cada pago quedó como gasto en Finanzas.</p><Link href={`/finanzas/empleados/pago/${state.id}`} className="btn-primary">Ver comprobantes</Link></div>;
  }
  return (
    <form action={action} className="space-y-4">
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id} className={`card space-y-2 ${r.paid ? "opacity-70" : ""}`}>
            <label className="flex items-start gap-3">
              <input type="checkbox" name="employeeId" value={r.id} disabled={r.paid} checked={on.has(r.id)} onChange={() => { const n = new Set(on); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); setOn(n); }} className="mt-1 h-5 w-5" />
              <span className="flex-1">
                <span className="block font-semibold">{r.name}</span>
                <span className="muted">{r.position}{r.paid ? " · ya se le pagó este periodo" : ""}</span>
              </span>
            </label>
            {!r.paid && (
              <>
                <dl className="grid grid-cols-2 gap-x-3 text-sm sm:grid-cols-4">
                  <div><dt className="muted">Básico</dt><dd>{copFmt.format(r.base)}</dd></div>
                  {r.transport > 0 && <div><dt className="muted">Auxilio de transporte</dt><dd>{copFmt.format(r.transport)}</dd></div>}
                  {r.additions > 0 && <div><dt className="muted">Suma</dt><dd>+{copFmt.format(r.additions)}</dd></div>}
                  {r.deductions > 0 && <div><dt className="muted">Resta</dt><dd>−{copFmt.format(r.deductions)}</dd></div>}
                </dl>
                {r.contributions > 0 && <p className="text-xs text-slate-700">Incluye {copFmt.format(r.contributions)} de aportes del empleado a salud y pensión (4 % + 4 %, sugerido).</p>}
                {r.novelties.length > 0 && <p className="text-xs text-slate-700">Novedades: {r.novelties.join(" · ")}</p>}
                <label className="label">A pagar<input name={`total_${r.id}`} type="number" min={1} step={1} value={totals[r.id]} onChange={(e) => setTotals({ ...totals, [r.id]: e.target.value })} inputMode="numeric" className="field font-bold" /></label>
              </>
            )}
          </li>
        ))}
      </ul>
      <fieldset className="card space-y-2">
        <legend className="label">¿De dónde sale la plata?</legend>
        <div className="flex flex-wrap gap-2">{(Object.keys(SOURCES) as SourceKey[]).map((s) => <button key={s} type="button" aria-pressed={source === s} onClick={() => setSource(s)} className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${source === s ? "border-teal-700 bg-teal-700 text-white" : "border-slate-500 bg-white text-slate-900"}`}>{SOURCES[s]}</button>)}</div>
        <input type="hidden" name="source" value={source} />
        {source === "CASH_BOX" && !hasOpenCash && <p className="error-text">No hay caja abierta en esta sede.</p>}
      </fieldset>
      <p className="muted">El total es una sugerencia editable. La liquidación legal, la planilla de seguridad social y la nómina electrónica las hace tu contador o un software de nómina habilitado.</p>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      <ConfirmButton className="btn-primary w-full text-base" confirmClassName="btn-primary" confirmLabel={`Sí, pagar ${copFmt.format(grand)}`} pendingLabel={pending ? "Guardando…" : undefined}>{`Pagar ${label.toLowerCase()} · ${copFmt.format(grand)}`}</ConfirmButton>
    </form>
  );
}

export function VoidPayRun({ id }: { id: string }) {
  const [state, action] = useActionState<EmpState, FormData>(voidPayRun.bind(null, id), undefined);
  return (
    <details>
      <summary className="cursor-pointer text-sm font-semibold text-red-700">Anular este pago</summary>
      <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
        <input name="reason" required minLength={5} placeholder="Motivo" aria-label="Motivo de la anulación" className="field mt-0 min-w-48 flex-1" />
        <ConfirmButton confirmLabel="Sí, anular">Anular</ConfirmButton>
      </form>
      {state?.error && <p role="alert" className="error-text mt-1">{state.error}</p>}
    </details>
  );
}

type SettingsData = { minWage: number; transportAid: number; retHonorarios: number; retServicios: number; retCompras: number; applyRetention: boolean; accountantName: string | null; accountantEmail: string | null };

export function SettingsForm({ s }: { s: SettingsData }) {
  const [state, action, pending] = useActionState<EmpState, FormData>(saveSettings, undefined);
  return (
    <form action={action} className="space-y-4">
      <section className="card space-y-3">
        <h2 className="section-title">Cifras del año</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">Salario mínimo mensual<input name="minWage" type="number" min={100000} step={1} defaultValue={s.minWage} inputMode="numeric" className="field" /></label>
          <label className="label">Auxilio de transporte mensual<input name="transportAid" type="number" min={0} step={1} defaultValue={s.transportAid} inputMode="numeric" className="field" /></label>
        </div>
        <p className="muted">Valores de referencia de 2026. Cámbialos cuando el Gobierno fije los nuevos.</p>
      </section>
      <section className="card space-y-3">
        <h2 className="section-title">Retenciones sugeridas</h2>
        <label className="flex min-h-11 items-center gap-3 text-sm font-semibold text-slate-800"><input type="checkbox" name="applyRetention" defaultChecked={s.applyRetention} className="h-5 w-5" /> Mi contador confirmó que el consultorio practica retención en la fuente</label>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="label">Honorarios (%)<input name="retHonorarios" type="number" min={0} max={50} step={0.1} defaultValue={s.retHonorarios} className="field" /></label>
          <label className="label">Servicios (%)<input name="retServicios" type="number" min={0} max={50} step={0.1} defaultValue={s.retServicios} className="field" /></label>
          <label className="label">Compras (%)<input name="retCompras" type="number" min={0} max={50} step={0.1} defaultValue={s.retCompras} className="field" /></label>
        </div>
        <p className="muted">Son las tarifas que te dé tu contador. El software solo las sugiere; nunca liquida impuestos.</p>
      </section>
      <section className="card space-y-3">
        <h2 className="section-title">Tu contador</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="label">Nombre<input name="accountantName" maxLength={120} defaultValue={s.accountantName ?? ""} className="field" /></label>
          <label className="label">Correo<input name="accountantEmail" type="email" maxLength={160} defaultValue={s.accountantEmail ?? ""} className="field" /></label>
        </div>
      </section>
      {state?.error && <p role="alert" className="error-text">{state.error}</p>}
      {state?.ok && <p className="ok-text">Guardado</p>}
      <button disabled={pending} className="btn-primary">{pending ? "Guardando…" : "Guardar"}</button>
    </form>
  );
}
