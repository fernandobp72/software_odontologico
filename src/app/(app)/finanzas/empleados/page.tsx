import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { fmtDate, todayStr } from "@/lib/finanzas";
import { contractLabel, currentPeriodKey, isLabor, legalDates, periodInfo, realCost } from "@/lib/empleados";

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });

// Pagos a empleados: ficha, novedades, pagar quincena y fechas legales. La nómina legal la liquida el contador.
export default async function EmpleadosPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/finanzas/gastos");
  const today = todayStr();
  const [employees, runs] = await Promise.all([
    db.employee.findMany({ where: { clinicId: user.clinicId, active: true }, orderBy: { name: "asc" }, include: { _count: { select: { novelties: { where: { voidedAt: null, payLineId: null } } } } } }),
    db.payRun.findMany({ where: { clinicId: user.clinicId }, orderBy: { createdAt: "desc" }, take: 12, select: { id: true, number: true, label: true, total: true, createdAt: true, voidedAt: true } }),
  ]);
  const labor = employees.some((e) => isLabor(e.contractType));
  const dates = labor ? legalDates(today) : [];
  const monthly = employees.reduce((s, e) => s + e.salary, 0);
  const cost = employees.reduce((s, e) => s + realCost(e.salary, e.contractType), 0);
  const period = periodInfo(currentPeriodKey(today))!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Pagos a empleados</h1>
        <span className="flex flex-wrap gap-2">
          <Link href="/finanzas/empleados/nuevo" className="btn-secondary">+ Empleado</Link>
          {employees.length > 0 && <Link href={`/finanzas/empleados/pagar?periodo=${period.key}`} className="btn-primary">Pagar {period.label.split(" de ")[0]}</Link>}
        </span>
      </div>
      <p className="muted">El software lleva la ficha, las novedades y los pagos, y recuerda las fechas. La liquidación legal, la planilla de seguridad social (PILA) y la nómina electrónica las hace tu contador o un software de nómina habilitado.</p>

      {employees.length > 0 && (
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="card"><dt className="muted">Salarios pactados al mes</dt><dd className="text-2xl font-bold">{copFmt.format(monthly)}</dd></div>
          <div className="card"><dt className="muted">Costo real estimado al mes</dt><dd className="text-2xl font-bold">{copFmt.format(cost)}</dd><dd className="muted">Estimación con aportes y prestaciones (cerca de 1,55 veces el salario).</dd></div>
        </dl>
      )}

      {dates.length > 0 && (
        <section className="card space-y-2">
          <h2 className="section-title">Fechas legales que vienen</h2>
          <ul className="space-y-1 text-sm">
            {dates.map((d) => (
              <li key={d.label + d.date} className="flex flex-wrap justify-between gap-2">
                <span><span className="font-semibold">{d.label}</span>{d.note ? <span className="muted"> · {d.note}</span> : null}</span>
                <span className={d.days <= 7 ? "font-semibold text-amber-800" : ""}>{d.days === 0 ? "Hoy" : d.days === 1 ? "Mañana" : `${fmtDate(d.date)} · en ${d.days} días`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="space-y-2">
        {employees.map((e) => (
          <li key={e.id}>
            <Link href={`/finanzas/empleados/${e.id}`} className="card flex flex-wrap items-center justify-between gap-3 hover:border-teal-700">
              <span>
                <span className="block font-semibold">{e.name}</span>
                <span className="muted">{e.position} · {contractLabel(e.contractType)} · {e.payEvery === "MENSUAL" ? "mensual" : "quincenal"}</span>
                {e._count.novelties > 0 && <span className="block text-sm text-amber-800">{e._count.novelties} {e._count.novelties === 1 ? "novedad pendiente" : "novedades pendientes"}</span>}
                {e.contractType === "PRESTACION" && <span className="block text-sm text-amber-800">Prestación de servicios: revisa que no cumpla horario ni reciba órdenes.</span>}
              </span>
              <span className="text-lg font-bold">{copFmt.format(e.salary)}</span>
            </Link>
          </li>
        ))}
        {employees.length === 0 && <li className="card text-center text-slate-700">Aún no hay empleados. Agrega a la auxiliar, recepción o aseo.</li>}
      </ul>

      {runs.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Pagos anteriores</h2>
          <ul className="space-y-2">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`/finanzas/empleados/pago/${r.id}`} className={`card flex flex-wrap items-center justify-between gap-2 hover:border-teal-700 ${r.voidedAt ? "opacity-70" : ""}`}>
                  <span><span className="block font-semibold">{r.label}</span><span className="muted">{fmt.format(r.createdAt)}{r.voidedAt ? " · anulado" : ""}</span></span>
                  <span className={`text-lg font-bold ${r.voidedAt ? "line-through" : ""}`}>{copFmt.format(r.total)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section className="card flex flex-wrap items-center justify-between gap-3">
        <span><span className="block font-semibold">Para tu contador</span><span className="muted">Empleados, novedades y pagos del mes en Excel.</span></span>
        <a href={`/api/finanzas/exportar?tipo=nomina&mes=${today.slice(0, 7)}`} className="btn-secondary">Descargar este mes</a>
      </section>
    </div>
  );
}
