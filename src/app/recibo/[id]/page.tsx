import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { METHODS, copFmt } from "@/lib/cartera";
import PrintButton from "./print-button";

export default async function ReciboPage({ params }: PageProps<"/recibo/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const p = await db.payment.findFirst({
    where: { id, clinicId: user.clinicId },
    include: { patient: true, receivedBy: { select: { name: true } }, clinic: true },
  });
  if (!p) notFound();
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });

  return (
    <main className="mx-auto max-w-md bg-white p-6 text-slate-900 print:p-0">
      <header className="border-b border-slate-400 pb-3 text-center">
        <h1 className="text-xl font-bold">{p.clinic.name}</h1>
        {p.clinic.nit && <p className="text-sm">NIT {p.clinic.nit}</p>}
        <p className="mt-2 text-lg font-semibold">Recibo de caja N.º {p.number}</p>
        {p.voidedAt && <p className="mt-1 text-lg font-bold text-red-700">ANULADO</p>}
      </header>
      <dl className="space-y-2 py-4 text-sm">
        <div className="flex justify-between"><dt>Fecha</dt><dd className="font-semibold">{fmt.format(p.receivedAt)}</dd></div>
        <div className="flex justify-between"><dt>Paciente</dt><dd className="font-semibold">{p.patient.firstName} {p.patient.lastName}</dd></div>
        <div className="flex justify-between"><dt>Documento</dt><dd className="font-semibold">{p.patient.documentType} {p.patient.documentNumber}</dd></div>
        <div className="flex justify-between"><dt>Medio de pago</dt><dd className="font-semibold">{METHODS[p.method]}</dd></div>
        {p.reference && <div className="flex justify-between"><dt>Referencia</dt><dd className="font-semibold">{p.reference}</dd></div>}
        {p.note && <div className="flex justify-between"><dt>Nota</dt><dd className="font-semibold">{p.note}</dd></div>}
        <div className="flex justify-between border-t border-slate-400 pt-3 text-lg"><dt className="font-bold">Valor recibido</dt><dd className="font-bold">{copFmt.format(p.amount)}</dd></div>
      </dl>
      <p className="text-center text-sm">Recibido por {p.receivedBy.name}</p>
      <p className="mt-4 text-center text-xs text-slate-700">Este documento es un recibo de caja y no reemplaza la factura electrónica de venta.</p>
      <div className="mt-6 text-center print:hidden"><PrintButton /></div>
    </main>
  );
}
