import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { METHODS, account, copFmt } from "@/lib/cartera";
import { PaymentForm } from "../../../caja/forms";

export default async function CuentaPage({ params }: PageProps<"/pacientes/[id]/cuenta">) {
  const user = await requireUser();
  const { id } = await params;

  const [items, payments, session] = await Promise.all([
    db.treatmentItem.findMany({ where: { status: "DONE", plan: { patientId: id, patient: { clinicId: user.clinicId } } }, orderBy: { doneAt: "asc" } }),
    db.payment.findMany({ where: { patientId: id, clinicId: user.clinicId }, orderBy: { receivedAt: "desc" } }),
    db.cashSession.findFirst({ where: { clinicId: user.clinicId, closedAt: null }, select: { id: true } }),
  ]);
  const charges = items.filter((i) => i.doneAt).map((i) => ({ doneAt: i.doneAt as Date, amount: i.unitPrice * i.quantity }));
  const paid = payments.filter((p) => !p.voidedAt).reduce((s, p) => s + p.amount, 0);
  const acc = account(charges, paid);
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-3 gap-3">
        <div className="card"><dt className="muted">Realizado</dt><dd className="text-lg font-bold">{copFmt.format(acc.charged)}</dd></div>
        <div className="card"><dt className="muted">Pagado</dt><dd className="text-lg font-bold">{copFmt.format(acc.paid)}</dd></div>
        <div className={`card ${acc.balance > 0 ? "border-red-700" : "border-teal-700"}`}>
          <dt className="muted">{acc.balance < 0 ? "Saldo a favor" : "Saldo pendiente"}</dt>
          <dd className={`text-lg font-bold ${acc.balance > 0 ? "text-red-700" : "text-teal-800"}`}>{copFmt.format(Math.abs(acc.balance))}</dd>
        </div>
      </dl>
      {acc.balance > 0 && acc.days > 0 && <p className="muted">Deuda más antigua: {acc.days} días.</p>}

      {session ? <PaymentForm fixedPatientId={id} suggested={acc.balance} /> : (
        <p className="card">No hay caja abierta. <Link href="/caja" className="font-semibold underline">Ir a Caja</Link> para abrirla y poder registrar pagos.</p>
      )}

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <section className="space-y-2">
          <h2 className="section-title">Procedimientos realizados</h2>
          <ul className="card divide-y divide-slate-200 p-0">
            {items.map((i) => (
              <li key={i.id} className="flex justify-between gap-3 px-4 py-3 text-sm text-slate-900">
                <span>{i.doneAt ? fmt.format(i.doneAt) : ""} · {i.name}{i.tooth ? ` · diente ${i.tooth}` : ""}{i.quantity > 1 ? ` ×${i.quantity}` : ""}</span>
                <span className="font-semibold">{copFmt.format(i.unitPrice * i.quantity)}</span>
              </li>
            ))}
            {items.length === 0 && <li className="px-4 py-3 text-slate-700">Sin procedimientos realizados</li>}
          </ul>
        </section>
        <section className="space-y-2">
          <h2 className="section-title">Pagos</h2>
          <ul className="card divide-y divide-slate-200 p-0">
            {payments.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-900">
                <span className={p.voidedAt ? "line-through opacity-70" : ""}>{fmt.format(p.receivedAt)} · Recibo {p.number} · {METHODS[p.method]}</span>
                <span className="flex items-center gap-3">
                  <span className={`font-semibold ${p.voidedAt ? "line-through" : ""}`}>{copFmt.format(p.amount)}</span>
                  <Link href={`/recibo/${p.id}`} target="_blank" className="font-semibold underline">Recibo</Link>
                </span>
              </li>
            ))}
            {payments.length === 0 && <li className="px-4 py-3 text-slate-700">Sin pagos</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
