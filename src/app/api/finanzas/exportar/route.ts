import { db } from "@/lib/db";
import { currentUser } from "@/lib/dal";
import { csv, csvResponse, stamp } from "@/lib/csv";
import { METHODS } from "@/lib/cartera";
import { dateOnly, dateStr, dayStart, isPeriodStr, monthRange, todayStr } from "@/lib/finanzas";
import { contractLabel, noveltyLabel } from "@/lib/empleados";

// Paquete del mes para el contador: ingresos (recibos), liquidaciones de profesionales y pagos a empleados.
// Los gastos y sus pagos se descargan en /api/gastos/exportar.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return new Response("No autorizado", { status: 401 });
  const url = new URL(req.url);
  const mes = url.searchParams.get("mes");
  const month = isPeriodStr(mes) ? mes : todayStr().slice(0, 7);
  const { from, to } = monthRange(month);
  const range = { gte: dayStart(from), lt: dayStart(to) };
  const kind = url.searchParams.get("tipo");
  let body: string;

  if (kind === "ingresos") {
    const rows = await db.payment.findMany({
      where: { clinicId: user.clinicId, receivedAt: range },
      orderBy: { number: "asc" },
      select: { number: true, receivedAt: true, amount: true, method: true, reference: true, voidedAt: true, voidReason: true, patient: { select: { firstName: true, lastName: true, documentType: true, documentNumber: true } }, session: { select: { branch: { select: { name: true } } } }, receivedBy: { select: { name: true } } },
    });
    body = csv([
      ["Recibo", "Fecha", "Sede", "Paciente", "Documento", "Valor", "Medio de pago", "Referencia", "Recibió", "Estado"],
      ...rows.map((p) => [p.number, stamp(p.receivedAt), p.session.branch.name, `${p.patient.firstName} ${p.patient.lastName}`, `${p.patient.documentType} ${p.patient.documentNumber}`, p.voidedAt ? 0 : p.amount, METHODS[p.method], p.reference, p.receivedBy.name, p.voidedAt ? `Anulado: ${p.voidReason ?? ""}` : "Vigente"]),
    ]);
  } else if (kind === "liquidaciones") {
    const rows = await db.proSettlement.findMany({ where: { clinicId: user.clinicId, createdAt: range }, orderBy: { number: "asc" }, include: { user: { select: { name: true } } } });
    body = csv([
      ["Liquidación", "Fecha", "Profesional", "Porcentaje", "Descuenta laboratorio", "Total", "Retención sugerida", "Pagado al profesional", "Estado"],
      ...rows.map((s) => [s.number, stamp(s.createdAt), s.user.name, `${s.percent} %`, s.deductLab ? "Sí" : "No", s.total, s.retention, s.total - s.retention, s.voidedAt ? `Anulada: ${s.voidReason ?? ""}` : "Vigente"]),
    ]);
  } else if (kind === "nomina") {
    const [employees, lines, novelties] = await Promise.all([
      db.employee.findMany({ where: { clinicId: user.clinicId, OR: [{ active: true }, { endDate: { gte: dateOnly(from) } }] }, orderBy: { name: "asc" } }),
      db.payRunLine.findMany({ where: { payRun: { clinicId: user.clinicId, createdAt: range, voidedAt: null } }, include: { payRun: { select: { label: true, createdAt: true } }, employee: { select: { name: true, document: true } } } }),
      db.payrollNovelty.findMany({ where: { clinicId: user.clinicId, voidedAt: null, date: { gte: dateOnly(from), lt: dateOnly(to) } }, include: { employee: { select: { name: true } } }, orderBy: { date: "asc" } }),
    ]);
    body = csv([
      ["EMPLEADOS"],
      ["Nombre", "Cédula", "Cargo", "Contrato", "Salario", "Pago", "Ingreso", "Retiro", "EPS", "Pensión", "Cesantías", "ARL"],
      ...employees.map((e) => [e.name, e.document, e.position, contractLabel(e.contractType), e.salary, e.payEvery === "MENSUAL" ? "Mensual" : "Quincenal", dateStr(e.startDate), e.endDate ? dateStr(e.endDate) : "", e.eps, e.pension, e.cesantias, e.arl]),
      [],
      ["NOVEDADES DEL MES"],
      ["Fecha", "Empleado", "Novedad", "Valor", "Detalle"],
      ...novelties.map((n) => [dateStr(n.date), n.employee.name, noveltyLabel(n.kind), n.amount, n.note]),
      [],
      ["PAGOS DEL MES"],
      ["Fecha", "Periodo", "Empleado", "Cédula", "Básico", "Auxilio de transporte", "Suma", "Resta (incluye aportes sugeridos)", "Pagado"],
      ...lines.map((l) => [stamp(l.payRun.createdAt), l.payRun.label, l.employee.name, l.employee.document, l.base, l.transport, l.additions, l.deductions, l.total]),
    ]);
  } else {
    return new Response("Tipo inválido", { status: 400 });
  }
  await db.auditLog.create({ data: { userId: user.id, action: "EXPORT", entity: "Finance", detail: `${kind} ${month}` } });
  return csvResponse(body, `${kind}-${month}.csv`);
}
