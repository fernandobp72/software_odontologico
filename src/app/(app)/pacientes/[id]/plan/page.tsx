import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { PHASES } from "@/lib/catalogs";
import { resolveDiagnosis, setItemStatus, setPlanStatus } from "./actions";
import { DiagnosisForm, ItemForm, PlanForm } from "./forms";

const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const PLAN_STATUS: Record<string, string> = { DRAFT: "Borrador", PRESENTED: "Presentado", ACCEPTED: "Aceptado", IN_PROGRESS: "En curso", COMPLETED: "Completado", CANCELLED: "Cancelado" };
const ITEM_STATUS: Record<string, { label: string; cls: string }> = {
  PLANNED: { label: "Planeado", cls: "bg-slate-200 text-slate-900" },
  IN_PROGRESS: { label: "En curso", cls: "bg-blue-100 text-blue-900" },
  DONE: { label: "Realizado", cls: "bg-green-100 text-green-900" },
  CANCELLED: { label: "Cancelado", cls: "bg-red-100 text-red-900" },
};

export default async function PlanPage({ params }: PageProps<"/pacientes/[id]/plan">) {
  const user = await requireUser();
  const { id } = await params;
  if (user.role === "RECEPTION") return <p className="card">Sin acceso a la historia clínica.</p>;

  const [diagnoses, plans] = await Promise.all([
    db.diagnosis.findMany({ where: { patientId: id, patient: { clinicId: user.clinicId } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    db.treatmentPlan.findMany({ where: { patientId: id, patient: { clinicId: user.clinicId } }, orderBy: { createdAt: "desc" }, include: { items: { orderBy: [{ phase: "asc" }, { createdAt: "asc" }] } } }),
  ]);
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });
  const active = diagnoses.filter((d) => d.status === "ACTIVE");
  const resolved = diagnoses.filter((d) => d.status === "RESOLVED");

  return (
    <div className="space-y-6">
      <section className="card space-y-4">
        <h2 className="section-title">Diagnósticos</h2>
        <ul className="divide-y divide-slate-200">
          {active.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
              <p className="text-slate-900"><strong>{d.code}</strong> · {d.description}{d.tooth ? ` · diente ${d.tooth}` : ""}</p>
              <form action={resolveDiagnosis.bind(null, d.id)}><button className="btn-secondary min-h-10">Marcar resuelto</button></form>
            </li>
          ))}
          {active.length === 0 && <li className="py-2 text-slate-700">Sin diagnósticos activos</li>}
        </ul>
        {resolved.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">Resueltos ({resolved.length})</summary>
            <ul className="mt-2 space-y-1 text-sm text-slate-800">
              {resolved.map((d) => <li key={d.id}>{d.code} · {d.description}{d.tooth ? ` · diente ${d.tooth}` : ""} — {d.resolvedAt ? fmt.format(d.resolvedAt) : ""}</li>)}
            </ul>
          </details>
        )}
        <DiagnosisForm patientId={id} />
      </section>

      <section className="space-y-4">
        <h2 className="section-title">Planes de tratamiento</h2>
        <div className="card"><PlanForm patientId={id} /></div>

        {plans.map((plan) => {
          const items = plan.items.filter((i) => i.status !== "CANCELLED");
          const total = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          const done = items.filter((i) => i.status === "DONE").reduce((s, i) => s + i.unitPrice * i.quantity, 0);
          const closed = plan.status === "COMPLETED" || plan.status === "CANCELLED";
          const pct = items.length ? Math.round((items.filter((i) => i.status === "DONE").length / items.length) * 100) : 0;
          return (
            <article key={plan.id} className="card space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{plan.title}</h3>
                  <p className="muted">{PLAN_STATUS[plan.status]} · creado {fmt.format(plan.createdAt)}{plan.acceptedAt ? ` · aceptado ${fmt.format(plan.acceptedAt)}` : ""}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {plan.status === "DRAFT" && <form action={setPlanStatus.bind(null, plan.id, "PRESENTED")}><button className="btn-secondary">Presentar al paciente</button></form>}
                  {(plan.status === "DRAFT" || plan.status === "PRESENTED") && <form action={setPlanStatus.bind(null, plan.id, "ACCEPTED")}><button className="btn-primary">Paciente acepta</button></form>}
                  {!closed && <form action={setPlanStatus.bind(null, plan.id, "CANCELLED")}><button className="btn-danger">Cancelar plan</button></form>}
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm text-slate-800"><span>Avance {pct}%</span><span>Realizado {cop.format(done)} de {cop.format(total)}</span></div>
                <div className="mt-1 h-3 overflow-hidden rounded-full bg-slate-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-teal-700" style={{ width: `${pct}%` }} /></div>
              </div>

              {PHASES.map((ph) => {
                const list = plan.items.filter((i) => i.phase === ph.n);
                if (!list.length) return null;
                return (
                  <div key={ph.n}>
                    <h4 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-700">Fase {ph.n} · {ph.label}</h4>
                    <ul className="space-y-2">
                      {list.map((i) => (
                        <li key={i.id} className="rounded-lg border border-slate-300 p-3">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div>
                              <p className="font-semibold text-slate-900">{i.name}{i.tooth ? ` · diente ${i.tooth}` : ""}{i.surfaces ? ` (${i.surfaces})` : ""}{i.quantity > 1 ? ` ×${i.quantity}` : ""}</p>
                              <p className="muted">{i.procedureCode ? `CUPS ${i.procedureCode} · ` : ""}{cop.format(i.unitPrice * i.quantity)}{i.doneAt ? ` · realizado ${fmt.format(i.doneAt)}` : ""}</p>
                              {i.notes && <p className="muted">{i.notes}</p>}
                            </div>
                            <span className={`rounded-full px-3 py-1 text-xs font-semibold ${ITEM_STATUS[i.status].cls}`}>{ITEM_STATUS[i.status].label}</span>
                          </div>
                          {!closed && i.status !== "DONE" && i.status !== "CANCELLED" && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {i.status === "PLANNED" && <form action={setItemStatus.bind(null, i.id, "IN_PROGRESS")}><button className="btn-secondary min-h-10">Iniciar</button></form>}
                              <form action={setItemStatus.bind(null, i.id, "DONE")}><button className="btn-primary min-h-10">Marcar realizado</button></form>
                              <form action={setItemStatus.bind(null, i.id, "CANCELLED")}><button className="btn-danger min-h-10">Cancelar</button></form>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {plan.items.length === 0 && <p className="muted">Aún no hay procedimientos en este plan.</p>}
              {!closed && <ItemForm patientId={id} planId={plan.id} />}
            </article>
          );
        })}
      </section>
    </div>
  );
}
