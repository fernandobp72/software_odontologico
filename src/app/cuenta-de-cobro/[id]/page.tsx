import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import PrintButton from "../../recibo/[id]/print-button";

export default async function CuentaDeCobroPage({ params }: PageProps<"/cuenta-de-cobro/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const inv = await db.invoice.findFirst({ where: { id, clinicId: user.clinicId }, include: { clinic: true, lines: true, createdBy: { select: { name: true } } } });
  if (!inv) notFound();
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });

  return (
    <main className="mx-auto max-w-2xl bg-white p-6 text-slate-900 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-400 pb-4">
        <div>
          <h1 className="text-xl font-bold">{inv.clinic.name}</h1>
          {inv.clinic.nit && <p className="text-sm">NIT {inv.clinic.nit}</p>}
          {inv.clinic.address && <p className="text-sm">{inv.clinic.address}</p>}
          {inv.clinic.phone && <p className="text-sm">Tel. {inv.clinic.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">Cuenta de cobro N.º {inv.number}</p>
          <p className="text-sm">{fmt.format(inv.issuedAt)}</p>
          {inv.voidedAt && <p className="text-lg font-bold text-red-700">ANULADA</p>}
        </div>
      </header>
      <section className="py-4 text-sm">
        <p><span className="font-semibold">Cliente:</span> {inv.customerName}{inv.customerDocument ? ` · ${inv.customerDocument}` : ""}</p>
      </section>
      <table className="w-full text-sm">
        <thead><tr className="border-y border-slate-400 text-left"><th className="py-2">Descripción</th><th className="py-2 text-right">Cant.</th><th className="py-2 text-right">Valor unitario</th><th className="py-2 text-right">Valor</th></tr></thead>
        <tbody>
          {inv.lines.map((l) => (
            <tr key={l.id} className="border-b border-slate-200">
              <td className="py-2">{l.description}{l.tooth ? ` · diente ${l.tooth}` : ""}{l.procedureCode ? ` · CUPS ${l.procedureCode}` : ""}</td>
              <td className="py-2 text-right">{l.quantity}</td>
              <td className="py-2 text-right">{copFmt.format(l.unitPrice)}</td>
              <td className="py-2 text-right">{copFmt.format(l.unitPrice * l.quantity)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot><tr><td colSpan={3} className="pt-3 text-right text-base font-bold">Total</td><td className="pt-3 text-right text-base font-bold">{copFmt.format(inv.total)}</td></tr></tfoot>
      </table>
      {inv.note && <p className="mt-4 text-sm">{inv.note}</p>}
      {inv.voidReason && <p className="mt-2 text-sm text-red-700">Motivo de anulación: {inv.voidReason}</p>}
      <p className="mt-6 text-xs text-slate-700">Elaborada por {inv.createdBy.name}. Documento interno de cobro: no es factura electrónica de venta ni sustituye los documentos exigidos por la DIAN.</p>
      <div className="mt-6 text-center print:hidden"><PrintButton /></div>
    </main>
  );
}
