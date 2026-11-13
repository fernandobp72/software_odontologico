import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { agreementText } from "@/lib/pro-pay";
import { proAccount } from "@/lib/pro-pay-data";
import ProLines from "../profesionales/lines";

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });

// «Mis pagos»: cada profesional ve lo suyo (lo realizado, lo recaudado y lo pendiente). Esa transparencia evita disputas.
export default async function MisPagosPage() {
  const user = await requireUser();
  const a = await db.proAgreement.findUnique({ where: { userId: user.id } });
  if (!a?.active) {
    return (
      <div className="space-y-4">
        <h1 className="page-title">Mis pagos</h1>
        <p className="card">Todavía no hay un acuerdo de pago por porcentaje a tu nombre. Cuando administración lo defina, aquí verás lo que has realizado, lo que han pagado tus pacientes y lo que se te debe.</p>
      </div>
    );
  }
  const [acc, history] = await Promise.all([
    proAccount(user.clinicId, user.id, a),
    db.proSettlement.findMany({ where: { clinicId: user.clinicId, userId: user.id }, orderBy: { createdAt: "desc" }, take: 24, select: { id: true, number: true, total: true, retention: true, createdAt: true, voidedAt: true } }),
  ]);
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Mis pagos</h1>
        <p className="muted">{agreementText("ti", a).replace("A ti le pago", "Te pagan")}</p>
      </div>
      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="card"><dt className="muted">Se te debe hoy</dt><dd className="text-2xl font-bold text-teal-800">{copFmt.format(acc.due)}</dd></div>
        <div className="card"><dt className="muted">Por cobrar cuando paguen tus pacientes</dt><dd className="text-2xl font-bold text-amber-800">{copFmt.format(acc.pending)}</dd></div>
      </dl>
      <section className="space-y-2">
        <h2 className="section-title">Detalle</h2>
        <ProLines lines={acc.lines} />
      </section>
      {history.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Mis liquidaciones</h2>
          <ul className="space-y-2">
            {history.map((s) => (
              <li key={s.id}>
                <Link href={`/finanzas/profesionales/liquidacion/${s.id}`} className={`card flex flex-wrap items-center justify-between gap-2 hover:border-teal-700 ${s.voidedAt ? "opacity-70" : ""}`}>
                  <span><span className="block font-semibold">Liquidación {s.number}</span><span className="muted">{fmt.format(s.createdAt)}{s.voidedAt ? " · anulada" : ""}</span></span>
                  <span className="text-lg font-bold">{copFmt.format(s.total - s.retention)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
