import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { dayStart, fmtMonth, isPeriodStr, monthRange, prevMonth, todayStr } from "@/lib/finanzas";
import { financeSettings } from "@/lib/finanzas-data";

// Resultados del mes para decidir con números: por sede, por profesional y lo que vale el inventario.
// Es dinero que entró y salió (caja), no contabilidad: el estado de resultados oficial lo hace el contador.
export default async function ResultadosPage({ searchParams }: PageProps<"/finanzas/resultados">) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/finanzas/gastos");
  const today = todayStr();
  const q = (await searchParams).mes;
  const month = isPeriodStr(q) && q <= today.slice(0, 7) ? q : today.slice(0, 7);
  const { from, to } = monthRange(month);
  const range = { gte: dayStart(from), lt: dayStart(to) };
  const c = user.clinicId;

  const [branches, inflow, outflow, done, settlements, labs, lots, pros, settings] = await Promise.all([
    db.branch.findMany({ where: { clinicId: c }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
    db.payment.findMany({ where: { clinicId: c, voidedAt: null, receivedAt: range }, select: { amount: true, session: { select: { branchId: true } } } }),
    db.expensePayment.findMany({ where: { clinicId: c, voidedAt: null, paidAt: range }, select: { amount: true, expense: { select: { branchId: true, category: true } } } }),
    db.treatmentItem.findMany({ where: { status: "DONE", doneAt: range, doneById: { not: null }, plan: { patient: { clinicId: c } } }, select: { doneById: true, unitPrice: true, quantity: true } }),
    db.proSettlement.findMany({ where: { clinicId: c, voidedAt: null, createdAt: range }, select: { userId: true, total: true } }),
    db.labOrder.findMany({ where: { clinicId: c, voidedAt: null, createdAt: range }, select: { dentistId: true, cost: true } }),
    db.supplyLot.findMany({ where: { clinicId: c, quantity: { gt: 0 } }, select: { branchId: true, quantity: true, unitCost: true } }),
    db.user.findMany({ where: { clinicId: c }, select: { id: true, name: true } }),
    financeSettings(c),
  ]);

  const byBranch = branches.map((b) => {
    const entered = inflow.filter((p) => p.session.branchId === b.id).reduce((s, p) => s + p.amount, 0);
    const left = outflow.filter((p) => p.expense.branchId === b.id).reduce((s, p) => s + p.amount, 0);
    const stock = lots.filter((l) => l.branchId === b.id && l.unitCost != null).reduce((s, l) => s + l.quantity * (l.unitCost ?? 0), 0);
    return { ...b, entered, left, stock };
  });
  const totalIn = byBranch.reduce((s, b) => s + b.entered, 0);
  const totalOut = byBranch.reduce((s, b) => s + b.left, 0);
  const withoutCost = lots.filter((l) => l.unitCost == null).length;

  const names = new Map(pros.map((p) => [p.id, p.name]));
  const proIds = [...new Set([...done.map((d) => d.doneById as string), ...settlements.map((s) => s.userId), ...labs.map((l) => l.dentistId)])];
  const byPro = proIds
    .map((id) => {
      const production = done.filter((d) => d.doneById === id).reduce((s, d) => s + d.unitPrice * d.quantity, 0);
      const paid = settlements.filter((s) => s.userId === id).reduce((s, x) => s + x.total, 0);
      const lab = labs.filter((l) => l.dentistId === id).reduce((s, l) => s + l.cost, 0);
      return { id, name: names.get(id) ?? "—", production, paid, lab, margin: production - paid - lab };
    })
    .sort((a, b) => b.production - a.production);

  const months = [today.slice(0, 7)];
  for (let i = 0; i < 5; i++) months.push(prevMonth(months[months.length - 1]));

  return (
    <div className="space-y-6">
      <h1 className="page-title">Resultados · {fmtMonth(month)}</h1>
      <nav aria-label="Mes" className="flex flex-wrap gap-2">
        {months.map((m) => (
          <Link key={m} href={m === today.slice(0, 7) ? "/finanzas/resultados" : `/finanzas/resultados?mes=${m}`} aria-current={m === month ? "true" : undefined} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${m === month ? "border-slate-900 bg-slate-900 text-white" : "border-slate-400 bg-white text-slate-900"}`}>{fmtMonth(m)}</Link>
        ))}
      </nav>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card"><dt className="muted">Entró</dt><dd className="text-2xl font-bold text-teal-800">{copFmt.format(totalIn)}</dd></div>
        <div className="card"><dt className="muted">Salió</dt><dd className="text-2xl font-bold">{copFmt.format(totalOut)}</dd></div>
        <div className="card"><dt className="muted">Quedó</dt><dd className={`text-2xl font-bold ${totalIn - totalOut < 0 ? "text-red-700" : ""}`}>{copFmt.format(totalIn - totalOut)}</dd></div>
      </dl>

      {byBranch.length > 1 && (
        <section className="card space-y-2">
          <h2 className="section-title">Por sede</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-sm">
              <thead><tr className="border-b border-slate-400 text-left"><th className="py-1">Sede</th><th className="py-1 text-right">Entró</th><th className="py-1 text-right">Salió</th><th className="py-1 text-right">Quedó</th></tr></thead>
              <tbody>{byBranch.map((b) => <tr key={b.id} className="border-b border-slate-200"><td className="py-1 font-semibold">{b.name}</td><td className="py-1 text-right">{copFmt.format(b.entered)}</td><td className="py-1 text-right">{copFmt.format(b.left)}</td><td className={`py-1 text-right font-semibold ${b.entered - b.left < 0 ? "text-red-700" : ""}`}>{copFmt.format(b.entered - b.left)}</td></tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {byPro.length > 0 && (
        <section className="card space-y-2">
          <h2 className="section-title">Por profesional</h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-sm">
              <thead><tr className="border-b border-slate-400 text-left"><th className="py-1">Profesional</th><th className="py-1 text-right">Realizó</th><th className="py-1 text-right">Laboratorio</th><th className="py-1 text-right">Liquidado</th><th className="py-1 text-right">Le queda a la clínica</th></tr></thead>
              <tbody>{byPro.map((p) => <tr key={p.id} className="border-b border-slate-200"><td className="py-1 font-semibold">{p.name}</td><td className="py-1 text-right">{copFmt.format(p.production)}</td><td className="py-1 text-right">{copFmt.format(p.lab)}</td><td className="py-1 text-right">{copFmt.format(p.paid)}</td><td className="py-1 text-right font-semibold">{copFmt.format(p.margin)}</td></tr>)}</tbody>
            </table>
          </div>
          <p className="muted">«Realizó» es el valor de los procedimientos hechos en el mes, se hayan pagado o no. «Liquidado» es lo que se le liquidó en el mes, que puede corresponder a trabajos de meses anteriores.</p>
        </section>
      )}

      <section className="card space-y-2">
        <h2 className="section-title">Lo que vale el inventario hoy</h2>
        <p className="text-2xl font-bold">{copFmt.format(byBranch.reduce((s, b) => s + b.stock, 0))}</p>
        {byBranch.length > 1 && <p className="muted">{byBranch.map((b) => `${b.name}: ${copFmt.format(b.stock)}`).join(" · ")}</p>}
        {withoutCost > 0 && <p className="muted">{withoutCost} lotes no tienen costo de compra. Al registrar ingresos en Inventario, escribe el costo para que cuenten aquí.</p>}
      </section>

      <section className="card space-y-3">
        <h2 className="section-title">Enviar el mes al contador</h2>
        <p className="muted">Descarga los archivos del mes (abren en Excel) y envíalos a {settings.accountantName ?? "tu contador"}{settings.accountantEmail ? ` (${settings.accountantEmail})` : ""}. Este registro no reemplaza la contabilidad oficial.</p>
        <div className="flex flex-wrap gap-2">
          <a href={`/api/finanzas/exportar?tipo=ingresos&mes=${month}`} className="btn-secondary">Ingresos</a>
          <a href={`/api/gastos/exportar?mes=${month}`} className="btn-secondary">Gastos</a>
          <a href={`/api/gastos/exportar?mes=${month}&tipo=pagos`} className="btn-secondary">Pagos hechos</a>
          <a href={`/api/finanzas/exportar?tipo=liquidaciones&mes=${month}`} className="btn-secondary">Liquidaciones de profesionales</a>
          <a href={`/api/finanzas/exportar?tipo=nomina&mes=${month}`} className="btn-secondary">Empleados</a>
        </div>
        <Link href="/finanzas/ajustes" className="text-sm font-semibold text-teal-800 underline">Datos del contador, salario mínimo y retenciones sugeridas</Link>
      </section>
    </div>
  );
}
