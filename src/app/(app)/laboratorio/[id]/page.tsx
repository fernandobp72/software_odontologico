import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { fmtDate } from "@/lib/finanzas";
import { REDO_PAYER, labStatus } from "@/lib/labs";
import { LabCostForm, LabStatusButton, VoidLabOrder } from "../forms";

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

export default async function OrdenPage({ params }: PageProps<"/laboratorio/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const o = await db.labOrder.findFirst({
    where: { id, clinicId: user.clinicId, ...(user.role === "DENTIST" ? { dentistId: user.id } : {}) },
    include: { payee: { select: { name: true, phone: true } }, dentist: { select: { name: true } }, events: { orderBy: { at: "asc" } } },
  });
  if (!o) notFound();
  const [patient, redos, original, people] = await Promise.all([
    db.patient.findFirst({ where: { id: o.patientId, clinicId: user.clinicId }, select: { id: true, firstName: true, lastName: true } }),
    db.labOrder.findMany({ where: { redoOfId: o.id }, select: { id: true, number: true, redoReason: true } }),
    o.redoOfId ? db.labOrder.findUnique({ where: { id: o.redoOfId }, select: { id: true, number: true } }) : null,
    db.user.findMany({ where: { clinicId: user.clinicId }, select: { id: true, name: true } }),
  ]);
  const who = new Map(people.map((p) => [p.id, p.name]));
  const st = labStatus(o.status);
  const clinician = user.role !== "RECEPTION";
  const active = !o.voidedAt;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/laboratorio" className="text-sm font-semibold text-teal-800 underline">← Laboratorio</Link>
        <h1 className="page-title mt-2">{o.workType}{o.tooth ? ` · diente ${o.tooth}` : ""}</h1>
        <p className="muted">Orden {o.number} · {patient ? `${patient.firstName} ${patient.lastName}` : "Paciente"} · {o.dentist.name}</p>
      </div>
      {o.voidedAt && <p role="status" className="card border-red-700 font-semibold text-red-800">Anulada: {o.voidReason}</p>}

      <section className="card space-y-2 text-sm">
        <p><span className={`rounded-full px-3 py-1 text-xs font-semibold ${st.cls}`}>{st.label}</span></p>
        <p><span className="font-semibold">Laboratorio:</span> {o.payee.name}{o.payee.phone ? ` · ${o.payee.phone}` : ""}</p>
        {o.shade && <p><span className="font-semibold">Color:</span> {o.shade}</p>}
        {o.material && <p><span className="font-semibold">Material:</span> {o.material}</p>}
        {o.instructions && <p><span className="font-semibold">Indicaciones:</span> {o.instructions}</p>}
        {o.promisedAt && <p><span className="font-semibold">Prometido para:</span> {fmtDate(o.promisedAt)}</p>}
        {clinician && <p><span className="font-semibold">Costo:</span> {copFmt.format(o.cost)}{o.expenseId ? " · ya incluido en una factura del laboratorio" : ""}</p>}
        {original && <p><span className="font-semibold">Repite la</span> <Link href={`/laboratorio/${original.id}`} className="underline">orden {original.number}</Link>: {o.redoReason}. Costo a cargo de: {REDO_PAYER[o.redoPayer as keyof typeof REDO_PAYER] ?? "—"}</p>}
        {redos.map((r) => <p key={r.id}>Repetida en la <Link href={`/laboratorio/${r.id}`} className="underline">orden {r.number}</Link>: {r.redoReason}</p>)}
        {patient && clinician && <p><Link href={`/pacientes/${patient.id}/plan`} className="font-semibold text-teal-800 underline">Ver el plan del paciente</Link></p>}
      </section>

      {active && (
        <section className="card flex flex-wrap gap-2">
          {(o.status === "SENT" || o.status === "ADJUST") && <LabStatusButton id={o.id} to="RECEIVED" />}
          {o.status === "RECEIVED" && clinician && <LabStatusButton id={o.id} to="PLACED" />}
          {o.status === "RECEIVED" && clinician && <LabStatusButton id={o.id} to="ADJUST" />}
          {clinician && (o.status === "RECEIVED" || o.status === "PLACED") && <Link href={`/laboratorio/nueva?repite=${o.id}`} className="btn-secondary min-h-10">Repetir trabajo</Link>}
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-title">Seguimiento</h2>
        <ol className="card space-y-2 text-sm">
          {o.events.map((e) => (
            <li key={e.id}><span className="font-semibold">{labStatus(e.status).label}</span> · {fmt.format(e.at)} · {who.get(e.byId) ?? ""}{e.note ? ` · ${e.note}` : ""}</li>
          ))}
        </ol>
      </section>

      {active && clinician && !o.expenseId && <section className="card space-y-3"><LabCostForm id={o.id} cost={o.cost} /><VoidLabOrder id={o.id} /></section>}
    </div>
  );
}
