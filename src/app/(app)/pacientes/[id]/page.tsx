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
      <h1 className="text-xl font-semibold">{p.firstName} {p.lastName}</h1>
      <dl className="divide-y divide-slate-200 rounded-xl bg-white ring-1 ring-slate-200">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-3">
            <dt className="text-sm text-slate-500">{k}</dt>
            <dd className="text-sm font-medium">{v || "—"}</dd>
          </div>
        ))}
      </dl>
      <Odontogram patientId={p.id} findings={findings} canEdit={canEdit} />
      {canEdit && <EvolutionForm patientId={p.id} />}
      <section className="space-y-2">
        <h2 className="font-medium">Evoluciones</h2>
        {evolutions.map((e) => (
          <article key={e.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-xs text-slate-500">{fmt.format(e.signedAt)} · {e.dentist.name}{e.diagnosisCode ? ` · ${e.diagnosisCode}` : ""}{e.procedureCode ? ` · CUPS ${e.procedureCode}` : ""}</p>
            {e.reason && <p className="text-sm font-medium">{e.reason}</p>}
            <p className="whitespace-pre-wrap text-sm">{e.note}</p>
          </article>
        ))}
        {evolutions.length === 0 && <p className="rounded-xl bg-white p-6 text-center text-slate-500 ring-1 ring-slate-200">Sin evoluciones</p>}
      </section>
    </div>
  );
}
