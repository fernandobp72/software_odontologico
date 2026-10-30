import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { AGING, account, bucket, copFmt } from "@/lib/cartera";

// Inicio del mes en horario de Colombia (UTC-5).
function bogotaMonthStart() {
  const now = new Date(Date.now() - 5 * 3_600_000);
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 5));
}

export default async function CarteraPage() {
  const user = await requireUser();
  const [items, paidBy, month] = await Promise.all([
    db.treatmentItem.findMany({ where: { status: "DONE", doneAt: { not: null }, plan: { patient: { clinicId: user.clinicId } } }, include: { plan: { select: { patientId: true } } } }),
    db.payment.groupBy({ by: ["patientId"], where: { clinicId: user.clinicId, voidedAt: null }, _sum: { amount: true } }),
    db.payment.aggregate({ _sum: { amount: true }, where: { clinicId: user.clinicId, voidedAt: null, receivedAt: { gte: bogotaMonthStart() } } }),
  ]);

  const paid = new Map(paidBy.map((p) => [p.patientId, p._sum.amount ?? 0]));
  const charges = new Map<string, { doneAt: Date; amount: number }[]>();
  for (const i of items) {
    const list = charges.get(i.plan.patientId) ?? [];
    list.push({ doneAt: i.doneAt as Date, amount: i.unitPrice * i.quantity });
    charges.set(i.plan.patientId, list);
  }

  const rows = [...charges.entries()]
    .map(([patientId, list]) => ({ patientId, ...account(list, paid.get(patientId) ?? 0) }))
    .filter((r) => r.balance > 0)
    .sort((a, b) => b.days - a.days || b.balance - a.balance);

  const patients = await db.patient.findMany({ where: { id: { in: rows.map((r) => r.patientId) } }, select: { id: true, firstName: true, lastName: true, phone: true } });
  const byId = new Map(patients.map((p) => [p.id, p]));
  const total = rows.reduce((s, r) => s + r.balance, 0);
  const overdue = rows.filter((r) => r.days > 30).reduce((s, r) => s + r.balance, 0);
  const buckets = AGING.map((a) => ({ ...a, total: rows.filter((r) => bucket(r.days) === a.key).reduce((s, r) => s + r.balance, 0) }));

  return (
    <div className="space-y-6">
      <h1 className="page-title">Cartera</h1>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card"><dt className="muted">Cartera total</dt><dd className="text-xl font-bold">{copFmt.format(total)}</dd></div>
        <div className="card"><dt className="muted">Vencida (más de 30 días)</dt><dd className="text-xl font-bold text-red-700">{copFmt.format(overdue)}</dd></div>
        <div className="card"><dt className="muted">Pacientes con saldo</dt><dd className="text-xl font-bold">{rows.length}</dd></div>
        <div className="card"><dt className="muted">Recaudo del mes</dt><dd className="text-xl font-bold text-teal-800">{copFmt.format(month._sum.amount ?? 0)}</dd></div>
      </dl>

      <section className="card space-y-3">
        <h2 className="section-title">Antigüedad</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {buckets.map((b) => (
            <div key={b.key} className="rounded-lg border border-slate-300 p-3">
              <p className="muted">{b.label}</p>
              <p className="text-lg font-bold">{copFmt.format(b.total)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="section-title">Pacientes con saldo</h2>
        <ul className="space-y-2">
          {rows.map((r) => {
            const p = byId.get(r.patientId);
            return (
              <li key={r.patientId}>
                <Link href={`/pacientes/${r.patientId}/cuenta`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-teal-700">
                  <span>
                    <span className="block font-semibold text-slate-900">{p?.firstName} {p?.lastName}</span>
                    <span className="muted">{p?.phone ?? "Sin teléfono"} · {r.days} días</span>
                  </span>
                  <span className={`text-lg font-bold ${r.days > 30 ? "text-red-700" : "text-slate-900"}`}>{copFmt.format(r.balance)}</span>
                </Link>
              </li>
            );
          })}
          {rows.length === 0 && <li className="card text-center text-slate-700">No hay saldos pendientes</li>}
        </ul>
      </section>
    </div>
  );
}
