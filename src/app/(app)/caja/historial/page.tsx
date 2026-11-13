import Link from "next/link";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { METHODS, copFmt, type MethodKey } from "@/lib/cartera";
import { addDays, dayStart, isDateStr, todayStr } from "@/lib/finanzas";

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

// Historial de caja por fechas: cada cierre con lo cobrado, por medio de pago, y el arqueo.
export default async function CajaHistorialPage({ searchParams }: PageProps<"/caja/historial">) {
  const { user, branch } = await requireBranch();
  const sp = await searchParams;
  const today = todayStr();
  const to = isDateStr(sp.hasta) ? sp.hasta : today;
  const from = isDateStr(sp.desde) && sp.desde <= to ? sp.desde : addDays(to, -30);
  const range = { gte: dayStart(from), lt: dayStart(addDays(to, 1)) };
  const [sessions, payments] = await Promise.all([
    db.cashSession.findMany({ where: { clinicId: user.clinicId, branchId: branch.id, openedAt: range }, orderBy: { openedAt: "desc" }, include: { openedBy: { select: { name: true } } } }),
    db.payment.findMany({ where: { clinicId: user.clinicId, voidedAt: null, receivedAt: range, session: { branchId: branch.id } }, select: { amount: true, method: true, sessionId: true } }),
  ]);
  const total = payments.reduce((s, p) => s + p.amount, 0);
  const byMethod = (Object.keys(METHODS) as MethodKey[]).map((m) => ({ m, total: payments.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0) })).filter((x) => x.total > 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/caja" className="text-sm font-semibold text-teal-800 underline">← Caja</Link>
        <h1 className="page-title mt-2">Historial de caja · {branch.name}</h1>
      </div>
      <form className="card flex flex-wrap items-end gap-3">
        <label className="label">Desde<input type="date" name="desde" defaultValue={from} max={today} className="field mt-1" /></label>
        <label className="label">Hasta<input type="date" name="hasta" defaultValue={to} max={today} className="field mt-1" /></label>
        <button className="btn-primary">Ver</button>
      </form>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card"><dt className="muted">Cobrado en el periodo</dt><dd className="text-xl font-bold text-teal-800">{copFmt.format(total)}</dd></div>
        {byMethod.map((x) => <div key={x.m} className="card"><dt className="muted">{METHODS[x.m]}</dt><dd className="text-xl font-bold">{copFmt.format(x.total)}</dd></div>)}
      </dl>
      <ul className="space-y-2">
        {sessions.map((s) => {
          const t = payments.filter((p) => p.sessionId === s.id).reduce((a, p) => a + p.amount, 0);
          return (
            <li key={s.id} className="card space-y-1 text-sm text-slate-900">
              <p className="font-semibold">{fmt.format(s.openedAt)}{s.closedAt ? ` → ${fmt.format(s.closedAt)}` : " · abierta"} · {s.openedBy.name}</p>
              <p>Cobrado {copFmt.format(t)}{s.closedAt ? <> · Esperado en efectivo {copFmt.format(s.expectedCash ?? 0)} · Contado {copFmt.format(s.countedCash ?? 0)} · <span className={s.difference ? "font-semibold text-red-700" : "font-semibold text-teal-800"}>Diferencia {copFmt.format(s.difference ?? 0)}</span></> : null}</p>
              {s.note && <p className="muted">{s.note}</p>}
            </li>
          );
        })}
        {sessions.length === 0 && <li className="card text-center text-slate-700">No hubo caja en esas fechas</li>}
      </ul>
      {user.role === "ADMIN" && <p className="muted">Para el detalle de cada recibo, descarga los ingresos del mes en <Link href="/finanzas/resultados" className="underline">Finanzas → Resultados</Link>.</p>}
    </div>
  );
}
