import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { categoryLabel, dateOnly, dueInMonth, fmtDate, fmtMonth, isPeriodStr, monthRange, needsReview, paidOf, prevMonth, sourcesFor, todayStr } from "@/lib/finanzas";
import { ExpenseForm, type RecurringPrefill } from "../forms";

export default async function GastosPage({ searchParams }: PageProps<"/finanzas/gastos">) {
  const { user, branch, branches } = await requireBranch();
  if (user.role === "DENTIST") redirect("/finanzas/mis-pagos");
  const admin = user.role === "ADMIN";
  const sp = await searchParams;
  const today = todayStr();
  const month = isPeriodStr(sp.mes) ? sp.mes : today.slice(0, 7);
  const { from, to } = monthRange(month);

  let prefill: RecurringPrefill | undefined;
  if (admin && typeof sp.recurrente === "string") {
    const r = await db.recurringExpense.findFirst({ where: { id: sp.recurrente, clinicId: user.clinicId, active: true }, include: { payee: { select: { name: true } } } });
    if (r) prefill = { id: r.id, period: today.slice(0, 7), payee: r.payee.name, category: r.category, amount: r.amount, description: r.description, dueDate: dueInMonth(today.slice(0, 7), r.dayOfMonth) };
  }

  const [payees, openCash, expenses] = await Promise.all([
    db.payee.findMany({ where: { clinicId: user.clinicId, active: true }, orderBy: { name: "asc" }, select: { name: true, defaultCategory: true } }),
    db.cashSession.count({ where: { clinicId: user.clinicId, branchId: branch.id, closedAt: null } }),
    db.expense.findMany({
      // Recepción ve solo lo que registró ella misma.
      where: { clinicId: user.clinicId, expenseDate: { gte: dateOnly(from), lt: dateOnly(to) }, ...(admin ? {} : { createdById: user.id }) },
      orderBy: [{ expenseDate: "desc" }, { number: "desc" }],
      select: { id: true, number: true, amount: true, category: true, description: true, expenseDate: true, docKind: true, voidedAt: true, settledAt: true, mimeType: true, branchId: true, payee: { select: { name: true } }, payments: { select: { amount: true, voidedAt: true } } },
    }),
  ]);
  const branchName = new Map(branches.map((b) => [b.id, b.name]));
  const valid = expenses.filter((e) => !e.voidedAt);
  const total = valid.reduce((s, e) => s + e.amount, 0);
  const next = monthRange(month).to.slice(0, 7);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Gastos</h1>
        <p className="muted">{admin ? "Registra cualquier salida de plata en segundos: el valor, a quién y, si quieres, la foto de la factura." : "Registra lo que pagues con el efectivo de la caja o con la caja menor."}{branches.length > 1 ? ` Sede: ${branch.name}.` : ""}</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <ExpenseForm admin={admin} today={today} payees={payees.map((p) => ({ name: p.name, category: p.defaultCategory }))} sources={sourcesFor(user.role)} prefill={prefill} hasOpenCash={openCash > 0} />

        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="section-title first-letter:uppercase">{fmtMonth(month)}</h2>
            <span className="flex gap-2">
              <Link href={`/finanzas/gastos?mes=${prevMonth(month)}`} className="btn-secondary min-h-10" aria-label="Mes anterior">←</Link>
              {month < today.slice(0, 7) && <Link href={`/finanzas/gastos?mes=${next}`} className="btn-secondary min-h-10" aria-label="Mes siguiente">→</Link>}
            </span>
          </div>
          <p className="muted">{valid.length} gastos por {copFmt.format(total)}</p>
          <ul className="space-y-2">
            {expenses.map((e) => {
              const remaining = e.amount - paidOf(e.payments);
              const body = (
                <>
                  <span className="min-w-0">
                    <span className="block font-semibold">{e.payee.name}</span>
                    <span className="muted block">{fmtDate(e.expenseDate)} · {categoryLabel(e.category)}{e.description ? ` · ${e.description}` : ""}{branches.length > 1 ? ` · ${branchName.get(e.branchId) ?? ""}` : ""}</span>
                    <span className="mt-1 flex flex-wrap gap-1 text-xs font-semibold">
                      {e.voidedAt ? <span className="rounded bg-slate-200 px-2 py-0.5 text-slate-800">Anulado</span> : remaining > 0 ? <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">Debo {copFmt.format(remaining)}</span> : <span className="rounded bg-teal-100 px-2 py-0.5 text-teal-900">Pagado</span>}
                      {e.mimeType && <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-800">Con soporte</span>}
                      {!e.voidedAt && needsReview(e.docKind) && <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-800">Para revisar con el contador</span>}
                    </span>
                  </span>
                  <span className={`text-lg font-bold ${e.voidedAt ? "line-through opacity-60" : ""}`}>{copFmt.format(e.amount)}</span>
                </>
              );
              return (
                <li key={e.id}>
                  {admin ? <Link href={`/finanzas/gastos/${e.id}`} className="card flex items-start justify-between gap-3 hover:border-teal-700">{body}</Link> : <div className="card flex items-start justify-between gap-3">{body}</div>}
                </li>
              );
            })}
            {expenses.length === 0 && <li className="card text-center text-slate-700">No hay gastos registrados este mes</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
