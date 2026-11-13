import { db } from "@/lib/db";
import { currentUser } from "@/lib/dal";
import { categoryLabel, dateOnly, dateStr, dayStart, docLabel, isPeriodStr, monthRange, paidOf, sourceLabel, todayStr } from "@/lib/finanzas";
import { csv, stamp } from "@/lib/csv";

// Archivo para el contador. tipo=gastos (por defecto): los gastos del mes con su saldo. tipo=pagos: la plata que salió en el mes.
export async function GET(req: Request) {
  const user = await currentUser();
  if (!user || user.role !== "ADMIN") return new Response("No autorizado", { status: 401 });
  const url = new URL(req.url);
  const mes = url.searchParams.get("mes");
  const month = isPeriodStr(mes) ? mes : todayStr().slice(0, 7);
  const { from, to } = monthRange(month);
  const kind = url.searchParams.get("tipo") === "pagos" ? "pagos" : "gastos";
  const branches = new Map((await db.branch.findMany({ where: { clinicId: user.clinicId }, select: { id: true, name: true } })).map((b) => [b.id, b.name]));

  let body: string;
  if (kind === "gastos") {
    const rows = await db.expense.findMany({
      where: { clinicId: user.clinicId, expenseDate: { gte: dateOnly(from), lt: dateOnly(to) } },
      orderBy: { number: "asc" },
      select: { number: true, expenseDate: true, branchId: true, category: true, description: true, docKind: true, docNumber: true, amount: true, dueDate: true, mimeType: true, voidedAt: true, voidReason: true, payee: { select: { name: true, document: true } }, createdBy: { select: { name: true } }, payments: { select: { amount: true, voidedAt: true } } },
    });
    body = csv([
      ["Número", "Fecha", "Sede", "A quién", "NIT o cédula", "Categoría", "Detalle", "Tipo de soporte", "Número de soporte", "Valor", "Pagado", "Saldo", "Fecha límite", "Soporte adjunto", "Registró", "Estado"],
      ...rows.map((e) => {
        const paid = e.voidedAt ? 0 : paidOf(e.payments);
        return [e.number, dateStr(e.expenseDate), branches.get(e.branchId) ?? "", e.payee.name, e.payee.document, categoryLabel(e.category), e.description, docLabel(e.docKind), e.docNumber, e.amount, paid, e.voidedAt ? 0 : e.amount - paid, e.dueDate ? dateStr(e.dueDate) : "", e.mimeType ? "Sí" : "No", e.createdBy.name, e.voidedAt ? `Anulado: ${e.voidReason ?? ""}` : "Vigente"];
      }),
    ]);
  } else {
    const rows = await db.expensePayment.findMany({
      where: { clinicId: user.clinicId, voidedAt: null, paidAt: { gte: dayStart(from), lt: dayStart(to) } },
      orderBy: { paidAt: "asc" },
      select: { amount: true, source: true, reference: true, paidAt: true, expense: { select: { number: true, category: true, docKind: true, docNumber: true, branchId: true, payee: { select: { name: true, document: true } } } } },
    });
    body = csv([
      ["Fecha del pago", "Gasto", "Sede", "A quién", "NIT o cédula", "Categoría", "Tipo de soporte", "Número de soporte", "Valor pagado", "De dónde salió", "Referencia"],
      ...rows.map((p) => [stamp(p.paidAt), p.expense.number, branches.get(p.expense.branchId) ?? "", p.expense.payee.name, p.expense.payee.document, categoryLabel(p.expense.category), docLabel(p.expense.docKind), p.expense.docNumber, p.amount, sourceLabel(p.source), p.reference]),
    ]);
  }
  await db.auditLog.create({ data: { userId: user.id, action: "EXPORT", entity: "Expense", detail: `${kind} ${month}` } });
  return new Response(body, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${kind}-${month}.csv"`, "Cache-Control": "no-store" },
  });
}
