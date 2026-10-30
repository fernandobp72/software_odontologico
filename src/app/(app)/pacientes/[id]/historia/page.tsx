import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copTotal, type AssessmentData } from "@/lib/assessment";
import AssessmentForm from "./form";

export default async function HistoriaPage({ params }: PageProps<"/pacientes/[id]/historia">) {
  const user = await requireUser();
  const { id } = await params;
  const versions = await db.assessment.findMany({
    where: { patientId: id, patient: { clinicId: user.clinicId } },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
    take: 20,
  });
  const latest = versions[0];
  const data = (latest?.data ?? null) as AssessmentData | null;
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
  const cop = copTotal(data);

  if (user.role === "RECEPTION") return <p className="card">Sin acceso a la historia clínica.</p>;

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-900">
          {latest ? <>Versión vigente: <strong>{fmt.format(latest.createdAt)}</strong> · {latest.author.name}</> : "Aún no hay valoración registrada."}
        </p>
        {cop !== null && cop > 0 && <p className="text-sm font-semibold text-slate-900">COP-D total: {cop}</p>}
      </div>
      <AssessmentForm key={latest?.id ?? "nuevo"} patientId={id} initial={data} />
      {versions.length > 1 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-slate-900">Versiones anteriores ({versions.length - 1})</summary>
          <ul className="mt-3 divide-y divide-slate-200">
            {versions.slice(1).map((v) => (
              <li key={v.id} className="py-2 text-sm text-slate-800">{fmt.format(v.createdAt)} · {v.author.name}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
