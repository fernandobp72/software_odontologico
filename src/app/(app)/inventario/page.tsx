import Link from "next/link";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { LEVEL_LABEL, LEVEL_ORDER, evaluate, unitLabel, type Level } from "@/lib/inventory";
import VoicePanel from "./voice-panel";
import { oldUnitItems } from "@/lib/supply-ops";
import { UpgradeBanner, CatalogPicker, ConsumeForm, CustomItemForm, DiscardButton, ItemSettings, ReceiveForm } from "./forms";

const STYLE: Record<Level, { chip: string; dot: string; icon: string }> = {
  RED: { chip: "bg-red-100 text-red-900", dot: "bg-red-600", icon: "⛔" },
  YELLOW: { chip: "bg-amber-100 text-amber-900", dot: "bg-amber-500", icon: "⚠" },
  GREEN: { chip: "bg-green-100 text-green-900", dot: "bg-green-600", icon: "✓" },
  NONE: { chip: "bg-slate-200 text-slate-800", dot: "bg-slate-400", icon: "•" },
};

const dateFmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "UTC" });
const stampFmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short", timeZone: "America/Bogota" });
const KIND: Record<string, string> = { IN: "Ingreso", OUT: "Salida", DISCARD: "Descarte" };

export default async function InventarioPage({ searchParams }: PageProps<"/inventario">) {
  const { user, branch, branches } = await requireBranch();
  const admin = user.role === "ADMIN";
  const sp = await searchParams;
  const filter = typeof sp.f === "string" && ["RED", "YELLOW", "GREEN", "NONE"].includes(sp.f) ? (sp.f as Level) : null;

  const [items, moved, recent] = await Promise.all([
    db.supplyItem.findMany({ where: { clinicId: user.clinicId }, orderBy: { name: "asc" }, include: { lots: { where: { branchId: branch.id, quantity: { gt: 0 } } } } }),
    db.supplyMovement.groupBy({ by: ["itemId"], where: { clinicId: user.clinicId, branchId: branch.id }, _count: { _all: true } }),
    db.supplyMovement.findMany({ where: { clinicId: user.clinicId, branchId: branch.id }, orderBy: { createdAt: "desc" }, take: 12, include: { item: { select: { name: true, unit: true } } } }),
  ]);
  const stocked = new Set(moved.map((m) => m.itemId));
  const names = new Map((await db.user.findMany({ where: { id: { in: [...new Set(recent.map((r) => r.userId))] } }, select: { id: true, name: true } })).map((u) => [u.id, u.name]));

  const rows = items
    .filter((i) => i.active)
    .map((i) => ({ i, st: evaluate(i, i.lots, stocked.has(i.id)) }))
    .sort((a, b) => LEVEL_ORDER[a.st.level] - LEVEL_ORDER[b.st.level] || a.i.name.localeCompare(b.i.name, "es"));
  const count = (l: Level) => rows.filter((r) => r.st.level === l).length;
  const shown = filter ? rows.filter((r) => r.st.level === filter) : rows;
  const inactive = items.filter((i) => !i.active);
  const old = admin ? await oldUnitItems(user.clinicId) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Inventario</h1>
        {admin && <p className="mt-1"><Link href="/inventario/kits" className="text-sm font-semibold text-teal-800 underline">Kits por procedimiento (descuento automático)</Link></p>}
        <p className="muted max-w-2xl">Lo que está en rojo o amarillo sube arriba. Registra los ingresos con su fecha de vencimiento y las salidas; el sistema gasta primero lo que vence antes.{branches.length > 1 ? ` Sede: ${branch.name} (cada sede tiene sus propias existencias).` : ""}</p>
      </div>

      {old.length > 0 && <UpgradeBanner names={old.map((o) => o.item.name)} />}

      {rows.length > 0 && <VoicePanel items={rows.map(({ i }) => ({ id: i.id, name: i.name, category: i.category, unit: i.unit, packLabel: i.packLabel, packSize: i.packSize, perishable: i.perishable }))} />}

      {rows.length > 0 && (
        <nav aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
          <Link href="/inventario" className={`rounded-full border px-3 py-2 text-sm font-semibold ${!filter ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-300 text-slate-800"}`}>Todos ({rows.length})</Link>
          {(["RED", "YELLOW", "GREEN", "NONE"] as Level[]).map((l) => (
            <Link key={l} href={`/inventario?f=${l}`} className={`rounded-full border px-3 py-2 text-sm font-semibold ${filter === l ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-300 text-slate-800"}`}>
              <span className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full ${STYLE[l].dot}`} aria-hidden />{LEVEL_LABEL[l]} ({count(l)})
            </Link>
          ))}
        </nav>
      )}

      {rows.length === 0 ? (
        <div className="card space-y-2">
          <p className="font-semibold text-slate-900">Aún no tienes productos en el inventario.</p>
          <p className="muted">{admin ? "Elige abajo los insumos que usas y empieza a registrar lo que tienes." : "Pide al administrador que agregue los productos."}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {shown.map(({ i, st }) => (
            <li key={i.id} className="card p-0">
              <details>
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
                  <span className="flex min-w-0 items-center gap-3">
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${STYLE[st.level].chip}`}><span aria-hidden>{STYLE[st.level].icon}</span>{LEVEL_LABEL[st.level]}</span>
                    <span className="min-w-0"><span className="block font-semibold text-slate-900">{i.name}</span><span className="muted">{i.category}</span></span>
                  </span>
                  <span className="text-sm text-slate-800 sm:text-right">
                    <span className="block font-semibold">{st.stock} {unitLabel(i.unit, st.stock)}{i.packSize && i.packLabel && st.stock >= i.packSize ? ` (${Math.floor(st.stock / i.packSize)} ${unitLabel(i.packLabel, Math.floor(st.stock / i.packSize))}${st.stock % i.packSize ? ` y ${st.stock % i.packSize}` : ""})` : ""}{i.minStock ? ` · mín. ${i.minStock}` : ""}</span>
                    {st.reasons.length > 0 && <span className="block">{st.reasons.join(" · ")}</span>}
                  </span>
                </summary>
                <div className="space-y-4 border-t border-slate-200 p-4">
                  {st.nextExpiry && <p className="text-sm">Próximo vencimiento: <strong>{dateFmt.format(st.nextExpiry)}</strong></p>}
                  {i.lots.length > 0 && (
                    <ul className="space-y-1 text-sm text-slate-800">
                      {[...i.lots].sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity)).map((l) => (
                        <li key={l.id}>{l.quantity} {unitLabel(i.unit, l.quantity)}{l.lotCode ? ` · lote ${l.lotCode}` : ""}{l.expiresAt ? ` · vence ${dateFmt.format(l.expiresAt)}` : " · sin vencimiento"}</li>
                      ))}
                    </ul>
                  )}
                  {st.expiredQty > 0 && <DiscardButton itemId={i.id} />}
                  <div className="grid gap-6 md:grid-cols-2">
                    <ReceiveForm itemId={i.id} unit={i.unit} perishable={i.perishable} pack={i} />
                    <ConsumeForm itemId={i.id} unit={i.unit} pack={i} />
                  </div>
                  {admin && <div className="border-t border-slate-200 pt-4"><ItemSettings itemId={i.id} minStock={i.minStock} warnDays={i.warnDays} perishable={i.perishable} active={i.active} /></div>}
                </div>
              </details>
            </li>
          ))}
          {shown.length === 0 && <li className="muted">Ningún producto en este estado.</li>}
        </ul>
      )}

      {admin && (
        <section className="space-y-3">
          <h2 className="section-title">Agregar productos</h2>
          <details className="card" open={rows.length === 0}>
            <summary className="cursor-pointer font-semibold text-slate-900">Elegir del catálogo de insumos</summary>
            <div className="mt-3"><CatalogPicker existing={items.map((i) => i.name)} /></div>
          </details>
          <details className="card">
            <summary className="cursor-pointer font-semibold text-slate-900">Agregar un producto propio</summary>
            <div className="mt-3 max-w-xl"><CustomItemForm /></div>
          </details>
          {inactive.length > 0 && (
            <details className="card">
              <summary className="cursor-pointer font-semibold text-slate-900">Productos que ya no uso ({inactive.length})</summary>
              <ul className="mt-3 space-y-3">
                {inactive.map((i) => <li key={i.id} className="border-t border-slate-200 pt-3 first:border-0 first:pt-0"><p className="mb-2 font-semibold">{i.name}</p><ItemSettings itemId={i.id} minStock={i.minStock} warnDays={i.warnDays} perishable={i.perishable} active={i.active} /></li>)}
              </ul>
            </details>
          )}
        </section>
      )}

      {recent.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Últimos movimientos</h2>
          <ul className="card divide-y divide-slate-200 p-0 text-sm">
            {recent.map((m) => (
              <li key={m.id} className="flex flex-wrap justify-between gap-2 px-4 py-2">
                <span><strong>{KIND[m.kind] ?? m.kind}</strong> · {m.item.name}{m.note ? ` · ${m.note}` : ""}</span>
                <span className="text-slate-800">{m.delta > 0 ? "+" : ""}{m.delta} · {names.get(m.userId) ?? "—"} · {stampFmt.format(m.createdAt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
