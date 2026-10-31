import { db } from "@/lib/db";
import { nounOf } from "@/lib/noun";
import { requireUser } from "@/lib/dal";
import { mailConfigured } from "@/lib/mailer";
import { InviteForm, ROLE_LABEL, ResetButton } from "./forms";
import { revokeInvitation, setActive, setRole, setUserBranches, updatePerson } from "./actions";

export default async function EquipoPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return <p className="card">Solo el administrador puede ver esta sección.</p>;
  const [users, invitations, branches] = await Promise.all([
    db.user.findMany({ where: { clinicId: user.clinicId }, orderBy: [{ active: "desc" }, { name: "asc" }], include: { userBranches: { select: { branchId: true } } } }),
    db.invitation.findMany({ where: { clinicId: user.clinicId, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    db.branch.findMany({ where: { clinicId: user.clinicId, active: true }, orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);
  const mailReady = await mailConfigured();
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Equipo</h1>
        <p className="muted">Quién trabaja en tu {nounOf(user.clinic.noun).name} y qué puede hacer. <strong>Administrador:</strong> todo, incluidos equipo, sedes, catálogo y ajustes. <strong>Odontólogo:</strong> atiende pacientes y escribe en la historia clínica. <strong>Recepción:</strong> agenda, caja y datos de contacto, sin acceso a la historia clínica.</p>
      </div>
      <InviteForm branches={branches} mailReady={mailReady} />

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
              <details>
                <summary className="cursor-pointer text-sm font-semibold text-teal-800">Corregir nombre{u.role !== "RECEPTION" ? " o registro profesional" : ""}</summary>
                <form action={updatePerson.bind(null, u.id)} className="mt-2 grid gap-3 sm:grid-cols-2">
                  <label className="label">Nombre completo<input name="name" defaultValue={u.name} required className="field" /></label>
                  {u.role !== "RECEPTION" && <label className="label">Registro profesional<input name="license" defaultValue={u.licenseNumber ?? ""} className="field" /></label>}
                  <div className="sm:col-span-2"><button className="btn-secondary min-h-10">Guardar</button></div>
                </form>
              </details>
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
              {u.role === "ADMIN" ? (
                <p className="muted">Entra a todas las sedes.</p>
              ) : (
                <form action={setUserBranches.bind(null, u.id)} className="space-y-2">
                  <p className="label">Sedes con acceso</p>
                  <div className="flex flex-wrap gap-2">
                    {branches.map((b) => (
                      <label key={b.id} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-slate-500 bg-white px-3 py-2 text-sm text-slate-900 has-[:checked]:border-teal-700 has-[:checked]:bg-teal-50 has-[:checked]:font-semibold">
                        <input type="checkbox" name="branchIds" value={b.id} defaultChecked={u.userBranches.some((x) => x.branchId === b.id)} className="h-4 w-4 accent-teal-700" />{b.name}
                      </label>
                    ))}
                  </div>
                  <button className="btn-secondary min-h-10">Guardar sedes</button>
                </form>
              )}
              <ResetButton userId={u.id} mailReady={mailReady} />
            </li>
          ))}
        </ul>
        <p className="muted">Siempre debe quedar al menos un administrador activo. Al desactivar a alguien se conserva todo lo que registró.</p>
      </section>
    </div>
  );
}
