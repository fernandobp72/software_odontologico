import { db } from "@/lib/db";
import { METHODS, copFmt } from "@/lib/cartera";
import ClinicLogo from "../clinic-logo";

const include = {
  patient: true,
  receivedBy: { select: { name: true } },
  clinic: true,
  session: { select: { branch: { select: { name: true, address: true, phone: true } } } },
} as const;

export const loadReceipt = (where: { id: string; clinicId: string } | { shareTokenHash: string; shareExpiresAt: { gt: Date } }) =>
  db.payment.findFirst({ where, include });

export type Receipt = NonNullable<Awaited<ReturnType<typeof loadReceipt>>>;

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });

// El recibo tal como se imprime y se comparte: el mismo diseño en la pantalla del consultorio y en el enlace público.
export default function ReceiptView({ p, maskDocument = false }: { p: Receipt; maskDocument?: boolean }) {
  const doc = maskDocument ? `••••${p.patient.documentNumber.slice(-4)}` : p.patient.documentNumber;
  return (
    <>
      <header className="border-b border-slate-400 pb-3 text-center">
        <div className="mb-2 flex justify-center"><ClinicLogo clinicId={p.clinic.id} version={p.clinic.logoUpdatedAt} className="h-16 w-auto max-w-48" /></div>
        <h1 className="text-xl font-bold">{p.clinic.name}</h1>
        {p.clinic.nit && <p className="text-sm">NIT {p.clinic.nit}</p>}
        {(p.session.branch.address ?? p.clinic.address) && <p className="text-sm">{p.session.branch.address ?? p.clinic.address}</p>}
        {(p.session.branch.phone ?? p.clinic.phone) && <p className="text-sm">Tel. {p.session.branch.phone ?? p.clinic.phone}</p>}
        {p.session.branch.name !== "Sede principal" && <p className="text-sm font-semibold">Sede {p.session.branch.name}</p>}
        <p className="mt-2 text-lg font-semibold">Recibo de caja N.º {p.number}</p>
        {p.voidedAt && <p className="mt-1 text-lg font-bold text-red-700">ANULADO</p>}
      </header>
      <dl className="space-y-2 py-4 text-sm">
        <div className="flex justify-between"><dt>Fecha</dt><dd className="font-semibold">{fmt.format(p.receivedAt)}</dd></div>
        <div className="flex justify-between"><dt>Paciente</dt><dd className="font-semibold">{p.patient.firstName} {p.patient.lastName}</dd></div>
        <div className="flex justify-between"><dt>Documento</dt><dd className="font-semibold">{p.patient.documentType} {doc}</dd></div>
        <div className="flex justify-between"><dt>Medio de pago</dt><dd className="font-semibold">{METHODS[p.method]}</dd></div>
        {p.reference && <div className="flex justify-between"><dt>Referencia</dt><dd className="font-semibold">{p.reference}</dd></div>}
        {p.note && <div className="flex justify-between"><dt>Nota</dt><dd className="font-semibold">{p.note}</dd></div>}
        <div className="flex justify-between border-t border-slate-400 pt-3 text-lg"><dt className="font-bold">Valor recibido</dt><dd className="font-bold">{copFmt.format(p.amount)}</dd></div>
      </dl>
      <p className="text-center text-sm">Recibido por {p.receivedBy.name}</p>
      <p className="mt-4 text-center text-xs text-slate-700">Este documento es un recibo de caja y no reemplaza la factura electrónica de venta.</p>
    </>
  );
}
