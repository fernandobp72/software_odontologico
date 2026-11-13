import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { dateStr, fmtDate, todayStr } from "@/lib/finanzas";
import { financeSettings } from "@/lib/finanzas-data";
import { contractLabel, noveltyLabel, realCost } from "@/lib/empleados";
import { voidNovelty } from "../actions";
import { EmployeeForm, NoveltyForm, RetireForm } from "../forms";

export default async function EmpleadoPage({ params }: PageProps<"/finanzas/empleados/[id]">) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/finanzas/gastos");
  const { id } = await params;
  const e = await db.employee.findFirst({
    where: { id, clinicId: user.clinicId },
    include: { novelties: { where: { voidedAt: null }, orderBy: { date: "desc" }, take: 40 }, payLines: { orderBy: { payRun: { createdAt: "desc" } }, take: 12, include: { payRun: { select: { id: true, label: true, voidedAt: true } } } } },
  });
  if (!e) notFound();
  const s = await financeSettings(user.clinicId);
  const today = todayStr();
  const pending = e.novelties.filter((n) => !n.payLineId);
  const applied = e.novelties.filter((n) => n.payLineId);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/finanzas/empleados" className="text-sm font-semibold text-teal-800 underline">← Empleados</Link>
        <h1 className="page-title mt-2">{e.name}</h1>
        <p className="muted">{e.position} · {contractLabel(e.contractType)} · desde el {fmtDate(e.startDate)}{e.active ? "" : ` · retirado el ${e.endDate ? fmtDate(e.endDate) : ""}`}</p>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card"><dt className="muted">Salario pactado</dt><dd className="text-2xl font-bold">{copFmt.format(e.salary)}</dd></div>
        <div className="card"><dt className="muted">Costo real estimado al mes</dt><dd className="text-2xl font-bold">{copFmt.format(realCost(e.salary, e.contractType))}</dd></div>
      </dl>

      {e.active && (
        <section className="card space-y-3">
          <h2 className="section-title">Novedades</h2>
          <NoveltyForm employeeId={e.id} today={today} />
          {pending.length > 0 && (
            <ul className="divide-y divide-slate-200">
              {pending.map((n) => (
                <li key={n.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span><span className="font-semibold">{noveltyLabel(n.kind)}</span> · {fmtDate(dateStr(n.date))}{n.note ? ` · ${n.note}` : ""}</span>
                  <span className="flex items-center gap-3">{n.amount !== 0 && <span className="font-semibold">{n.amount > 0 ? "+" : "−"}{copFmt.format(Math.abs(n.amount))}</span>}<form action={voidNovelty.bind(null, n.id)}><button className="text-sm font-semibold text-red-700 underline">Quitar</button></form></span>
                </li>
              ))}
            </ul>
          )}
          {applied.length > 0 && <p className="muted">{applied.length} novedades ya aplicadas en pagos anteriores.</p>}
        </section>
      )}

      {e.payLines.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Pagos</h2>
          <ul className="space-y-2">
            {e.payLines.map((l) => (
              <li key={l.id}>
                <Link href={`/finanzas/empleados/pago/${l.payRun.id}`} className={`card flex flex-wrap justify-between gap-2 hover:border-teal-700 ${l.payRun.voidedAt ? "opacity-70" : ""}`}>
                  <span className="font-semibold">{l.payRun.label}{l.payRun.voidedAt ? " · anulado" : ""}</span>
                  <span className="font-bold">{copFmt.format(l.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-title">Ficha</h2>
        <EmployeeForm today={today} minWage={s.minWage} emp={{ ...e, startDate: dateStr(e.startDate) }} />
      </section>
      {e.active && <section className="card"><RetireForm id={e.id} today={today} /></section>}
    </div>
  );
}
