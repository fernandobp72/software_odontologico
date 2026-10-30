import { requireUser } from "@/lib/dal";
import { getCatalog } from "@/lib/catalog";
import { copFmt } from "@/lib/cartera";
import { AdjustForm, CreateProcedureForm, ProcedureEditor } from "./forms";

export default async function CatalogoPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return <p className="card">Solo el administrador puede ver esta sección.</p>;
  const catalog = await getCatalog(user.clinicId);
  const groups = [...new Set(catalog.map((c) => c.group))];
  const priced = catalog.filter((c) => c.active && c.price === 0 && !c.materials.some((m) => m.price > 0)).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Catálogo y tarifas</h1>
        <p className="muted max-w-2xl">Define qué procedimientos ofrece tu consultorio, con qué materiales y a qué tarifa. Lo que desactives deja de ofrecerse al armar un plan; las tarifas se usan solas en los planes y en las sugerencias automáticas.</p>
        {priced > 0 && <p className="mt-2 text-sm font-semibold text-amber-900">{priced} procedimientos activos todavía no tienen tarifa.</p>}
      </div>
      <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
        <AdjustForm groups={groups} />
        <CreateProcedureForm groups={["Consultas", "Prevención", "Operatoria", "Endodoncia", "Cirugía", "Periodoncia", "Rehabilitación", "Estética", "Ortodoncia", "Ayudas diagnósticas", "Otros"]} />
      </div>
      {groups.map((g) => (
        <section key={g} className="space-y-2">
          <h2 className="section-title">{g}</h2>
          <ul className="space-y-2">
            {catalog.filter((c) => c.group === g).map((c) => (
              <li key={c.id} className={`card p-0 ${c.active ? "" : "opacity-70"}`}>
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <span className="font-semibold text-slate-900">{c.name}{c.cups ? <span className="muted"> · CUPS {c.cups}</span> : ""}{c.procId.startsWith("custom-") ? <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-semibold text-teal-900">Propio</span> : null}</span>
                    <span className="text-sm text-slate-800">{c.active ? copFmt.format(c.price) : "No se ofrece"}{c.materials.length ? ` · ${c.materials.length} materiales` : ""}</span>
                  </summary>
                  <div className="border-t border-slate-200 p-4"><ProcedureEditor e={c} /></div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
