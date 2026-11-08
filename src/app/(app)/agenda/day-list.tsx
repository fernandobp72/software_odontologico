import Link from "next/link";
import { normalizePhone, reminderParams, reminderText } from "@/lib/whatsapp";
import { hhmm } from "@/lib/calendar";
import SendButton from "../recordatorios/send-button";
import RescheduleButton from "./item-actions";
import { setStatus } from "./actions";
import { STATUS } from "./status";

export type DayAppointment = {
  id: string; patientId: string; startsAt: Date; endsAt: Date; reason: string | null; status: string;
  patient: { firstName: string; lastName: string; phone: string | null; whatsappOptInAt: Date | null };
  dentist: { name: string };
  clinic: { name: string }; branch: { name: string };
  reminders: { id: string }[];
};

const placeName = (clinic: string, b: string) => (b === "Sede principal" ? clinic : `${clinic} - ${b}`);
const localInput = new Intl.DateTimeFormat("sv-SE", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });

export default function DayList({ items, showPro, now }: { items: DayAppointment[]; showPro: boolean; now: Date }) {
  if (items.length === 0) return <p className="card text-center text-slate-700">No hay citas este día</p>;
  return (
    <ul className="space-y-3">
      {items.map((a) => {
        const open = a.status === "SCHEDULED" || a.status === "CONFIRMED";
        const overdue = open && a.endsAt < now;
        const phone = normalizePhone(a.patient.phone);
        const text = reminderText(reminderParams(a, a.patient.firstName, placeName(a.clinic.name, a.branch.name), "__ORIGIN__/confirmar/__TOKEN__"));
        const minutes = Math.round((a.endsAt.getTime() - a.startsAt.getTime()) / 60_000);
        return (
          <li key={a.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-slate-700">{hhmm(a.startsAt)} – {hhmm(a.endsAt)} <span className="font-normal">· {minutes} min</span></p>
              <div className="flex flex-wrap gap-2">
                {overdue && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-900">Sin cerrar</span>}
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span>
              </div>
            </div>
            <p className="mt-1 text-lg font-semibold"><Link href={`/pacientes/${a.patientId}`} className="hover:underline">{a.patient.firstName} {a.patient.lastName}</Link></p>
            {showPro && <p className="muted">Con {a.dentist.name}</p>}
            {a.patient.phone && <p className="muted">{a.patient.phone}</p>}
            {a.reason && <p className="muted">{a.reason}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              {a.status !== "CONFIRMED" && open && <form action={setStatus.bind(null, a.id, "CONFIRMED")}><button className="btn-secondary">Confirmar</button></form>}
              {a.status !== "ATTENDED" && <form action={setStatus.bind(null, a.id, "ATTENDED")}><button className="btn-secondary">Atendida</button></form>}
              {overdue && <form action={setStatus.bind(null, a.id, "NO_SHOW")}><button className="btn-secondary">No asistió</button></form>}
              {a.status !== "CANCELLED" && a.status !== "ATTENDED" && <form action={setStatus.bind(null, a.id, "CANCELLED")}><button className="btn-danger">Cancelar</button></form>}
              {a.status !== "ATTENDED" && <RescheduleButton id={a.id} current={localInput.format(a.startsAt).replace(" ", "T")} minutes={minutes} />}
            </div>
            {open && !overdue && (
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
    </ul>
  );
}
