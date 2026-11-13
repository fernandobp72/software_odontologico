import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { categoryLabel, dueState, dueText, todayStr, type DueState } from "@/lib/finanzas";
import { openDebts } from "@/lib/finanzas-data";

const GROUPS: { key: DueState[]; title: string; tone: string }[] = [
  { key: ["vencido"], title: "Vencido", tone: "text-red-700" },
  { key: ["hoy", "semana"], title: "Vence en los próximos 7 días", tone: "text-amber-800" },
  { key: ["despues"], title: "Más adelante", tone: "text-slate-900" },
  { key: ["sin-fecha"], title: "Sin fecha límite", tone: "text-slate-900" },
];

export default async function PorPagarPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/finanzas/gastos");
  const today = todayStr();
  const debts = await openDebts(user.clinicId);
  const total = debts.reduce((s, d) => s + d.remaining, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Por pagar</h1>
          <p className="muted">Debes {copFmt.format(total)} en {debts.length} {debts.length === 1 ? "cuenta" : "cuentas"}.</p>
        </div>
        <Link href="/finanzas/gastos" className="btn-primary">+ Deuda nueva</Link>
      </div>
      {GROUPS.map((g) => {
        const rows = debts.filter((d) => g.key.includes(dueState(d.dueDate, today)));
        if (!rows.length) return null;
        return (
          <section key={g.title} className="space-y-2">
            <h2 className={`section-title ${g.tone}`}>{g.title} · {copFmt.format(rows.reduce((s, d) => s + d.remaining, 0))}</h2>
            <ul className="space-y-2">
              {rows.map((d) => (
                <li key={d.id}>
                  <Link href={`/finanzas/gastos/${d.id}`} className="card flex flex-wrap items-center justify-between gap-2 hover:border-teal-700">
                    <span>
                      <span className="block font-semibold">{d.payee.name}</span>
                      <span className="muted">{dueText(d.dueDate, today)} · {categoryLabel(d.category)}{d.description ? ` · ${d.description}` : ""}{d.remaining < d.amount ? ` · abonado ${copFmt.format(d.amount - d.remaining)}` : ""}</span>
                    </span>
                    <span className="flex items-center gap-3"><span className="text-lg font-bold">{copFmt.format(d.remaining)}</span><span className="btn-secondary min-h-10">Pagar</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      {debts.length === 0 && <p className="card text-center text-slate-700">No le debes a nadie. Cuando registres un gasto como «Lo debo», aparece aquí con su fecha límite.</p>}
    </div>
  );
}
