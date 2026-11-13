import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { CATEGORIES, PERIODS, categoryLabel, dayStart, dueState, dueText, periodRange, todayStr, type PeriodKey } from "@/lib/finanzas";
import { openDebts, pendingRecurring } from "@/lib/finanzas-data";
import { stopRecurring } from "./actions";

// Resumen del administrador: cuánto entró, cuánto salió, cuánto debo y qué vence esta semana.
export default async function FinanzasPage({ searchParams }: PageProps<"/finanzas">) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/finanzas/gastos");
  const q = (await searchParams).periodo;
  const period: PeriodKey = q === "hoy" || q === "semana" ? q : "mes";
  const today = todayStr();
  const { from, to } = periodRange(period, today);
  const range = { gte: dayStart(from), lt: dayStart(to) };

  const [inflow, outflows, debts, recurring] = await Promise.all([
    db.payment.aggregate({ _sum: { amount: true }, where: { clinicId: user.clinicId, voidedAt: null, receivedAt: range } }),
    db.expensePayment.findMany({ where: { clinicId: user.clinicId, voidedAt: null, paidAt: range }, select: { amount: true, expense: { select: { category: true } } } }),
    openDebts(user.clinicId),
    pendingRecurring(user.clinicId, today.slice(0, 7)),
  ]);

  const entered = inflow._sum.amount ?? 0;
  const left = outflows.reduce((s, p) => s + p.amount, 0);
  const owed = debts.reduce((s, d) => s + d.remaining, 0);
  const soon = debts.filter((d) => ["vencido", "hoy", "semana"].includes(dueState(d.dueDate, today)));
  const soonTotal = soon.reduce((s, d) => s + d.remaining, 0);

  // Deuda por persona, ordenada por el vencimiento más próximo.
  const byPayee = new Map<string, { name: string; total: number; first: Date | null; count: number }>();
  for (const d of debts) {
    const cur = byPayee.get(d.payee.id) ?? { name: d.payee.name, total: 0, first: d.dueDate, count: 0 };
    cur.total += d.remaining;
    cur.count += 1;
    byPayee.set(d.payee.id, cur);
  }
  const byCategory = Object.keys(CATEGORIES)
    .map((k) => ({ k, total: outflows.filter((o) => o.expense.category === k).reduce((s, o) => s + o.amount, 0) }))
    .filter((c) => c.total > 0)
    .sort((a, b) => b.total - a.total);
  const maxCat = byCategory[0]?.total ?? 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Finanzas</h1>
        <Link href="/finanzas/gastos" className="btn-primary">+ Gasto</Link>
      </div>

      <nav aria-label="Periodo" className="flex flex-wrap gap-2">
        {(Object.keys(PERIODS) as PeriodKey[]).map((p) => (
          <Link key={p} href={p === "mes" ? "/finanzas" : `/finanzas?periodo=${p}`} aria-current={p === period ? "true" : undefined} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${p === period ? "border-slate-900 bg-slate-900 text-white" : "border-slate-400 bg-white text-slate-900"}`}>{PERIODS[p]}</Link>
        ))}
      </nav>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card"><dt className="muted">Entró (pagos de pacientes)</dt><dd className="break-words text-2xl font-bold text-teal-800">{copFmt.format(entered)}</dd></div>
        <div className="card"><dt className="muted">Salió (gastos pagados)</dt><dd className="break-words text-2xl font-bold text-slate-900">{copFmt.format(left)}</dd></div>
        <div className="card"><dt className="muted">Quedó</dt><dd className={`break-words text-2xl font-bold ${entered - left < 0 ? "text-red-700" : "text-slate-900"}`}>{copFmt.format(entered - left)}</dd></div>
      </dl>
      <p className="muted -mt-3">Todas las sedes. Cuenta el dinero que de verdad entró y salió, no lo que se debe.</p>

      {recurring.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Gastos de cada mes por confirmar</h2>
          <ul className="space-y-2">
            {recurring.map((r) => (
              <li key={r.id} className="card flex flex-wrap items-center justify-between gap-3">
                <span>
                  <span className="block font-semibold">{r.payee} · {copFmt.format(r.amount)}</span>
                  <span className="muted">{categoryLabel(r.category)} · {dueText(new Date(`${r.dueDate}T00:00:00Z`), today)}. ¿Ya lo pagaste?</span>
                </span>
                <span className="flex flex-wrap gap-2">
                  <Link href={`/finanzas/gastos?recurrente=${r.id}`} className="btn-primary">Registrar</Link>
                  <form action={stopRecurring.bind(null, r.id)}><button className="btn-secondary">Ya no se repite</button></form>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="section-title">Vence esta semana</h2>
          {soon.length > 0 && <span className="font-semibold">{soon.length} pagos por {copFmt.format(soonTotal)}</span>}
        </div>
        <ul className="space-y-2">
          {soon.map((d) => (
            <li key={d.id}>
              <Link href={`/finanzas/gastos/${d.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-teal-700">
                <span>
                  <span className="block font-semibold">{d.payee.name}</span>
                  <span className={dueState(d.dueDate, today) === "vencido" ? "text-sm font-semibold text-red-700" : "muted"}>{dueText(d.dueDate, today)}{d.description ? ` · ${d.description}` : ""}</span>
                </span>
                <span className="flex items-center gap-3"><span className="text-lg font-bold">{copFmt.format(d.remaining)}</span><span className="btn-secondary min-h-10">Pagar</span></span>
              </Link>
            </li>
          ))}
          {soon.length === 0 && <li className="card text-center text-slate-700">Nada vence en los próximos 7 días</li>}
        </ul>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="section-title">Debo {copFmt.format(owed)}</h2>
          <Link href="/finanzas/por-pagar" className="text-sm font-semibold text-teal-800 underline">Ver todo lo que debo</Link>
        </div>
        <ul className="space-y-2">
          {[...byPayee.values()].slice(0, 8).map((p) => (
            <li key={p.name} className="card flex flex-wrap items-center justify-between gap-2">
              <span><span className="block font-semibold">{p.name}</span><span className="muted">{p.count === 1 ? "1 cuenta" : `${p.count} cuentas`} · {dueText(p.first, today)}</span></span>
              <span className="text-lg font-bold">{copFmt.format(p.total)}</span>
            </li>
          ))}
          {byPayee.size === 0 && <li className="card text-center text-slate-700">No le debes a nadie</li>}
        </ul>
      </section>

      {byCategory.length > 0 && (
        <section className="card space-y-3">
          <h2 className="section-title">En qué se fue la plata · {PERIODS[period].toLowerCase()}</h2>
          <ul className="space-y-2">
            {byCategory.map((c) => (
              <li key={c.k}>
                <div className="flex justify-between gap-2 text-sm"><span>{categoryLabel(c.k)}</span><span className="font-semibold">{copFmt.format(c.total)}</span></div>
                <div className="mt-1 h-2 rounded-full bg-slate-200"><div className="h-2 rounded-full bg-teal-700" style={{ width: `${Math.max(2, (c.total / maxCat) * 100)}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card flex flex-wrap items-center justify-between gap-3">
        <span><span className="block font-semibold">Me deben los pacientes</span><span className="muted">Saldos pendientes y antigüedad</span></span>
        <Link href="/cartera" className="btn-secondary">Ver cartera</Link>
      </section>

      <section className="card space-y-2">
        <h2 className="section-title">Para tu contador</h2>
        <p className="muted">Descarga los gastos y pagos del mes en un archivo que abre en Excel. Las retenciones y los impuestos los revisa tu contador: este registro no reemplaza la contabilidad oficial.</p>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/gastos/exportar?mes=${today.slice(0, 7)}`} className="btn-secondary">Gastos de este mes</a>
          <a href={`/api/gastos/exportar?mes=${today.slice(0, 7)}&tipo=pagos`} className="btn-secondary">Pagos de este mes</a>
        </div>
      </section>
    </div>
  );
}
