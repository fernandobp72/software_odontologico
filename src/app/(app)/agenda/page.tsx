import Link from "next/link";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { branchProfessionals } from "@/lib/professionals";
import AppointmentForm from "./form";
import { setStatus } from "./actions";
import RescheduleButton from "./item-actions";
import SendButton from "../recordatorios/send-button";
import { normalizePhone, reminderParams, reminderText } from "@/lib/whatsapp";

const STATUS: Record<string, { label: string; cls: string }> = {
  SCHEDULED: { label: "Programada", cls: "bg-slate-200 text-slate-900" },
  CONFIRMED: { label: "Confirmada", cls: "bg-blue-100 text-blue-900" },
  ATTENDED: { label: "Atendida", cls: "bg-green-100 text-green-900" },
  CANCELLED: { label: "Cancelada", cls: "bg-red-100 text-red-900" },
  NO_SHOW: { label: "No asistió", cls: "bg-amber-100 text-amber-900" },
};

export default async function AgendaPage() {
  const { user, branch, branches } = await requireBranch();
  const from = new Date();
  from.setHours(0, 0, 0, 0);

  const [appointments, patients, pros] = await Promise.all([
    db.appointment.findMany({
      where: { clinicId: user.clinicId, branchId: branch.id, startsAt: { gte: from } },
      include: { patient: true, dentist: { select: { name: true } }, clinic: { select: { name: true } }, branch: { select: { name: true } }, reminders: { where: { status: "SENT" }, select: { id: true }, take: 1 } },
      orderBy: { startsAt: "asc" },
      take: 50,
    }),
    db.patient.findMany({ where: { clinicId: user.clinicId }, orderBy: { lastName: "asc" }, take: 500 }),
    branchProfessionals(user.clinicId, branch.id),
  ]);
  const defaultDentistId = user.role === "DENTIST" ? user.id : pros.some((p) => p.id === user.id) ? user.id : null;

  const fmt = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });

  const localInput = new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
  const placeName = (clinic: string, b: string) => (b === "Sede principal" ? clinic : `${clinic} - ${b}`);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Agenda</h1>
          {branches.length > 1 && <p className="muted">Sede: {branch.name}</p>}
        </div>
        <Link href="/recordatorios" className="btn-secondary">Recordatorios por WhatsApp</Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
        <ul className="space-y-3">
          {appointments.map((a) => {
            const open = a.status === "SCHEDULED" || a.status === "CONFIRMED";
            const phone = normalizePhone(a.patient.phone);
            const text = reminderText(reminderParams(a, a.patient.firstName, placeName(a.clinic.name, a.branch.name), "__ORIGIN__/confirmar/__TOKEN__"));
            return (
            <li key={a.id} className="card">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold first-letter:uppercase text-slate-700">{fmt.format(a.startsAt)}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span>
              </div>
              <p className="mt-1 text-lg font-semibold">{a.patient.firstName} {a.patient.lastName}</p>
              {pros.length > 1 && <p className="muted">Con {a.dentist.name}</p>}
              {a.reason && <p className="muted">{a.reason}</p>}
              <div className="mt-3 flex flex-wrap gap-2">
                <form action={setStatus.bind(null, a.id, "CONFIRMED")}><button className="btn-secondary">Confirmar</button></form>
                <form action={setStatus.bind(null, a.id, "ATTENDED")}><button className="btn-secondary">Atendida</button></form>
                <form action={setStatus.bind(null, a.id, "CANCELLED")}><button className="btn-danger">Cancelar</button></form>
                {a.status !== "ATTENDED" && <RescheduleButton id={a.id} current={localInput.format(a.startsAt).replace(" ", "T")} minutes={Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000)} />}
              </div>
              {open && (
                <div className="mt-3 border-t border-slate-200 pt-3">
                  {!a.patient.whatsappOptInAt ? (
                    <p className="text-sm font-medium text-amber-900">Para enviar la notificación, registra la autorización de WhatsApp en la <Link href={`/pacientes/${a.patientId}`} className="underline">ficha del paciente</Link>.</p>
                  ) : !phone ? (
                    <p className="text-sm font-medium text-amber-900">El celular no es válido (10 dígitos que empiecen por 3). Corrígelo en la <Link href={`/pacientes/${a.patientId}/editar`} className="underline">ficha</Link>.</p>
                  ) : (
                    <div className="flex flex-wrap items-center gap-3">
                      <SendButton appointmentId={a.id} phone={phone} text={text} label="Enviar notificación" />
                      {a.reminders.length > 0 && <span className="text-xs font-semibold text-green-900">Ya se envió un recordatorio</span>}
                    </div>
                  )}
                </div>
              )}
            </li>
            );
          })}
          {appointments.length === 0 && <li className="card text-center text-slate-700">No hay citas próximas</li>}
        </ul>
        <div className="lg:sticky lg:top-8">
          <AppointmentForm patients={patients.map((p) => ({ id: p.id, label: `${p.firstName} ${p.lastName} · ${p.documentType === "PRE" ? "sin documento" : p.documentNumber}` }))} professionals={user.role === "DENTIST" ? [] : pros.map((p) => ({ id: p.id, name: p.name }))} defaultDentistId={defaultDentistId} />
        </div>
      </div>
    </div>
  );
}
