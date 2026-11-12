import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { PHASES } from "@/lib/catalogs";
import { docText } from "@/lib/patient-fields";
import PrintButton from "../../recibo/[id]/print-button";
import ClinicLogo from "../../clinic-logo";

// Presupuesto del plan de tratamiento para entregar al paciente: procedimientos por fase, valores y firma de aceptación.
// Solo procedimientos vigentes (los cancelados no se cobran).
export default async function PresupuestoPage({ params }: PageProps<"/presupuesto/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const plan = await db.treatmentPlan.findFirst({
    where: { id, patient: { clinicId: user.clinicId } },
    include: { patient: { include: { clinic: true } }, dentist: { select: { name: true, licenseNumber: true } }, items: { where: { status: { not: "CANCELLED" } }, orderBy: [{ phase: "asc" }, { createdAt: "asc" }] } },
  });
  if (!plan) notFound();
  const p = plan.patient;
  const c = p.clinic;
  const fmtDay = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });
  const cop = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
  const total = plan.items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const done = plan.items.filter((i) => i.status === "DONE").reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const phases = PHASES.map((ph) => ({ ...ph, items: plan.items.filter((i) => i.phase === ph.n) })).filter((ph) => ph.items.length);

  return (
    <main className="mx-auto max-w-2xl bg-white p-6 text-slate-900 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-400 pb-3">
        <div>
          <ClinicLogo clinicId={c.id} version={c.logoUpdatedAt} className="mb-2 h-14 w-auto max-w-44" />
          <h1 className="text-xl font-bold">{c.name}</h1>
          {c.nit && <p className="text-sm">NIT {c.nit}</p>}
          {c.address && <p className="text-sm">{c.address}</p>}
          {c.phone && <p className="text-sm">Tel. {c.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">Presupuesto de tratamiento</p>
          <p className="text-sm">{fmtDay.format(new Date())}</p>
        </div>
      </header>

      <section className="grid gap-x-6 gap-y-1 border-b border-slate-400 py-3 text-sm sm:grid-cols-2">
        <p><span className="font-semibold">Paciente:</span> {p.firstName} {p.lastName}</p>
        <p><span className="font-semibold">Documento:</span> {docText(p.documentType, p.documentNumber)}</p>
        <p><span className="font-semibold">Plan:</span> {plan.title}</p>
        <p><span className="font-semibold">Profesional:</span> {plan.dentist.name}</p>
      </section>

      {phases.map((ph) => (
        <section key={ph.n} className="break-inside-avoid border-b border-slate-300 py-3">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-teal-900">Fase {ph.n}: {ph.label}</h2>
          <table className="w-full table-fixed text-sm">
            <thead><tr className="text-left text-xs text-slate-700"><th className="py-1 font-semibold">Procedimiento</th><th className="w-16 py-1 text-right font-semibold">Cant.</th><th className="w-32 py-1 text-right font-semibold">Valor</th></tr></thead>
            <tbody>
              {ph.items.map((i) => (
                <tr key={i.id} className="border-t border-slate-200 align-top">
                  <td className="py-1 pr-2">{i.name}{i.tooth ? ` · diente ${i.tooth}` : ""}{i.surfaces ? ` (${i.surfaces})` : ""}{i.material ? ` · ${i.material}` : ""}{i.status === "DONE" ? " · realizado" : ""}</td>
                  <td className="py-1 text-right">{i.quantity}</td>
                  <td className="py-1 text-right whitespace-nowrap">{cop.format(i.unitPrice * i.quantity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      {phases.length === 0 && <p className="py-4 text-sm">El plan no tiene procedimientos.</p>}

      <section className="space-y-1 py-3 text-right text-sm">
        <p className="text-lg font-bold">Total: {cop.format(total)}</p>
        {done > 0 && <p>Ya realizado: {cop.format(done)} · Pendiente: {cop.format(total - done)}</p>}
      </section>

      <footer className="mt-6 space-y-6 border-t border-slate-400 pt-3 text-sm">
        <p className="text-xs text-slate-700">Valores en pesos colombianos. El plan puede ajustarse si durante el tratamiento cambian los hallazgos clínicos; cualquier cambio se informará antes de realizarlo.</p>
        <div className="grid gap-8 sm:grid-cols-2">
          <div className="border-t border-slate-900 pt-1">
            <p className="font-semibold">{plan.dentist.name}</p>
            <p>Odontólogo(a){plan.dentist.licenseNumber ? ` · RP ${plan.dentist.licenseNumber}` : ""}</p>
          </div>
          <div className="border-t border-slate-900 pt-1">
            <p className="font-semibold">Acepto el plan y su valor</p>
            <p>{p.firstName} {p.lastName}</p>
          </div>
        </div>
      </footer>
      <div className="mt-6 text-center print:hidden"><PrintButton /></div>
    </main>
  );
}
