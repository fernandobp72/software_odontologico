import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import type { ConditionKey } from "@/lib/catalogs";
import Odontogram from "./odontogram";
import EvolutionForm from "./evolution-form";

export default async function PacientePage({ params }: PageProps<"/pacientes/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const p = await db.patient.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!p) notFound();

  const canEdit = user.role !== "RECEPTION";
  const [allFindings, evolutions] = await Promise.all([
    db.toothFinding.findMany({ where: { patientId: p.id }, orderBy: { createdAt: "asc" } }),
    db.evolution.findMany({ where: { patientId: p.id }, orderBy: { signedAt: "desc" }, include: { dentist: { select: { name: true } } }, take: 50 }),
  ]);
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
      <h1 className="page-title">{p.firstName} {p.lastName}</h1>
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
        </aside>
        <div className="space-y-6 lg:col-span-2">
          <Odontogram patientId={p.id} findings={findings} canEdit={canEdit} />
          {canEdit && <EvolutionForm patientId={p.id} />}
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
