import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { categoryLabel, dateOnly, paidOf, todayStr } from "@/lib/finanzas";
import { PayeeForm } from "../forms";

export default async function AQuienLePagoPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/finanzas/gastos");
  const year = todayStr().slice(0, 4);
  const payees = await db.payee.findMany({
    where: { clinicId: user.clinicId },
    orderBy: { name: "asc" },
    include: { expenses: { where: { voidedAt: null }, select: { amount: true, expenseDate: true, settledAt: true, payments: { select: { amount: true, voidedAt: true } } } } },
  });
  const yearStart = dateOnly(`${year}-01-01`);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">A quién le pago</h1>
        <p className="muted">Se llena solo al registrar gastos. Completa el NIT o la cédula: tu contador lo necesita para sus reportes a la DIAN.</p>
      </div>
      <ul className="space-y-2">
        {payees.map((p) => {
          const owed = p.expenses.filter((e) => !e.settledAt).reduce((s, e) => s + e.amount - paidOf(e.payments), 0);
          const yearTotal = p.expenses.filter((e) => e.expenseDate >= yearStart).reduce((s, e) => s + e.amount, 0);
          return (
            <li key={p.id} className="card">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                  <span>
                    <span className="block font-semibold">{p.name}</span>
                    <span className="muted">{p.defaultCategory ? categoryLabel(p.defaultCategory) : "Sin categoría"} · {p.document ? p.document : "Falta NIT o cédula"} · gastos {year}: {copFmt.format(yearTotal)}</span>
                  </span>
                  {owed > 0 && <span className="rounded bg-amber-100 px-2 py-0.5 text-sm font-semibold text-amber-900">Debo {copFmt.format(owed)}</span>}
                </summary>
                <PayeeForm id={p.id} document={p.document} phone={p.phone} bank={p.bank} note={p.note} />
              </details>
            </li>
          );
        })}
        {payees.length === 0 && <li className="card text-center text-slate-700">Aún no hay nadie. Registra tu primer gasto en Gastos.</li>}
      </ul>
    </div>
  );
}
