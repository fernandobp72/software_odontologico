import Link from "next/link";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { getCatalog } from "@/lib/catalog";
import { unitLabel } from "@/lib/inventory";
import { KitAddForm, KitRemoveButton } from "../forms";

export default async function KitsPage() {
  const { user } = await requireBranch();
  if (user.role !== "ADMIN") return <p className="card">Solo el administrador puede definir los kits.</p>;
  const [catalog, items, lines] = await Promise.all([
    getCatalog(user.clinicId, { onlyActive: true }),
    db.supplyItem.findMany({ where: { clinicId: user.clinicId, active: true }, orderBy: { name: "asc" } }),
    db.supplyKitLine.findMany({ where: { clinicId: user.clinicId }, include: { item: { select: { name: true, unit: true } } } }),
  ]);
  const byProc = new Map<string, typeof lines>();
  for (const l of lines) byProc.set(l.procId, [...(byProc.get(l.procId) ?? []), l]);
  const groups = [...new Set(catalog.map((c) => c.group))];
  const opts = items.map((i) => ({ id: i.id, label: `${i.name} (${i.unit})` }));

  return (
    <div className="space-y-6">
      <div>
        <Link href="/inventario" className="text-sm font-semibold text-teal-800 underline">← Volver al inventario</Link>
        <h1 className="page-title mt-2">Kits por procedimiento</h1>
        <p className="muted max-w-2xl">Define una sola vez qué insumos gasta cada procedimiento. Cuando el odontólogo firma una evolución con ese procedimiento hecho (o lo marca como hecho en el plan), el inventario se descuenta solo, gastando primero lo que vence antes. Si algo no alcanza, la historia clínica se guarda igual y el semáforo se pone en rojo.</p>
      </div>
      {items.length === 0 ? (
        <p className="card">Primero agrega productos al <Link href="/inventario" className="font-semibold underline">inventario</Link>.</p>
      ) : (
        groups.map((g) => (
          <section key={g} className="space-y-2">
            <h2 className="section-title">{g}</h2>
            <ul className="space-y-2">
              {catalog.filter((c) => c.group === g).map((c) => {
                const ls = byProc.get(c.procId) ?? [];
                return (
                  <li key={c.id} className="card p-0">
                    <details>
                      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
                        <span className="font-semibold text-slate-900">{c.name}</span>
                        <span className="text-sm text-slate-800">{ls.length ? `${ls.length} insumo${ls.length === 1 ? "" : "s"}` : "Sin kit"}</span>
                      </summary>
                      <div className="space-y-4 border-t border-slate-200 p-4">
                        {ls.length > 0 && (
                          <ul className="divide-y divide-slate-200 text-sm">
                            {ls.map((l) => (
                              <li key={l.id} className="flex items-center justify-between gap-2 py-1">
                                <span>{l.quantity} {unitLabel(l.item.unit, l.quantity)} de {l.item.name}</span>
                                <KitRemoveButton lineId={l.id} />
                              </li>
                            ))}
                          </ul>
                        )}
                        <KitAddForm procId={c.procId} items={opts} />
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
