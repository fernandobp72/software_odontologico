import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { ASSESSMENT_SECTIONS, type AssessmentData } from "@/lib/assessment";

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
const show = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(", ") : v ?? "").trim();

// Versión anterior de la valoración, en solo lectura, con los campos que cambiaron frente a la vigente.
export default async function VersionPage({ params }: PageProps<"/pacientes/[id]/historia/version/[vid]">) {
  const user = await requireUser();
  if (user.role === "RECEPTION") return <p className="card">Sin acceso a la historia clínica.</p>;
  const { id, vid } = await params;
  const [v, latest] = await Promise.all([
    db.assessment.findFirst({ where: { id: vid, patientId: id, patient: { clinicId: user.clinicId } }, include: { author: { select: { name: true } } } }),
    db.assessment.findFirst({ where: { patientId: id, patient: { clinicId: user.clinicId } }, orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } }),
  ]);
  if (!v || !latest) notFound();
  await db.auditLog.create({ data: { userId: user.id, action: "READ_HC_VERSION", entity: "Assessment", entityId: v.id } });
  const old = (v.data ?? {}) as AssessmentData;
  const cur = (latest.data ?? {}) as AssessmentData;
  const isLatest = v.id === latest.id;
  const changed = ASSESSMENT_SECTIONS.flatMap((s) => s.fields).filter((f) => show(old[f.name]) !== show(cur[f.name])).length;

  return (
    <div className="space-y-4">
      <Link href={`/pacientes/${id}/historia`} className="text-sm font-semibold text-teal-800 underline">← Historia clínica</Link>
      <div className="card space-y-1">
        <h2 className="section-title">Versión del {fmt.format(v.createdAt)}</h2>
        <p className="muted">Registrada por {v.author.name}. Solo lectura: las versiones anteriores no se modifican.</p>
        {!isLatest && <p className="text-sm font-semibold text-amber-900">{changed === 0 ? "Igual a la versión vigente." : `${changed} ${changed === 1 ? "campo cambió" : "campos cambiaron"} frente a la vigente (${fmt.format(latest.createdAt)}, ${latest.author.name}). Están resaltados.`}</p>}
      </div>
      {ASSESSMENT_SECTIONS.map((s) => {
        const fields = s.fields.filter((f) => show(old[f.name]) || show(cur[f.name]));
        if (!fields.length) return null;
        return (
          <section key={s.id} className="card space-y-2">
            <h3 className="font-bold text-slate-900">{s.title}</h3>
            <dl className="space-y-2 text-sm">
              {fields.map((f) => {
                const a = show(old[f.name]);
                const b = show(cur[f.name]);
                const diff = !isLatest && a !== b;
                return (
                  <div key={f.name} className={diff ? "rounded-lg border-l-4 border-amber-500 bg-amber-50 p-2" : ""}>
                    <dt className="font-semibold text-slate-800">{f.label}</dt>
                    <dd className="whitespace-pre-wrap text-slate-900">{a || <span className="text-slate-500">(vacío)</span>}</dd>
                    {diff && <dd className="mt-1 text-slate-700"><span className="font-semibold">Ahora:</span> {b || "(vacío)"}</dd>}
                  </div>
                );
              })}
            </dl>
          </section>
        );
      })}
    </div>
  );
}
