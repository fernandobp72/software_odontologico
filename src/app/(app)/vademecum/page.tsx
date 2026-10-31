import { requireUser } from "@/lib/dal";
import { DRUGS, VADEMECUM_VERSION } from "@/lib/vademecum";
import InvimaBadge from "../pacientes/[id]/formulas/invima-badge";

const GROUPS = [...new Set(DRUGS.map((d) => d.group))];

export default async function VademecumPage() {
  const user = await requireUser();
  if (user.role === "RECEPTION") return <p className="card">Solo para el personal clínico.</p>;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Vademécum odontológico</h1>
        <p className="muted max-w-3xl">Medicamentos de uso frecuente en odontología, con la pauta habitual de adultos, advertencias y su presentación contrastada con el CUM (Código Único de Medicamentos vigentes) del INVIMA, que se actualiza cada mes. Versión {VADEMECUM_VERSION}. No incluye medicamentos de control especial (opioides, benzodiacepinas). Apoyo a la decisión: no reemplaza el criterio clínico.</p>
      </div>
      {GROUPS.map((g) => (
        <section key={g} className="space-y-3">
          <h2 className="section-title">{g}</h2>
          {DRUGS.filter((d) => d.group === g).map((d) => (
            <article key={d.id} className="card space-y-2">
              <h3 className="text-lg font-semibold text-slate-900">{d.dci}</h3>
              <p className="text-sm text-slate-800">{d.indication}</p>
              <p className="text-sm text-slate-900"><span className="font-semibold">Adultos:</span> {d.adult.doseText ?? `${d.adult.units ?? 1} unidad(es)`} {d.adult.everyHours ? (d.adult.everyHours === 24 ? "una vez al día" : `cada ${d.adult.everyHours} horas`) : d.adult.timesPerDay ? `${d.adult.timesPerDay} veces al día` : ""} por {d.adult.days} días{d.adult.note ? `. ${d.adult.note}` : ""}.</p>
              {d.ped && <p className="text-sm text-slate-900"><span className="font-semibold">Niños:</span> {d.ped.mgPerKgDay} mg/kg/día en {d.ped.divided} toma(s){d.ped.maxDoseMg ? `, máximo ${d.ped.maxDoseMg} mg por toma` : ""}, por {d.ped.days} días.</p>}
              <ul className="flex flex-wrap gap-2">
                {d.presentations.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-300 px-2 py-1 text-sm text-slate-900">{p.label} <InvimaBadge drugId={d.id} presentationId={p.id} /></li>
                ))}
              </ul>
              {d.warnings.length > 0 && (
                <details className="text-sm text-slate-900">
                  <summary className="cursor-pointer font-semibold">Precauciones e interacciones</summary>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {d.warnings.map((w) => <li key={w.text}>{w.level === "stop" ? "⛔ " : "⚠ "}{w.text}</li>)}
                    {d.interactions.map((i) => <li key={i.text}>{i.level === "stop" ? "⛔ " : "⚠ "}{i.text}</li>)}
                  </ul>
                </details>
              )}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
