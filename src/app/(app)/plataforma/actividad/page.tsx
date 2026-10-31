import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/dal";

// Qué hizo el dueño de la plataforma (y quien tenga ese permiso) sobre los clientes.
export default async function ActividadPage() {
  await requirePlatformAdmin();
  const rows = await db.auditLog.findMany({
    where: { OR: [{ action: { startsWith: "PLATFORM_" } }, { action: { startsWith: "CLINIC_" } }, { action: "TRIAL_EXTEND" }] },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { name: true, email: true } } },
  });
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Actividad</h1>
        <p className="muted">Acciones de administración sobre los clientes: quién, qué y cuándo. Se conservan y no se pueden editar.</p>
      </div>
      {rows.length === 0 ? (
        <p className="card">Aún no hay actividad.</p>
      ) : (
        <ul className="card divide-y divide-slate-200 p-0">
          {rows.map((r) => (
            <li key={r.id} className="px-4 py-3 text-sm text-slate-900">
              <p><strong>{r.user?.name ?? "Sistema"}</strong> {r.detail ?? `${r.action} · ${r.entity}`}</p>
              <p className="muted">{fmt.format(r.createdAt)}{r.user ? ` · ${r.user.email}` : ""}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
