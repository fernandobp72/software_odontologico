import { db } from "@/lib/db";
import { currentUser } from "@/lib/dal";
import { csv, csvResponse, stamp } from "@/lib/csv";
import { addDays, dateStr, dayStart, isDateStr, todayStr } from "@/lib/finanzas";

const STATUS: Record<string, string> = { SCHEDULED: "Programada", CONFIRMED: "Confirmada", ATTENDED: "Atendida", CANCELLED: "Cancelada", NO_SHOW: "No asistió" };

// Descargas en Excel para administración: pacientes (datos de contacto, sin historia clínica) y citas por fechas.
// Son datos personales (Ley 1581 de 2012): solo el administrador descarga y cada descarga queda registrada.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return new Response("No autorizado", { status: 401 });
  const url = new URL(req.url);
  const kind = url.searchParams.get("tipo");
  let body: string;
  let name: string;

  if (kind === "pacientes") {
    const rows = await db.patient.findMany({
      where: { clinicId: user.clinicId },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: { documentType: true, documentNumber: true, firstName: true, middleName: true, lastName: true, secondLastName: true, birthDate: true, sex: true, phone: true, email: true, address: true, city: true, eps: true, regime: true, createdAt: true },
    });
    body = csv([
      ["Tipo de documento", "Documento", "Nombres", "Apellidos", "Nacimiento", "Sexo", "Celular", "Correo", "Dirección", "Ciudad", "EPS", "Régimen", "Registrado"],
      ...rows.map((p) => [p.documentType, p.documentNumber, [p.firstName, p.middleName].filter(Boolean).join(" "), [p.lastName, p.secondLastName].filter(Boolean).join(" "), p.birthDate ? dateStr(p.birthDate) : "", p.sex, p.phone, p.email, p.address, p.city, p.eps, p.regime, stamp(p.createdAt)]),
    ]);
    name = `pacientes-${todayStr()}.csv`;
  } else if (kind === "citas") {
    const today = todayStr();
    const to = url.searchParams.get("hasta");
    const until = isDateStr(to) ? to : today;
    const fromQ = url.searchParams.get("desde");
    const from = isDateStr(fromQ) && fromQ <= until ? fromQ : addDays(until, -30);
    const rows = await db.appointment.findMany({
      where: { clinicId: user.clinicId, startsAt: { gte: dayStart(from), lt: dayStart(addDays(until, 1)) } },
      orderBy: { startsAt: "asc" },
      select: { startsAt: true, endsAt: true, status: true, reason: true, cancelledBy: true, cancelReason: true, branch: { select: { name: true } }, dentist: { select: { name: true } }, patient: { select: { firstName: true, lastName: true, documentType: true, documentNumber: true, phone: true } } },
    });
    body = csv([
      ["Inicio", "Fin", "Sede", "Profesional", "Paciente", "Documento", "Celular", "Motivo", "Estado", "Quién canceló", "Motivo de cancelación"],
      ...rows.map((a) => [stamp(a.startsAt), stamp(a.endsAt), a.branch.name, a.dentist.name, `${a.patient.firstName} ${a.patient.lastName}`, `${a.patient.documentType} ${a.patient.documentNumber}`, a.patient.phone, a.reason, STATUS[a.status] ?? a.status, a.cancelledBy === "CLINIC" ? "Consultorio" : a.cancelledBy === "PATIENT" ? "Paciente" : "", a.cancelReason]),
    ]);
    name = `citas-${from}-a-${until}.csv`;
  } else {
    return new Response("Tipo inválido", { status: 400 });
  }
  await db.auditLog.create({ data: { userId: user.id, action: "EXPORT", entity: kind === "pacientes" ? "Patient" : "Appointment", detail: name } });
  return csvResponse(body, name);
}
