import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { fmtDate, paidOf, todayStr } from "@/lib/finanzas";
import { LabInvoiceForm } from "../../laboratorio/forms";

// Cuenta de cada laboratorio: los trabajos recibidos se acumulan; al llegar la factura se marcan los que cubre.
export default async function LaboratoriosFinanzasPage() {
  const { user, branch } = await requireBranch();
  if (user.role !== "ADMIN") redirect("/laboratorio");
  const [orders, invoices, openCash] = await Promise.all([
    db.labOrder.findMany({
      where: { clinicId: user.clinicId, voidedAt: null, expenseId: null, cost: { gt: 0 } },
      orderBy: { number: "asc" },
      select: { id: true, number: true, workType: true, tooth: true, cost: true, status: true, receivedAt: true, payeeId: true, payee: { select: { name: true } } },
    }),
    db.expense.findMany({ where: { clinicId: user.clinicId, voidedAt: null, category: "LABORATORIO", settledAt: null }, select: { id: true, amount: true, dueDate: true, payeeId: true, payments: { select: { amount: true, voidedAt: true } } } }),
    db.cashSession.count({ where: { clinicId: user.clinicId, branchId: branch.id, closedAt: null } }),
  ]);
  const labs = new Map<string, { name: string; received: typeof orders; outside: typeof orders; owed: number }>();
  for (const o of orders) {
    const cur = labs.get(o.payeeId) ?? { name: o.payee.name, received: [], outside: [], owed: 0 };
    (o.status === "RECEIVED" || o.status === "PLACED" ? cur.received : cur.outside).push(o);
    labs.set(o.payeeId, cur);
  }
  for (const e of invoices) {
    const cur = labs.get(e.payeeId);
    if (cur) cur.owed += e.amount - paidOf(e.payments);
  }
  const today = todayStr();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Cuentas de laboratorios</h1>
        <p className="muted">Paga solo lo que ya recibiste: al llegar la factura, marca los trabajos que cubre y el software te muestra las diferencias.</p>
      </div>
      {[...labs.entries()].map(([payeeId, l]) => {
        const receivedTotal = l.received.reduce((s, o) => s + o.cost, 0);
        return (
          <section key={payeeId} className="card space-y-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="section-title">{l.name}</h2>
              <span className="font-semibold">Recibido sin facturar: {copFmt.format(receivedTotal)}</span>
            </div>
            {l.owed > 0 && <p className="text-sm">Facturas por pagar: <Link href="/finanzas/por-pagar" className="font-semibold underline">{copFmt.format(l.owed)}</Link></p>}
            {l.outside.length > 0 && <p className="muted">{l.outside.length} {l.outside.length === 1 ? "trabajo" : "trabajos"} todavía en el laboratorio por {copFmt.format(l.outside.reduce((s, o) => s + o.cost, 0))}.</p>}
            {l.received.length > 0 ? (
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-teal-800">Registrar factura</summary>
                <div className="mt-3">
                  <LabInvoiceForm payeeId={payeeId} today={today} hasOpenCash={openCash > 0} orders={l.received.map((o) => ({ id: o.id, number: o.number, cost: o.cost, label: `${o.workType}${o.tooth ? ` diente ${o.tooth}` : ""}${o.receivedAt ? ` · recibido ${fmtDate(o.receivedAt)}` : ""}` }))} />
                </div>
              </details>
            ) : <p className="muted">No hay trabajos recibidos por facturar.</p>}
          </section>
        );
      })}
      {labs.size === 0 && <p className="card text-center text-slate-700">No hay trabajos de laboratorio por facturar.</p>}
    </div>
  );
}
