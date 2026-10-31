import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { setBranchActive } from "./actions";
import { CreateBranchForm, EditBranchForm } from "./forms";

export default async function SedesPage() {
  const user = await requireUser();
  if (user.role !== "ADMIN") return <p className="card">Solo el administrador puede ver esta sección.</p>;
  const branches = await db.branch.findMany({ where: { clinicId: user.clinicId }, orderBy: [{ active: "desc" }, { createdAt: "asc" }], include: { _count: { select: { users: true } }, cashSessions: { where: { closedAt: null }, select: { id: true } } } });
  const activeCount = branches.filter((b) => b.active).length;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Sedes</h1>
      <p className="muted max-w-2xl">Los pacientes y su historia clínica son compartidos por todas las sedes. La agenda, la caja y los recordatorios son de cada sede. Cada persona entra solo a las sedes que le asignes en Equipo.</p>
      <CreateBranchForm />
      <ul className="space-y-3">
        {branches.map((b) => (
          <li key={b.id} className={`card space-y-3 ${b.active ? "" : "opacity-70"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-lg font-semibold text-slate-900">{b.name}</p>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${b.active ? "bg-green-100 text-green-900" : "bg-slate-200 text-slate-800"}`}>{b.active ? "Activa" : "Desactivada"} · {b._count.users} personas</span>
            </div>
            <EditBranchForm b={b} />
            {b.active ? (
              activeCount > 1 && b.cashSessions.length === 0 ? (
                <form action={setBranchActive.bind(null, b.id, false)}><button className="btn-danger">Desactivar sede</button></form>
              ) : (
                <p className="muted">{b.cashSessions.length > 0 ? "Cierra la caja de esta sede para poder desactivarla." : "Debe quedar al menos una sede activa."}</p>
              )
            ) : (
              <form action={setBranchActive.bind(null, b.id, true)}><button className="btn-secondary">Reactivar sede</button></form>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
