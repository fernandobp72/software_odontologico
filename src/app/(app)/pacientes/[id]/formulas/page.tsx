import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { rxContextFor } from "@/lib/rx-context";
import { generate, isPediatric, patientFlags } from "@/lib/rx-rules";
import RxEditor from "./editor";
import VoidButton from "./void-button";

export default async function FormulasPage({ params }: PageProps<"/pacientes/[id]/formulas">) {
  const user = await requireUser();
  const { id } = await params;
  if (user.role === "RECEPTION") return <p className="card">Sin acceso a las fórmulas médicas.</p>;
  const got = await rxContextFor(id, user.clinicId);
  if (!got) return <p className="card">Paciente no encontrado</p>;
  const { ctx } = got;

  const [list, me] = await Promise.all([
    db.prescription.findMany({ where: { patientId: id, clinicId: user.clinicId }, orderBy: { issuedAt: "desc" }, include: { items: { orderBy: { position: "asc" }, select: { name: true, concentration: true } }, dentist: { select: { name: true } } }, take: 30 }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { licenseNumber: true } }),
  ]);
  const flags = patientFlags(ctx);
  const gen = generate(ctx);
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

  return (
    <div className="space-y-6">
      <RxEditor
        patientId={id}
        pediatric={isPediatric(ctx)}
        weight={ctx.weightKg}
        flags={{ tags: [...flags.tags], meds: flags.meds, allergyText: flags.allergyText, ageYears: flags.ageYears }}
        initial={gen}
        diagnoses={ctx.diagnoses.map((d) => ({ code: d.code, description: d.description }))}
        licenseOk={!!me.licenseNumber}
      />
      <section className="space-y-3">
        <h2 className="section-title">Fórmulas anteriores</h2>
        {list.length === 0 && <p className="card text-center text-slate-700">Aún no hay fórmulas</p>}
        {list.map((r) => (
          <article key={r.id} className="card space-y-2">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-slate-900">Fórmula N.º {r.number} {r.voidedAt && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-bold text-red-900">ANULADA</span>}</p>
                <p className="muted">{fmt.format(r.issuedAt)} · {r.dentist.name}{r.diagnosisCode ? ` · ${r.diagnosisCode}` : ""}</p>
              </div>
              <div className="flex gap-2">
                <Link href={`/formula/${r.id}`} className="btn-secondary min-h-10" target="_blank">Ver / imprimir</Link>
                {!r.voidedAt && (r.dentistId === user.id || user.role === "ADMIN") && <VoidButton id={r.id} />}
              </div>
            </div>
            <ul className="list-disc pl-5 text-sm text-slate-900">{r.items.map((i, k) => <li key={k}>{i.name} {i.concentration}</li>)}</ul>
            {r.voidReason && <p className="muted">Motivo de anulación: {r.voidReason}</p>}
          </article>
        ))}
      </section>
    </div>
  );
}
