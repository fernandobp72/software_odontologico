import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import AppointmentForm from "./form";
import { setStatus } from "./actions";

const STATUS: Record<string, string> = {
  SCHEDULED: "Programada",
  CONFIRMED: "Confirmada",
  ATTENDED: "Atendida",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
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

  const fmt = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Agenda</h1>
      <ul className="space-y-2">
        {appointments.map((a) => (
          <li key={a.id} className="rounded-xl bg-white p-4 ring-1 ring-slate-200">
            <p className="text-sm text-slate-500">{fmt.format(a.startsAt)} · {STATUS[a.status]}</p>
            <p className="font-medium">{a.patient.firstName} {a.patient.lastName}</p>
            {a.reason && <p className="text-sm text-slate-600">{a.reason}</p>}
            <div className="mt-2 flex gap-2">
              <form action={setStatus.bind(null, a.id, "CONFIRMED")}><button className="rounded-lg border px-3 py-2 text-sm">Confirmar</button></form>
              <form action={setStatus.bind(null, a.id, "ATTENDED")}><button className="rounded-lg border px-3 py-2 text-sm">Atendida</button></form>
              <form action={setStatus.bind(null, a.id, "CANCELLED")}><button className="rounded-lg border px-3 py-2 text-sm text-red-600">Cancelar</button></form>
            </div>
          </li>
        ))}
        {appointments.length === 0 && <li className="rounded-xl bg-white p-6 text-center text-slate-500 ring-1 ring-slate-200">No hay citas próximas</li>}
      </ul>
      <AppointmentForm patients={patients.map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName} · ${p.documentNumber}` }))} />
    </div>
  );
}
