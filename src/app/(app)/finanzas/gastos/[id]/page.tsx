import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { categoryLabel, docLabel, dueText, fmtDate, needsReview, paidOf, sourceLabel, sourcesFor, todayStr } from "@/lib/finanzas";
import { PayForm, VoidExpense, VoidExpensePayment } from "../../forms";

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

export default async function GastoPage({ params }: PageProps<"/finanzas/gastos/[id]">) {
  const { user, branch } = await requireBranch();
  if (user.role !== "ADMIN") redirect("/finanzas/gastos");
  const { id } = await params;
  const e = await db.expense.findFirst({
    where: { id, clinicId: user.clinicId },
    select: {
      id: true, number: true, amount: true, category: true, description: true, docKind: true, docNumber: true, expenseDate: true, dueDate: true, mimeType: true, fileName: true,
      createdAt: true, voidedAt: true, voidReason: true, recurringId: true, createdBy: { select: { name: true } },
      payee: { select: { name: true, document: true, bank: true } },
      payments: { orderBy: { paidAt: "asc" }, select: { id: true, amount: true, source: true, reference: true, paidAt: true, voidedAt: true, voidReason: true } },
    },
  });
  if (!e) notFound();
  const openCash = await db.cashSession.count({ where: { clinicId: user.clinicId, branchId: branch.id, closedAt: null } });
  const paid = paidOf(e.payments);
  const remaining = e.amount - paid;
  const today = todayStr();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/finanzas/gastos" className="text-sm font-semibold text-teal-800 underline">← Gastos</Link>
        <h1 className="page-title mt-2">{e.payee.name}</h1>
        <p className="muted">Gasto {e.number} · {categoryLabel(e.category)} · registrado por {e.createdBy.name} el {fmt.format(e.createdAt)}{e.recurringId ? " · se repite cada mes" : ""}</p>
      </div>

      {e.voidedAt && <p role="status" className="card border-red-700 font-semibold text-red-800">Anulado: {e.voidReason}</p>}

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="card"><dt className="muted">Valor</dt><dd className="text-2xl font-bold">{copFmt.format(e.amount)}</dd></div>
        <div className="card"><dt className="muted">Pagado</dt><dd className="text-2xl font-bold text-teal-800">{copFmt.format(paid)}</dd></div>
        <div className="card"><dt className="muted">Saldo</dt><dd className={`text-2xl font-bold ${remaining > 0 && !e.voidedAt ? "text-amber-800" : ""}`}>{copFmt.format(e.voidedAt ? 0 : remaining)}</dd>{remaining > 0 && !e.voidedAt && <dd className="muted">{dueText(e.dueDate, today)}</dd>}</div>
      </dl>

      <section className="card space-y-2 text-sm">
        <p><span className="font-semibold">Fecha del gasto:</span> {fmtDate(e.expenseDate)}</p>
        {e.description && <p><span className="font-semibold">Detalle:</span> {e.description}</p>}
        <p><span className="font-semibold">Soporte:</span> {docLabel(e.docKind)}{e.docNumber ? ` n.º ${e.docNumber}` : ""}</p>
        {e.payee.document && <p><span className="font-semibold">NIT o cédula:</span> {e.payee.document}</p>}
        {e.payee.bank && <p><span className="font-semibold">Dónde se le consigna:</span> {e.payee.bank}</p>}
        {needsReview(e.docKind) && !e.voidedAt && <p className="muted">Para revisar con tu contador: un gasto se respalda con factura electrónica a nombre del consultorio, o con documento soporte cuando el proveedor no factura.</p>}
        {e.mimeType && (
          <p><a href={`/api/gastos/${e.id}/soporte`} target="_blank" rel="noopener" className="btn-secondary mt-1">Ver soporte ({e.mimeType === "application/pdf" ? "PDF" : "foto"})</a></p>
        )}
      </section>

      {!e.voidedAt && remaining > 0 && <PayForm expenseId={e.id} remaining={remaining} sources={sourcesFor(user.role)} hasOpenCash={openCash > 0} />}

      <section className="space-y-2">
        <h2 className="section-title">Pagos</h2>
        <ul className="space-y-2">
          {e.payments.map((p) => (
            <li key={p.id} className={`card ${p.voidedAt ? "opacity-70" : ""}`}>
              <p className="font-semibold"><span className={p.voidedAt ? "line-through" : ""}>{copFmt.format(p.amount)}</span> · {sourceLabel(p.source)}</p>
              <p className="muted">{fmt.format(p.paidAt)}{p.reference ? ` · ${p.reference}` : ""}</p>
              {p.voidedAt ? <p className="error-text">Anulado: {p.voidReason}</p> : !e.voidedAt && <VoidExpensePayment id={p.id} />}
            </li>
          ))}
          {e.payments.length === 0 && <li className="card text-center text-slate-700">Todavía no se ha pagado nada</li>}
        </ul>
      </section>

      {!e.voidedAt && <section className="card"><p className="muted">¿Quedó mal registrado? Anúlalo con el motivo y regístralo de nuevo. Nada se borra.</p><VoidExpense id={e.id} /></section>}
    </div>
  );
}
