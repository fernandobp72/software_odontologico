import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { InviteForm, ROLE_LABEL, ResetButton } from "./forms";
import { revokeInvitation, setActive, setRole } from "./actions";

export default async function EquipoPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return <p className="card">Solo el administrador puede ver esta sección.</p>;
  const [users, invitations] = await Promise.all([
    db.user.findMany({ where: { clinicId: user.clinicId }, orderBy: [{ active: "desc" }, { name: "asc" }] }),
    db.invitation.findMany({ where: { clinicId: user.clinicId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
  ]);
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });

  return (
    <div className="space-y-6">
      <h1 className="page-title">Equipo</h1>
      <InviteForm />

      {invitations.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Invitaciones pendientes</h2>
          <ul className="card divide-y divide-slate-200 p-0">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-900">
                <span>{i.email} · {ROLE_LABEL[i.role]} · vence {fmt.format(i.expiresAt)}</span>
                <form action={revokeInvitation.bind(null, i.id)}><button className="btn-danger min-h-10">Revocar</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-title">Personas con acceso</h2>
        <ul className="space-y-3">
          {users.map((u) => (
            <li key={u.id} className={`card space-y-3 ${u.active ? "" : "opacity-70"}`}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{u.name}{u.id === user.id ? " (tú)" : ""}</p>
                  <p className="muted">{u.email}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${u.active ? "bg-green-100 text-green-900" : "bg-slate-200 text-slate-800"}`}>{u.active ? "Activo" : "Desactivado"}</span>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                <form action={setRole.bind(null, u.id)} className="flex items-end gap-2">
                  <label className="label">Rol
                    <select name="role" defaultValue={u.role} className="field mt-1 w-auto">{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                  </label>
                  <button className="btn-secondary">Cambiar</button>
                </form>
                {u.id !== user.id && (
                  <form action={setActive.bind(null, u.id, !u.active)}><button className={u.active ? "btn-danger" : "btn-secondary"}>{u.active ? "Desactivar" : "Reactivar"}</button></form>
                )}
              </div>
              <ResetButton userId={u.id} />
            </li>
          ))}
        </ul>
        <p className="muted">Siempre debe quedar al menos un administrador activo. Al desactivar a alguien se conserva todo lo que registró.</p>
      </section>
    </div>
  );
}
