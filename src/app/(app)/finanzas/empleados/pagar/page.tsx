import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { dateOnly, todayStr } from "@/lib/finanzas";
import { financeSettings } from "@/lib/finanzas-data";
import { currentPeriodKey, noveltyLabel, periodInfo, suggestPay } from "@/lib/empleados";
import { copFmt } from "@/lib/cartera";
import { PayRunForm, type RunRow } from "../forms";

// «Pagar quincena»: lista por persona con el valor base, las novedades que suman o restan y el total sugerido, editable.
export default async function PagarPage({ searchParams }: PageProps<"/finanzas/empleados/pagar">) {
  const { user, branch } = await requireBranch();
  if (user.role !== "ADMIN") redirect("/finanzas/gastos");
  const today = todayStr();
  const q = (await searchParams).periodo;
  const period = periodInfo(typeof q === "string" ? q : "") ?? periodInfo(currentPeriodKey(today))!;
  const month = period.month;
  const options = [`${month}-Q1`, `${month}-Q2`, `${month}-M`];
  const [employees, settings, paid, openCash] = await Promise.all([
    db.employee.findMany({ where: { clinicId: user.clinicId, active: true, startDate: { lte: dateOnly(period.to) } }, orderBy: { name: "asc" }, include: { novelties: { where: { voidedAt: null, payLineId: null, date: { lte: dateOnly(period.to) } } } } }),
    financeSettings(user.clinicId),
    db.payRunLine.findMany({ where: { payRun: { clinicId: user.clinicId, periodKey: period.key, voidedAt: null } }, select: { employeeId: true } }),
    db.cashSession.count({ where: { clinicId: user.clinicId, branchId: branch.id, closedAt: null } }),
  ]);
  const paidSet = new Set(paid.map((p) => p.employeeId));
  // En quincenas solo aparecen quienes cobran por quincena; en el mes, quienes cobran mensual.
  const list = employees.filter((e) => (period.kind === "M" ? e.payEvery === "MENSUAL" : e.payEvery === "QUINCENAL"));
  const rows: RunRow[] = list.map((e) => {
    const s = suggestPay(e, e.novelties, period.kind, settings);
    return { id: e.id, name: e.name, position: e.position, ...s, novelties: e.novelties.map((n) => `${noveltyLabel(n.kind)}${n.amount ? ` ${n.amount > 0 ? "+" : "−"}${copFmt.format(Math.abs(n.amount))}` : ""}`), paid: paidSet.has(e.id) };
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/finanzas/empleados" className="text-sm font-semibold text-teal-800 underline">← Empleados</Link>
        <h1 className="page-title mt-2">Pagar · {period.label}</h1>
      </div>
      <nav aria-label="Periodo" className="flex flex-wrap gap-2">
        {options.map((k) => (
          <Link key={k} href={`/finanzas/empleados/pagar?periodo=${k}`} aria-current={k === period.key ? "true" : undefined} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${k === period.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-400 bg-white text-slate-900"}`}>{periodInfo(k)!.label.split(" de ")[0]}</Link>
        ))}
      </nav>
      {rows.length > 0 ? <PayRunForm periodKey={period.key} label={period.label} rows={rows} hasOpenCash={openCash > 0} /> : <p className="card text-center text-slate-700">No hay empleados que cobren en este periodo.</p>}
    </div>
  );
}
