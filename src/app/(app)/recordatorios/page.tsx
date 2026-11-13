import Link from "next/link";
import { nounOf } from "@/lib/noun";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { cloudConfig, normalizePhone, reminderParams, reminderText } from "@/lib/whatsapp";
import SendButton from "./send-button";

const placeName = (clinic: string, branch: string) => (branch === "Sede principal" ? clinic : `${clinic} - ${branch}`);

export default async function RecordatoriosPage({ searchParams }: PageProps<"/recordatorios">) {
  const { user, branch } = await requireBranch();
  const now = new Date();
  if ((await searchParams).ver === "pasados") return <PastReminders clinicId={user.clinicId} branchId={branch.id} now={now} />;
  const appointments = await db.appointment.findMany({
    where: { clinicId: user.clinicId, branchId: branch.id, status: { in: ["SCHEDULED", "CONFIRMED"] }, startsAt: { gt: now, lte: new Date(now.getTime() + 72 * 3_600_000) } },
    include: { patient: true, clinic: true, branch: true, reminders: { orderBy: { createdAt: "desc" } } },
    orderBy: { startsAt: "asc" },
  });
  const fmt = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
  const auto = !!cloudConfig(appointments[0]?.clinic ?? (await db.clinic.findUniqueOrThrow({ where: { id: user.clinicId } })));
  // El texto de ayuda y la configuración son para administración y recepción; el odontólogo solo ve la lista.
  const showHelp = user.role !== "DENTIST";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Recordatorios</h1>
        <span className="flex flex-wrap gap-2">
          <Link href="/recordatorios?ver=pasados" className="btn-secondary">Últimos 7 días</Link>
          <Link href="/agenda" className="btn-secondary">Volver a la agenda</Link>
        </span>
      </div>
      {showHelp && (
        <p className="rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900">
          {auto
            ? "Envío automático activo: los recordatorios salen desde el WhatsApp Business {nounOf(user.clinic.noun).del} {nounOf(user.clinic.noun).name}. Aquí puedes ver el estado y reenviar a mano si hace falta."
            : "Modo manual: pulsa «Enviar por WhatsApp» y se abre el chat con el mensaje listo; solo falta enviarlo."}
          {" "}El mensaje no incluye datos de salud y trae un enlace para confirmar o cancelar.
          {user.role === "ADMIN" && !auto && <> Para envío automático conecta el WhatsApp Business {nounOf(user.clinic.noun).del} {nounOf(user.clinic.noun).name} en <Link href="/configuracion" className="font-semibold underline">Mi {nounOf(user.clinic.noun).name}</Link>.</>}
        </p>
      )}
      <ul className="space-y-3">
        {appointments.map((a) => {
          const phone = normalizePhone(a.patient.phone);
          const optIn = !!a.patient.whatsappOptInAt;
          const sent = a.reminders.find((r) => r.status === "SENT");
          const failed = a.reminders.find((r) => r.status === "FAILED");
          const text = reminderText(reminderParams(a, a.patient.firstName, placeName(a.clinic.name, a.branch.name), "__ORIGIN__/confirmar/__TOKEN__"));
          return (
            <li key={a.id} className="card space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold first-letter:uppercase text-slate-700">{fmt.format(a.startsAt)} · {a.status === "CONFIRMED" ? "Confirmada" : "Sin confirmar"}</p>
                  <p className="text-lg font-semibold text-slate-900">{a.patient.firstName} {a.patient.lastName}</p>
                  <p className="muted">{a.patient.phone ?? "Sin teléfono"}</p>
                </div>
                {sent && <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-900">Enviado ({sent.channel === "CLOUD" ? "automático" : "manual"})</span>}
                {!sent && failed && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-900">Falló el envío</span>}
              </div>
              {!optIn ? (
                <p className="text-sm font-medium text-amber-900">El paciente no autorizó recordatorios por WhatsApp. Puedes registrarlo desde su <Link href={`/pacientes/${a.patientId}`} className="underline">ficha</Link>.</p>
              ) : !phone ? (
                <p className="text-sm font-medium text-amber-900">El celular no es válido (debe tener 10 dígitos y empezar por 3).</p>
              ) : (
                <SendButton appointmentId={a.id} phone={phone} text={text} />
              )}
            </li>
          );
        })}
        {appointments.length === 0 && <li className="card text-center text-slate-700">No hay citas en las próximas 72 horas</li>}
      </ul>
    </div>
  );
}

const OUTCOME: Record<string, { label: string; cls: string }> = {
  CONFIRMED: { label: "Confirmó", cls: "bg-blue-100 text-blue-900" },
  ATTENDED: { label: "Asistió", cls: "bg-green-100 text-green-900" },
  NO_SHOW: { label: "No asistió", cls: "bg-amber-100 text-amber-900" },
  CANCELLED: { label: "Canceló", cls: "bg-red-100 text-red-900" },
  SCHEDULED: { label: "Sin respuesta", cls: "bg-slate-200 text-slate-900" },
};

// Historial: a quién se le envió recordatorio la última semana y qué pasó (confirmó, canceló, asistió).
async function PastReminders({ clinicId, branchId, now }: { clinicId: string; branchId: string; now: Date }) {
  const rows = await db.appointment.findMany({
    where: { clinicId, branchId, startsAt: { gte: new Date(now.getTime() - 7 * 86_400_000), lte: now }, reminders: { some: {} } },
    include: { patient: { select: { firstName: true, lastName: true, phone: true } }, reminders: { orderBy: { createdAt: "desc" }, take: 1 } },
    orderBy: { startsAt: "desc" },
  });
  const fmt = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
  const count = (st: string) => rows.filter((r) => r.status === st).length;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Recordatorios · últimos 7 días</h1>
        <Link href="/recordatorios" className="btn-secondary">Próximas 72 horas</Link>
      </div>
      {rows.length > 0 && <p className="muted">{rows.length} recordatorios · {count("ATTENDED")} asistieron · {count("CANCELLED")} cancelaron · {count("NO_SHOW")} no asistieron</p>}
      <ul className="space-y-2">
        {rows.map((a) => {
          const o = OUTCOME[a.status] ?? OUTCOME.SCHEDULED;
          return (
            <li key={a.id} className="card flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold first-letter:uppercase text-slate-700">{fmt.format(a.startsAt)}</p>
                <p className="font-semibold text-slate-900"><Link href={`/pacientes/${a.patientId}`} className="hover:underline">{a.patient.firstName} {a.patient.lastName}</Link></p>
                <p className="muted">Recordatorio {a.reminders[0]?.status === "FAILED" ? "fallido" : "enviado"} el {fmt.format(a.reminders[0].createdAt)}{a.status === "CANCELLED" && a.cancelledBy ? ` · canceló ${a.cancelledBy === "CLINIC" ? "el consultorio" : "el paciente"}${a.cancelReason ? `: ${a.cancelReason}` : ""}` : ""}</p>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${o.cls}`}>{o.label}</span>
            </li>
          );
        })}
        {rows.length === 0 && <li className="card text-center text-slate-700">No se enviaron recordatorios para citas de los últimos 7 días</li>}
      </ul>
    </div>
  );
}
