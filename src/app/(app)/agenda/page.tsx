import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import AppointmentForm from "./form";
import { setStatus } from "./actions";

const STATUS: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: "Programada", cls: "bg-slate-200 text-slate-900" },
  CONFIRMED: { label: "Confirmada", cls: "bg-blue-100 text-blue-900" },
  ATTENDED: { label: "Atendida", cls: "bg-green-100 text-green-900" },
  CANCELLED: { label: "Cancelada", cls: "bg-red-100 text-red-900" },
  NO_SHOW: { label: "No asistió", cls: "bg-amber-100 text-amber-900" },
};

export default async function AgendaPage() {
  const user = await requireUser();
  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const [appointments, patients] = await Promise.all([
    db.appointment.findMany({
      where: { clinicId: user.clinicId, startsAt: { gte: from } },
      include: { patient: true },
      orderBy: { startsAt: "asc" },
      take: 50,
    }),
    db.patient.findMany({ where: { clinicId: user.clinicId }, orderBy: { lastName: "asc" }, take: 500 }),
  ]);

  const fmt = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Agenda</h1>
        <Link href="/recordatorios" className="btn-secondary">Recordatorios por WhatsApp</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
        <ul className="space-y-3">
          {appointments.map((a) => (
            <li key={a.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold first-letter:uppercase text-slate-700">{fmt.format(a.startsAt)}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span>
              </div>
              <p className="mt-1 text-lg font-semibold">{a.patient.firstName} {a.patient.lastName}</p>
              {a.reason && <p className="muted">{a.reason}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={setStatus.bind(null, a.id, "CONFIRMED")}><button className="btn-secondary">Confirmar</button></form>
                <form action={setStatus.bind(null, a.id, "ATTENDED")}><button className="btn-secondary">Atendida</button></form>
                <form action={setStatus.bind(null, a.id, "CANCELLED")}><button className="btn-danger">Cancelar</button></form>
              </div>
            </li>
          ))}
          {appointments.length === 0 && <li className="card text-center text-slate-700">No hay citas próximas</li>}
        </ul>
        <div className="lg:sticky lg:top-8">
          <AppointmentForm patients={patients.map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName} · ${p.documentNumber}` }))} />
        </div>
      </div>
    </div>
  );
}
