import Link from "next/link";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { METHODS, copFmt, type MethodKey } from "@/lib/cartera";
import { CloseForm, OpenForm, PaymentForm } from "./forms";
import { voidPayment } from "./actions";

export default async function CajaPage() {
  const { user, branch, branches } = await requireBranch();
  const manager = user.role !== "DENTIST";
  const session = await db.cashSession.findFirst({ where: { clinicId: user.clinicId, branchId: branch.id, closedAt: null }, include: { openedBy: { select: { name: true } } } });
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

  const [payments, patients, history] = await Promise.all([
    session ? db.payment.findMany({ where: { sessionId: session.id }, orderBy: { number: "desc" }, include: { patient: { select: { firstName: true, lastName: true } }, receivedBy: { select: { name: true } } } }) : Promise.resolve([]),
    session ? db.patient.findMany({ where: { clinicId: user.clinicId }, orderBy: { lastName: "asc" }, take: 500 }) : Promise.resolve([]),
    db.cashSession.findMany({ where: { clinicId: user.clinicId, branchId: branch.id, closedAt: { not: null } }, orderBy: { closedAt: "desc" }, take: 8, include: { openedBy: { select: { name: true } } } }),
  ]);

  const valid = payments.filter((p) => !p.voidedAt);
  const byMethod = (Object.keys(METHODS) as MethodKey[]).map((m) => ({ m, total: valid.filter((p) => p.method === m).reduce((s, p) => s + p.amount, 0) }));
  const total = valid.reduce((s, p) => s + p.amount, 0);
  const cash = byMethod.find((x) => x.m === "CASH")!.total;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Caja</h1>
        {branches.length > 1 && <p className="muted">Sede: {branch.name}. Cada sede tiene su propia caja.</p>}
      </div>

      {!session ? (
        manager ? <OpenForm /> : <p className="card">No hay caja abierta. Pide a recepción o administración que la abra.</p>
      ) : (
        <>
          <p className="muted">Abierta por {session.openedBy.name} el {fmt.format(session.openedAt)} · efectivo inicial {copFmt.format(session.openingAmount)}</p>
          <dl className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
            {byMethod.map(({ m, total: t }) => (
              <div key={m} className="card"><dt className="muted">{METHODS[m]}</dt><dd className="text-lg font-bold">{copFmt.format(t)}</dd></div>
            ))}
            <div className="card border-teal-700"><dt className="muted">Total recaudado</dt><dd className="text-lg font-bold text-teal-800">{copFmt.format(total)}</dd></div>
          </dl>
          <p className="text-sm font-semibold text-slate-900">Efectivo esperado en caja: {copFmt.format(session.openingAmount + cash)}</p>

          <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
            <PaymentForm patients={patients.map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName} · ${p.documentNumber}` }))} />
            <section className="space-y-2">
              <h2 className="section-title">Pagos de esta sesión</h2>
              <ul className="space-y-2">
                {payments.map((p) => (
                  <li key={p.id} className={`card ${p.voidedAt ? "opacity-70" : ""}`}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">
                          <span className={p.voidedAt ? "line-through" : ""}>{copFmt.format(p.amount)}</span> · {p.patient.firstName} {p.patient.lastName}
                        </p>
                        <p className="muted">Recibo {p.number} · {METHODS[p.method]}{p.reference ? ` · ${p.reference}` : ""} · {p.receivedBy.name}</p>
                        {p.voidedAt && <p className="error-text">Anulado: {p.voidReason}</p>}
                      </div>
                      <Link href={`/recibo/${p.id}`} target="_blank" className="btn-secondary min-h-10">Recibo</Link>
                    </div>
                    {user.role === "ADMIN" && !p.voidedAt && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm font-semibold text-red-700">Anular</summary>
                        <form action={voidPayment.bind(null, p.id)} className="mt-2 flex flex-wrap gap-2">
                          <input name="reason" required minLength={5} placeholder="Motivo de la anulación" aria-label="Motivo de la anulación" className="field mt-0 min-w-48 flex-1" />
                          <button className="btn-danger">Confirmar anulación</button>
                        </form>
                      </details>
                    )}
                  </li>
                ))}
                {payments.length === 0 && <li className="card text-center text-slate-700">Aún no hay pagos</li>}
              </ul>
            </section>
          </div>
          {manager && <CloseForm sessionId={session.id} />}
        </>
      )}

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Cierres anteriores</h2>
          <ul className="space-y-2">
            {history.map((s) => (
              <li key={s.id} className="card flex flex-wrap items-center justify-between gap-2 text-sm text-slate-900">
                <span>{fmt.format(s.openedAt)} → {s.closedAt ? fmt.format(s.closedAt) : ""} · {s.openedBy.name}</span>
                <span className={`font-semibold ${s.difference ? "text-red-700" : "text-teal-800"}`}>
                  Esperado {copFmt.format(s.expectedCash ?? 0)} · Contado {copFmt.format(s.countedCash ?? 0)} · Diferencia {copFmt.format(s.difference ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
