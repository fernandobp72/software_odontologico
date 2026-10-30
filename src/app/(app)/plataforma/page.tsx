import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/dal";
import { extendTrial, setClinicStatus } from "./actions";

const STATUS: Record<string, { label: string; cls: string }> = {
  ACTIVE: { label: "Activo", cls: "bg-green-100 text-green-900" },
  TRIAL: { label: "En prueba", cls: "bg-blue-100 text-blue-900" },
  SUSPENDED: { label: "Suspendido", cls: "bg-red-100 text-red-900" },
};

// Vista del dueño de la plataforma: solo cuentas y conteos, nunca datos clínicos de pacientes.
export default async function PlataformaPage() {
  await requirePlatformAdmin();
  const clinics = await db.clinic.findMany({ orderBy: { createdAt: "desc" }, include: { _count: { select: { users: true, patients: true } } } });
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeZone: "America/Bogota" });
  const count = (s: string) => clinics.filter((c) => c.status === s).length;

  return (
    <div className="space-y-6">
      <h1 className="page-title">Plataforma</h1>
      <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="card"><dt className="muted">Consultorios</dt><dd className="text-xl font-bold">{clinics.length}</dd></div>
        <div className="card"><dt className="muted">Activos</dt><dd className="text-xl font-bold text-green-800">{count("ACTIVE")}</dd></div>
        <div className="card"><dt className="muted">En prueba</dt><dd className="text-xl font-bold text-blue-800">{count("TRIAL")}</dd></div>
        <div className="card"><dt className="muted">Suspendidos</dt><dd className="text-xl font-bold text-red-800">{count("SUSPENDED")}</dd></div>
      </dl>
      <ul className="space-y-3">
        {clinics.map((c) => (
          <li key={c.id} className="card space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-lg font-semibold text-slate-900">{c.name}</p>
                <p className="muted">Creado {fmt.format(c.createdAt)} · {c._count.users} usuarios · {c._count.patients} pacientes{c.status === "TRIAL" && c.trialEndsAt ? ` · prueba hasta ${fmt.format(c.trialEndsAt)}` : ""}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[c.status]?.cls}`}>{STATUS[c.status]?.label ?? c.status}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {c.status !== "ACTIVE" && <form action={setClinicStatus.bind(null, c.id, "ACTIVE")}><button className="btn-primary min-h-10">Activar</button></form>}
              {c.status !== "SUSPENDED" && <form action={setClinicStatus.bind(null, c.id, "SUSPENDED")}><button className="btn-danger min-h-10">Suspender</button></form>}
              <form action={extendTrial.bind(null, c.id, 15)}><button className="btn-secondary min-h-10">Dar 15 días de prueba</button></form>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
