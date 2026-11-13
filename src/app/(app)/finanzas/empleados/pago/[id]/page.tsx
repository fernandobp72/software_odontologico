import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { noveltyLabel } from "@/lib/empleados";
import PrintButton from "@/app/recibo/[id]/print-button";
import { VoidPayRun } from "../../forms";

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });
type Detail = { contributions?: number; novelties?: { kind: string; amount: number; note: string | null }[] };

// Comprobantes de un pago a empleados: uno por persona, para imprimir y firmar.
export default async function PagoEmpleadosPage({ params }: PageProps<"/finanzas/empleados/pago/[id]">) {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/finanzas/gastos");
  const { id } = await params;
  const run = await db.payRun.findFirst({ where: { id, clinicId: user.clinicId }, include: { lines: { include: { employee: { select: { name: true, document: true, position: true } } } } } });
  if (!run) notFound();
  const clinic = await db.clinic.findUnique({ where: { id: user.clinicId }, select: { name: true, nit: true } });

  return (
    <main className="mx-auto max-w-2xl space-y-6 bg-white p-2 text-slate-900 print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/finanzas/empleados" className="text-sm font-semibold text-teal-800 underline">← Empleados</Link>
        <PrintButton label="Imprimir comprobantes" />
      </div>
      {run.voidedAt && <p className="font-semibold text-red-700">Anulado: {run.voidReason}</p>}
      {run.lines.map((l) => {
        const d = (l.detail ?? {}) as Detail;
        return (
          <article key={l.id} className="space-y-2 border-b border-dashed border-slate-400 pb-6 break-inside-avoid">
            <p className="text-sm font-semibold">{clinic?.name}{clinic?.nit ? ` · NIT ${clinic.nit}` : ""}</p>
            <h1 className="text-lg font-bold">Comprobante de pago · {run.label}</h1>
            <p>{l.employee.name}{l.employee.document ? ` · C.C. ${l.employee.document}` : ""} · {l.employee.position}</p>
            <table className="w-full text-sm">
              <tbody>
                <tr><td>Básico</td><td className="text-right">{copFmt.format(l.base)}</td></tr>
                {l.transport > 0 && <tr><td>Auxilio de transporte</td><td className="text-right">{copFmt.format(l.transport)}</td></tr>}
                {d.novelties?.map((n, i) => n.amount !== 0 && <tr key={i}><td>{noveltyLabel(n.kind)}{n.note ? ` (${n.note})` : ""}</td><td className="text-right">{n.amount > 0 ? "+" : "−"}{copFmt.format(Math.abs(n.amount))}</td></tr>)}
                {(d.contributions ?? 0) > 0 && <tr><td>Aportes del empleado a salud y pensión</td><td className="text-right">−{copFmt.format(d.contributions!)}</td></tr>}
                {l.total !== l.base + l.transport + l.additions - l.deductions && <tr><td>Ajuste</td><td className="text-right">{copFmt.format(l.total - (l.base + l.transport + l.additions - l.deductions))}</td></tr>}
                <tr className="border-t border-slate-400 font-bold"><td>Pagado</td><td className="text-right">{copFmt.format(l.total)}</td></tr>
              </tbody>
            </table>
            <p className="text-sm">Fecha: {fmt.format(run.createdAt)}</p>
            <p className="pt-8 text-sm">Recibí: ______________________________</p>
          </article>
        );
      })}
      <p className="text-sm font-bold">Total del pago: {copFmt.format(run.total)}</p>
      {!run.voidedAt && <div className="print:hidden"><VoidPayRun id={run.id} /></div>}
    </main>
  );
}
