import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { fmtDate } from "@/lib/finanzas";
import { normalizePhone } from "@/lib/whatsapp";
import PrintButton from "@/app/recibo/[id]/print-button";
import { VoidSettlement } from "../../forms";

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });

// Comprobante de liquidación: lo ve el administrador y el profesional al que corresponde.
export default async function LiquidacionPage({ params }: PageProps<"/finanzas/profesionales/liquidacion/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const s = await db.proSettlement.findFirst({
    where: { id, clinicId: user.clinicId, ...(user.role === "ADMIN" ? {} : { userId: user.id }) },
    include: { lines: { orderBy: [{ doneAt: "asc" }] }, user: { select: { name: true, phone: true } } },
  });
  if (!s) notFound();
  const [clinic, expense] = await Promise.all([
    db.clinic.findUnique({ where: { id: user.clinicId }, select: { name: true, nit: true } }),
    s.expenseId ? db.expense.findUnique({ where: { id: s.expenseId }, select: { id: true, settledAt: true, dueDate: true } }) : null,
  ]);
  const net = s.total - s.retention;
  const phone = normalizePhone(s.user.phone);
  const msg = `Hola ${s.user.name}. Te comparto la liquidación ${s.number} de ${clinic?.name ?? ""}: ${copFmt.format(net)}${expense?.settledAt ? ", ya pagada" : expense?.dueDate ? `, se paga a más tardar el ${fmtDate(expense.dueDate)}` : ""}.`;

  return (
    <main className="mx-auto max-w-2xl space-y-5 bg-white p-2 text-slate-900 print:p-0">
      <Link href={user.role === "ADMIN" ? `/finanzas/profesionales/${s.userId}` : "/finanzas/mis-pagos"} className="text-sm font-semibold text-teal-800 underline print:hidden">← Volver</Link>
      <header className="space-y-1">
        <p className="text-sm font-semibold">{clinic?.name}{clinic?.nit ? ` · NIT ${clinic.nit}` : ""}</p>
        <h1 className="page-title">Liquidación {s.number}</h1>
        <p>{s.user.name} · {fmt.format(s.createdAt)}</p>
        <p className="muted">Acuerdo: {s.percent} % de lo pagado por el paciente{s.deductLab ? ", descontando el laboratorio" : ""}.</p>
        {s.voidedAt && <p className="font-semibold text-red-700">Anulada: {s.voidReason}</p>}
      </header>
      <table className="w-full text-sm">
        <thead><tr className="border-b border-slate-400 text-left"><th className="py-1">Paciente y procedimiento</th><th className="py-1 text-right">Pagado</th><th className="py-1 text-right">Lab.</th><th className="py-1 text-right">Valor</th></tr></thead>
        <tbody>
          {s.lines.map((l) => (
            <tr key={l.id} className="border-b border-slate-200 align-top">
              <td className="py-1">{l.itemId ? <><span className="font-semibold">{l.patientName}</span><br />{l.description}{l.doneAt ? ` · ${fmtDate(l.doneAt)}` : ""}</> : <><span className="font-semibold">Ajuste</span><br />{l.note}</>}{l.itemId && l.note ? <><br /><span className="text-red-700">{l.note}</span></> : null}</td>
              <td className="py-1 text-right">{l.itemId ? copFmt.format(l.collected) : ""}</td>
              <td className="py-1 text-right">{l.lab ? copFmt.format(l.lab) : ""}</td>
              <td className="py-1 text-right font-semibold">{copFmt.format(l.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt>Total</dt><dd className="font-semibold">{copFmt.format(s.total)}</dd></div>
        {s.retention > 0 && <div className="flex justify-between"><dt>Retención</dt><dd>−{copFmt.format(s.retention)}</dd></div>}
        <div className="flex justify-between border-t border-slate-400 pt-1 text-base"><dt className="font-bold">Pagado al profesional</dt><dd className="font-bold">{copFmt.format(net)}</dd></div>
        <div className="muted text-right">{expense?.settledAt ? `Pagado el ${fmt.format(expense.settledAt)}` : expense?.dueDate ? `Por pagar a más tardar el ${fmtDate(expense.dueDate)}` : ""}</div>
      </dl>
      <div className="flex flex-wrap gap-2 print:hidden">
        <PrintButton />
        {phone && user.role === "ADMIN" && <a href={`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener" className="btn-secondary">Enviar por WhatsApp</a>}
        {user.role === "ADMIN" && expense && !expense.settledAt && !s.voidedAt && <Link href={`/finanzas/gastos/${expense.id}`} className="btn-secondary">Registrar el pago</Link>}
      </div>
      {user.role === "ADMIN" && !s.voidedAt && <div className="print:hidden"><VoidSettlement id={s.id} /></div>}
    </main>
  );
}
