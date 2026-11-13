import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { agreementText } from "@/lib/pro-pay";
import { proAccount, professionals } from "@/lib/pro-pay-data";

// Lo que le debo a cada profesional: el saldo de cada uno, armado solo con lo que ya registra el software.
export default async function ProfesionalesPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/finanzas/mis-pagos");
  const pros = await professionals(user.clinicId);
  const rows = await Promise.all(pros.map(async (p) => ({ ...p, acc: p.proAgreement?.active ? await proAccount(user.clinicId, p.id, p.proAgreement) : null })));
  const total = rows.reduce((s, r) => s + Math.max(0, r.acc?.due ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Pagos a profesionales</h1>
        <p className="muted">Se calcula sobre lo que el paciente ya pagó. Lo que aún debe el paciente aparece como pendiente y se liquida cuando entre.</p>
      </div>
      <dl className="card"><dt className="muted">Le debo hoy a los profesionales</dt><dd className="text-2xl font-bold">{copFmt.format(total)}</dd></dl>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/finanzas/profesionales/${r.id}`} className="card flex flex-wrap items-center justify-between gap-3 hover:border-teal-700">
              <span>
                <span className="block font-semibold">{r.name}</span>
                <span className="muted">{r.proAgreement?.active ? agreementText("este profesional", r.proAgreement) : "Sin acuerdo de pago. Toca para definirlo."}</span>
                {r.acc && r.acc.pending > 0 && <span className="block text-sm text-amber-800">Pendiente de recaudo: {copFmt.format(r.acc.pending)}</span>}
              </span>
              <span className="flex items-center gap-3">
                {r.acc && <span className="text-lg font-bold">{copFmt.format(r.acc.due)}</span>}
                <span className="btn-secondary min-h-10">{r.acc ? "Ver cuenta" : "Definir"}</span>
              </span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="card text-center text-slate-700">No hay profesionales en el equipo. Invítalos desde Equipo.</li>}
      </ul>
    </div>
  );
}
