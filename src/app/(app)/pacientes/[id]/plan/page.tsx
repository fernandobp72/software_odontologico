import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { CIE10, PHASES, PROCEDURES } from "@/lib/catalogs";
import { pendingSuggestions } from "@/lib/suggest-apply";
import { getCatalog } from "@/lib/catalog";
import { deleteDiagnosis, deleteItem, deletePlan, resolveDiagnosis, setItemStatus, setPlanStatus } from "./actions";
import { AutoGenerate, DiagnosisEditForm, DiagnosisForm, ItemEditForm, ItemForm, PlanForm, SuggestionCard } from "./forms";

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

  const [diagnoses, plans, patient, pending, catalog] = await Promise.all([
    db.diagnosis.findMany({ where: { patientId: id, patient: { clinicId: user.clinicId } }, orderBy: [{ status: "asc" }, { createdAt: "desc" }] }),
    db.treatmentPlan.findMany({ where: { patientId: id, patient: { clinicId: user.clinicId } }, orderBy: { createdAt: "desc" }, include: { items: { orderBy: [{ phase: "asc" }, { createdAt: "asc" }] } } }),
    db.patient.findFirst({ where: { id, clinicId: user.clinicId }, select: { autoPlanAt: true } }),
    pendingSuggestions(id),
    getCatalog(user.clinicId, { onlyActive: true }),
  ]);
  const pendingCount = pending.diagnoses.length + pending.items.length;
  const autoNeeded = !patient?.autoPlanAt && pendingCount > 0;
  const dxLabel = (d: { code: string; tooth: number | null }) => `${d.code} ${CIE10.find((c) => c.code === d.code)?.label ?? ""}${d.tooth ? ` (diente ${d.tooth})` : ""}`;
  const itemLabel = (i: { procId: string; tooth: number | null; surfaces: string }) => `${PROCEDURES.find((p) => p.id === i.procId)?.name ?? i.procId}${i.tooth ? ` (diente ${i.tooth}${i.surfaces ? `, ${i.surfaces}` : ""})` : ""}`;
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });
  const active = diagnoses.filter((d) => d.status === "ACTIVE");
  const resolved = diagnoses.filter((d) => d.status === "RESOLVED");

  return (
    <div className="space-y-6">
      {autoNeeded ? (
        <AutoGenerate patientId={id} />
      ) : (
        pendingCount > 0 && <SuggestionCard patientId={id} diagnoses={pending.diagnoses.map(dxLabel)} items={pending.items.map(itemLabel)} />
      )}
      <section className="card space-y-4">
        <h2 className="section-title">Diagnósticos</h2>
        <ul className="divide-y divide-slate-200">
          {active.map((d) => (
            <li key={d.id} className="space-y-2 py-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-slate-900">
                    <strong>{d.code}</strong> · {d.description}{d.tooth ? ` · diente ${d.tooth}` : ""}
                    {d.sourceKey && <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-900">Sugerido</span>}
                  </p>
                  {d.note && <p className="muted">{d.note}</p>}
                </div>
                <form action={resolveDiagnosis.bind(null, d.id)}><button className="btn-secondary min-h-10">Marcar resuelto</button></form>
              </div>
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-teal-800">Modificar o eliminar</summary>
                <div className="mt-3 space-y-3">
                  <DiagnosisEditForm d={{ id: d.id, code: d.code, tooth: d.tooth, note: d.note }} />
                  <form action={deleteDiagnosis.bind(null, d.id)}><button className="btn-danger min-h-10">Eliminar diagnóstico</button></form>
                </div>
              </details>
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
                  {["DRAFT", "PRESENTED"].includes(plan.status) && !plan.items.some((x) => x.status === "DONE") && (
                    <form action={deletePlan.bind(null, plan.id)}><button className="btn-secondary">Eliminar plan</button></form>
                  )}
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
                              <p className="font-semibold text-slate-900">{i.name}{i.material ? ` · ${i.material}` : ""}{i.tooth ? ` · diente ${i.tooth}` : ""}{i.surfaces ? ` (${i.surfaces})` : ""}{i.quantity > 1 ? ` ×${i.quantity}` : ""}{i.sourceKey && <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-900">Sugerido</span>}</p>
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
                          {!closed && (i.status === "PLANNED" || i.status === "IN_PROGRESS") && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-sm font-semibold text-teal-800">Modificar o eliminar</summary>
                              <div className="mt-3 space-y-3">
                                <ItemEditForm catalog={catalog} item={{ id: i.id, name: i.name, phase: i.phase, tooth: i.tooth, surfaces: i.surfaces, quantity: i.quantity, unitPrice: i.unitPrice, notes: i.notes, material: i.material, pending: i.name === "Restauración definitiva (por definir)" }} />
                                <form action={deleteItem.bind(null, i.id)}><button className="btn-danger min-h-10">Eliminar procedimiento</button></form>
                              </div>
                            </details>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
              {plan.items.length === 0 && <p className="muted">Aún no hay procedimientos en este plan.</p>}
              {!closed && <ItemForm patientId={id} planId={plan.id} catalog={catalog} />}
            </article>
          );
        })}
      </section>
    </div>
  );
}
