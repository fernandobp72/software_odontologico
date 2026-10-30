import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import ConsentForm from "./form";

export default async function ConsentimientosPage({ params }: PageProps<"/pacientes/[id]/consentimientos">) {
  const user = await requireUser();
  const { id } = await params;
  const patient = await db.patient.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!patient) return null;
  const consents = await db.consent.findMany({ where: { patientId: id }, orderBy: { signedAt: "desc" }, include: { dentist: { select: { name: true } } } });
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });

  return (
    <div className="space-y-6">
      {user.role !== "RECEPTION" && (
        <ConsentForm patientId={id} patientName={`${patient.firstName} ${patient.lastName}`} patientDocument={`${patient.documentType} ${patient.documentNumber}`} />
      )}
      <section className="space-y-3">
        <h2 className="section-title">Consentimientos firmados</h2>
        {consents.map((c) => (
          <details key={c.id} className="card">
            <summary className="cursor-pointer">
              <span className="font-semibold text-slate-900">{c.title}</span>
              <span className="muted block">{fmt.format(c.signedAt)} · firma de {c.signerName} ({c.signerRelation})</span>
            </summary>
            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              <p className="whitespace-pre-wrap text-slate-900">{c.body}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.signature} alt={`Firma de ${c.signerName}`} className="h-28 rounded border border-slate-300 bg-white" />
              <p className="muted">
                {c.signerName}{c.signerDocument ? ` · ${c.signerDocument}` : ""}{c.witnessName ? ` · Testigo: ${c.witnessName}` : ""} · Profesional: {c.dentist.name} · Versión de plantilla {c.templateVersion}
              </p>
            </div>
          </details>
        ))}
        {consents.length === 0 && <p className="card text-center text-slate-700">Sin consentimientos firmados</p>}
      </section>
    </div>
  );
}
