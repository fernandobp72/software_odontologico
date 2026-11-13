import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { todayStr } from "@/lib/finanzas";
import { proAccount } from "@/lib/pro-pay-data";
import { AgreementForm, SettleForm } from "../forms";
import ProLines from "../lines";

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });

export default async function ProfesionalPage({ params }: PageProps<"/finanzas/profesionales/[userId]">) {
  const { user, branch } = await requireBranch();
  if (user.role !== "ADMIN") redirect("/finanzas/mis-pagos");
  const { userId } = await params;
  const pro = await db.user.findFirst({ where: { id: userId, clinicId: user.clinicId }, select: { id: true, name: true, proAgreement: true } });
  if (!pro) notFound();
  const a = pro.proAgreement?.active ? pro.proAgreement : null;
  const [acc, history, openCash] = await Promise.all([
    a ? proAccount(user.clinicId, pro.id, a) : null,
    db.proSettlement.findMany({ where: { clinicId: user.clinicId, userId: pro.id }, orderBy: { createdAt: "desc" }, take: 24, select: { id: true, number: true, total: true, retention: true, createdAt: true, voidedAt: true } }),
    db.cashSession.count({ where: { clinicId: user.clinicId, branchId: branch.id, closedAt: null } }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/finanzas/profesionales" className="text-sm font-semibold text-teal-800 underline">← Pagos a profesionales</Link>
        <h1 className="page-title mt-2">{pro.name}</h1>
      </div>

      <section className="card space-y-2">
        <h2 className="section-title">Acuerdo de pago</h2>
        <AgreementForm userId={pro.id} name={pro.name} percent={a?.percent} deductLab={a?.deductLab} note={a?.note} />
        {a && <p className="muted">Si cambias el porcentaje, aplica a todo lo que aún no se ha liquidado. Lo ya pagado no cambia.</p>}
      </section>

      {acc && (
        <>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="card"><dt className="muted">Se le debe hoy</dt><dd className="text-2xl font-bold text-teal-800">{copFmt.format(acc.due)}</dd></div>
            <div className="card"><dt className="muted">Pendiente de que paguen los pacientes</dt><dd className="text-2xl font-bold text-amber-800">{copFmt.format(acc.pending)}</dd></div>
          </dl>
          <section className="space-y-2">
            <h2 className="section-title">Detalle</h2>
            <ProLines lines={acc.lines} />
          </section>
          <SettleForm userId={pro.id} due={acc.due} today={todayStr()} hasOpenCash={openCash > 0} />
        </>
      )}

      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Liquidaciones anteriores</h2>
          <ul className="space-y-2">
            {history.map((s) => (
              <li key={s.id}>
                <Link href={`/finanzas/profesionales/liquidacion/${s.id}`} className={`card flex flex-wrap items-center justify-between gap-2 hover:border-teal-700 ${s.voidedAt ? "opacity-70" : ""}`}>
                  <span><span className="block font-semibold">Liquidación {s.number}</span><span className="muted">{fmt.format(s.createdAt)}{s.voidedAt ? " · anulada" : ""}</span></span>
                  <span className={`text-lg font-bold ${s.voidedAt ? "line-through" : ""}`}>{copFmt.format(s.total - s.retention)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
