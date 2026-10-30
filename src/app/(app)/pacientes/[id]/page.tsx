import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import type { ConditionKey } from "@/lib/catalogs";
import { setWhatsappOptIn } from "../../recordatorios/actions";
import Odontogram from "./odontogram";
import EvolutionForm from "./evolution-form";

export default async function PacientePage({ params }: PageProps<"/pacientes/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const p = await db.patient.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!p) notFound();

  const canEdit = user.role !== "RECEPTION";
  const [allFindings, evolutions, openItemsRaw, initialSnap, activeDx] = await Promise.all([
    db.toothFinding.findMany({ where: { patientId: p.id }, orderBy: { createdAt: "asc" } }),
    db.evolution.findMany({ where: { patientId: p.id }, orderBy: { signedAt: "desc" }, include: { dentist: { select: { name: true } } }, take: 50 }),
    db.treatmentItem.findMany({ where: { status: { in: ["PLANNED", "IN_PROGRESS"] }, plan: { patientId: p.id, status: { in: ["DRAFT", "PRESENTED", "ACCEPTED", "IN_PROGRESS"] } } }, orderBy: [{ phase: "asc" }, { createdAt: "asc" }] }),
    db.odontogramSnapshot.findUnique({ where: { patientId_kind: { patientId: p.id, kind: "INITIAL" } } }),
    db.diagnosis.findMany({ where: { patientId: p.id, status: "ACTIVE" }, select: { code: true, tooth: true } }),
  ]);
  const pending = openItemsRaw.filter((i) => i.tooth).map((i) => ({ tooth: i.tooth as number, surfaces: i.surfaces ?? "" }));
  const openItems = openItemsRaw.map((i) => ({
    id: i.id, name: i.name, tooth: i.tooth, surfaces: i.surfaces, material: i.material, procedureCode: i.procedureCode,
    // Diagnóstico activo del mismo diente (si hay), para completar el código y la redacción.
    diagnosisCode: (i.tooth ? activeDx.find((d) => d.tooth === i.tooth)?.code : undefined) ?? null,
  }));
  // El último registro por diente/superficie es el estado actual.
  const latest = new Map<string, { tooth: number; surface: string | null; condition: ConditionKey }>();
  for (const f of allFindings) latest.set(`${f.tooth}|${f.surface ?? ""}`, { tooth: f.tooth, surface: f.surface, condition: f.condition });
  const findings = [...latest.values()].filter((f) => f.condition !== "HEALTHY");
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

  const rows: [string, string | null][] = [
    ["Documento", `${p.documentType} ${p.documentNumber}`],
    ["Celular", p.phone],
    ["Correo", p.email],
    ["EPS", p.eps],
    ["Alergias", p.allergies],
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-6 lg:grid-cols-3 lg:items-start">
        <aside className="order-first lg:order-last lg:sticky lg:top-8">
          <dl className="card divide-y divide-slate-200 p-0">
            {rows.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-3">
                <dt className="muted">{k}</dt>
                <dd className="text-right text-sm font-semibold text-slate-900">{v || "—"}</dd>
              </div>
            ))}
          </dl>
          <div className="card mt-3 flex items-center justify-between gap-3">
            <div>
              <p className="muted">Recordatorios por WhatsApp</p>
              <p className="text-sm font-semibold text-slate-900">{p.whatsappOptInAt ? "Autorizado" : "No autorizado"}</p>
            </div>
            <form action={setWhatsappOptIn.bind(null, p.id, !p.whatsappOptInAt)}>
              <button className="btn-secondary min-h-10">{p.whatsappOptInAt ? "Retirar" : "Registrar autorización"}</button>
            </form>
          </div>
        </aside>
        <div className="space-y-6 lg:col-span-2">
          <Odontogram patientId={p.id} findings={findings} canEdit={canEdit} initial={initialSnap ? (initialSnap.data as unknown as { tooth: number; surface: string | null; condition: ConditionKey }[]) : null} planned={pending} />
          {canEdit && <EvolutionForm patientId={p.id} openItems={openItems} />}
          <section className="space-y-3">
            <h2 className="section-title">Evoluciones</h2>
            {evolutions.map((e) => (
              <article key={e.id} className="card">
                <p className="muted">{fmt.format(e.signedAt)} · {e.dentist.name}{e.diagnosisCode ? ` · ${e.diagnosisCode}` : ""}{e.procedureCode ? ` · CUPS ${e.procedureCode}` : ""}</p>
                {e.reason && <p className="font-semibold">{e.reason}</p>}
                <p className="whitespace-pre-wrap">{e.note}</p>
              </article>
            ))}
            {evolutions.length === 0 && <p className="card text-center text-slate-700">Sin evoluciones</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
