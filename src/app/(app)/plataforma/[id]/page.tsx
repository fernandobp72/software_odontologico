import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/dal";
import { extendTrial, setClinicStatus, supportRevokeInvitation } from "../actions";
import { DeleteClinic, UserSupport } from "./support";

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Activo", cls: "bg-green-100 text-green-900" },
  TRIAL: { label: "En prueba", cls: "bg-blue-100 text-blue-900" },
  SUSPENDED: { label: "Suspendido", cls: "bg-red-100 text-red-900" },
};
const ROLE: Record<string, string> = { ADMIN: "Administrador", DENTIST: "Odontólogo", RECEPTION: "Recepción" };

// Ficha de un cliente: cuentas, personas y uso. Solo conteos y tamaños: nunca contenido clínico.
export default async function ClientePage({ params }: PageProps<"/plataforma/[id]">) {
  await requirePlatformAdmin();
  const { id } = await params;
  const c = await db.clinic.findFirst({ where: { id, system: false }, include: { branches: { orderBy: { createdAt: "asc" }, select: { id: true, name: true, active: true } } } });
  if (!c) notFound();

  const since = new Date(new Date().getTime() - 30 * 86_400_000);
  const [users, invitations, patients, appts, images, evolutions] = await Promise.all([
    db.user.findMany({ where: { clinicId: id }, orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }], select: { id: true, name: true, email: true, role: true, active: true, lastLoginAt: true, createdAt: true } }),
    db.invitation.findMany({ where: { clinicId: id, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }),
    db.patient.count({ where: { clinicId: id } }),
    db.appointment.count({ where: { clinicId: id, startsAt: { gte: since } } }),
    db.clinicalImage.aggregate({ where: { patient: { clinicId: id } }, _count: true, _sum: { size: true } }),
    db.evolution.count({ where: { patient: { clinicId: id }, createdAt: { gte: since } } }),
  ]);
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });
  const fmtT = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
  const lastLogin = users.reduce<Date | null>((m, u) => (u.lastLoginAt && (!m || u.lastLoginAt > m) ? u.lastLoginAt : m), null);
  const mb = ((images._sum.size ?? 0) / 1_048_576).toFixed(1);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/plataforma" className="text-sm font-semibold text-teal-800 underline">← Clientes</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
          <h1 className="page-title">{c.name}</h1>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[c.status]?.cls}`}>{STATUS[c.status]?.label ?? c.status}</span>
        </div>
        <p className="muted">
          Creado {fmt.format(c.createdAt)}
          {c.status === "TRIAL" && c.trialEndsAt ? ` · prueba hasta ${fmt.format(c.trialEndsAt)}` : ""}
          {c.nit ? ` · NIT ${c.nit}` : ""}{c.phone ? ` · ${c.phone}` : ""}{c.address ? ` · ${c.address}` : ""}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {c.status !== "ACTIVE" && <form action={setClinicStatus.bind(null, c.id, "ACTIVE")}><button className="btn-primary min-h-10">Activar</button></form>}
        {c.status !== "SUSPENDED" && <form action={setClinicStatus.bind(null, c.id, "SUSPENDED")}><button className="btn-danger min-h-10">Suspender</button></form>}
        <form action={extendTrial.bind(null, c.id, 15)}><button className="btn-secondary min-h-10">Dar 15 días de prueba</button></form>
      </div>

      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Pacientes", patients],
          ["Citas (30 días)", appts],
          ["Evoluciones (30 días)", evolutions],
          ["Imágenes", `${images._count} · ${mb} MB`],
          ["Usuarios activos", users.filter((u) => u.active).length],
          ["Sedes activas", c.branches.filter((b) => b.active).length],
          ["Última entrada", lastLogin ? fmtT.format(lastLogin) : "Nunca"],
        ].map(([k, v]) => (
          <div key={String(k)} className="card"><dt className="muted">{k}</dt><dd className="text-xl font-bold text-slate-900">{v}</dd></div>
        ))}
      </dl>

      <section className="space-y-3">
        <h2 className="section-title">Personas</h2>
        <ul className="space-y-3">
          {users.map((u) => (
            <li key={u.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-slate-900">{u.name} <span className="muted">· {ROLE[u.role]}</span></p>
                  <p className="muted">{u.email}</p>
                  <p className="muted">Última entrada: {u.lastLoginAt ? fmtT.format(u.lastLoginAt) : "nunca"} · cuenta creada {fmt.format(u.createdAt)}</p>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${u.active ? "bg-green-100 text-green-900" : "bg-slate-200 text-slate-800"}`}>{u.active ? "Activo" : "Inactivo"}</span>
              </div>
              <UserSupport userId={u.id} email={u.email} active={u.active} />
            </li>
          ))}
        </ul>
      </section>

      {invitations.length > 0 && (
        <section className="space-y-2">
          <h2 className="section-title">Invitaciones pendientes</h2>
          <ul className="card divide-y divide-slate-200 p-0">
            {invitations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm text-slate-900">
                <span>{i.email} · {ROLE[i.role]} · vence {fmt.format(i.expiresAt)}</span>
                <form action={supportRevokeInvitation.bind(null, i.id)}><button className="btn-secondary min-h-10">Anular</button></form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-2">
        <h2 className="section-title">Sedes</h2>
        <ul className="card divide-y divide-slate-200 p-0">
          {c.branches.map((b) => <li key={b.id} className="px-4 py-3 text-sm text-slate-900">{b.name}{b.active ? "" : " · inactiva"}</li>)}
        </ul>
      </section>
    
      <DeleteClinic clinicId={c.id} name={c.name} patients={patients} />
    </div>
  );
}
