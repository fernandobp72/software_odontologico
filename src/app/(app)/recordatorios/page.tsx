import Link from "next/link";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { cloudConfigured, normalizePhone, reminderParams, reminderText } from "@/lib/whatsapp";
import SendButton from "./send-button";

const placeName = (clinic: string, branch: string) => (branch === "Sede principal" ? clinic : `${clinic} - ${branch}`);

export default async function RecordatoriosPage() {
  const { user, branch } = await requireBranch();
  const now = new Date();
  const appointments = await db.appointment.findMany({
    where: { clinicId: user.clinicId, branchId: branch.id, status: { in: ["SCHEDULED", "CONFIRMED"] }, startsAt: { gt: now, lte: new Date(now.getTime() + 72 * 3_600_000) } },
    include: { patient: true, clinic: true, branch: true, reminders: { orderBy: { createdAt: "desc" } } },
    orderBy: { startsAt: "asc" },
  });
  const fmt = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" });
  const auto = cloudConfigured();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Recordatorios</h1>
        <Link href="/agenda" className="btn-secondary">Volver a la agenda</Link>
      </div>
      <p className="rounded-lg border border-slate-300 bg-white p-3 text-sm text-slate-900">
        {auto
          ? "Envío automático activo: los recordatorios salen por la API de WhatsApp. Aquí puedes ver el estado y reenviar a mano si hace falta."
          : "Modo manual: pulsa «Enviar por WhatsApp» y se abre el chat con el mensaje listo; solo falta enviarlo. Para envío automático hay que configurar la API de WhatsApp (ver DEPLOY.md)."}
        {" "}El mensaje no incluye datos de salud y trae un enlace para confirmar o cancelar.
      </p>
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
