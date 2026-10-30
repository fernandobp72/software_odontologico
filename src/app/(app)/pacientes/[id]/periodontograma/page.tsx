import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import type { Perio, PerioSummary } from "@/lib/perio";
import PerioEditor from "./editor";

export default async function PerioPage({ params }: PageProps<"/pacientes/[id]/periodontograma">) {
  const user = await requireUser();
  const { id } = await params;
  if (user.role === "RECEPTION") return <p className="card">Sin acceso a la historia clínica.</p>;

  const versions = await db.perioExam.findMany({
    where: { patientId: id, patient: { clinicId: user.clinicId } },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
    take: 20,
  });
  const latest = versions[0];
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

  return (
    <div className="space-y-4">
      <PerioEditor key={latest?.id ?? "nuevo"} patientId={id} initial={(latest?.data ?? {}) as Perio} />
      {versions.length > 0 && (
        <section className="card">
          <h2 className="section-title mb-3">Versiones</h2>
          <ul className="divide-y divide-slate-200">
            {versions.map((v, i) => {
              const s = v.summary as unknown as PerioSummary;
              return (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm text-slate-900">
                  <span>{fmt.format(v.createdAt)} · {v.author.name}{i === 0 ? " (vigente)" : ""}</span>
                  <span className="muted">Sangrado {s.bopPct}% · Placa {s.plaquePct}% · ≥4 mm: {s.n4} · ≥6 mm: {s.n6} · promedio {s.meanPd} mm</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
