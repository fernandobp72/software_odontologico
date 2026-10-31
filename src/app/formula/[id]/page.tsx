import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import PrintButton from "../../recibo/[id]/print-button";
import ClinicLogo from "../../clinic-logo";

// Fórmula médica imprimible (Decreto 2200 de 2005: denominación común internacional, concentración, forma, dosis, vía,
// frecuencia, duración y cantidad en números y letras, con los datos del prescriptor).
export default async function FormulaPage({ params }: PageProps<"/formula/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (user.role === "RECEPTION") notFound();
  const r = await db.prescription.findFirst({
    where: { id, clinicId: user.clinicId },
    include: { clinic: true, patient: true, dentist: { select: { name: true, licenseNumber: true } }, items: { orderBy: { position: "asc" } } },
  });
  if (!r) notFound();
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });
  const p = r.patient;
  const age = p.birthDate ? Math.floor((r.issuedAt.getTime() - p.birthDate.getTime()) / (365.25 * 86_400_000)) : null;

  return (
    <main className="mx-auto max-w-2xl bg-white p-6 text-slate-900 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-400 pb-3">
        <div>
          <ClinicLogo clinicId={r.clinic.id} version={r.clinic.logoUpdatedAt} className="mb-2 h-14 w-auto max-w-44" />
          <h1 className="text-xl font-bold">{r.clinic.name}</h1>
          {r.clinic.nit && <p className="text-sm">NIT {r.clinic.nit}</p>}
          {r.clinic.address && <p className="text-sm">{r.clinic.address}</p>}
          {r.clinic.phone && <p className="text-sm">Tel. {r.clinic.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">Fórmula médica N.º {r.number}</p>
          <p className="text-sm">{fmt.format(r.issuedAt)}</p>
          {r.voidedAt && <p className="text-lg font-bold text-red-700">ANULADA</p>}
        </div>
      </header>

      <section className="grid gap-x-6 gap-y-1 border-b border-slate-400 py-3 text-sm sm:grid-cols-2">
        <p><span className="font-semibold">Paciente:</span> {p.firstName} {p.lastName}</p>
        <p><span className="font-semibold">Documento:</span> {p.documentType} {p.documentNumber}</p>
        <p><span className="font-semibold">Edad:</span> {age !== null ? `${age} años` : "—"}{r.weightKg ? ` · Peso ${r.weightKg} kg` : ""}</p>
        {r.diagnosisCode && <p><span className="font-semibold">Diagnóstico:</span> {r.diagnosisCode}{r.diagnosisText ? ` · ${r.diagnosisText}` : ""}</p>}
      </section>

      <ol className="space-y-4 py-4">
        {r.items.map((it, i) => (
          <li key={it.id} className="break-inside-avoid">
            <p className="font-bold">{i + 1}. {it.name} — {it.concentration}, {it.form.toLowerCase()}</p>
            <p className="text-sm"><span className="font-semibold">Dosis:</span> {it.dose} · {it.frequency} · {it.duration} · vía {it.route.toLowerCase()}</p>
            <p className="text-sm"><span className="font-semibold">Cantidad:</span> {it.quantityText}</p>
            {it.instructions && <p className="text-sm"><span className="font-semibold">Indicaciones:</span> {it.instructions}</p>}
          </li>
        ))}
      </ol>
      {r.notes && <p className="border-t border-slate-400 pt-3 text-sm"><span className="font-semibold">Observaciones:</span> {r.notes}</p>}

      <footer className="mt-10 border-t border-slate-400 pt-3 text-sm">
        <div className="mt-10 w-64 border-t border-slate-900 pt-1">
          <p className="font-semibold">{r.dentist.name}</p>
          <p>Odontólogo(a) · Registro profesional {r.dentist.licenseNumber ?? "—"}</p>
        </div>
        <p className="mt-4 text-xs text-slate-700">Fórmula generada con apoyo del vademécum {r.vademecum}; el profesional prescriptor es el responsable de su contenido.{r.voidReason ? ` Anulada: ${r.voidReason}.` : ""}</p>
      </footer>
      <div className="mt-6 text-center print:hidden"><PrintButton /></div>
    </main>
  );
}
