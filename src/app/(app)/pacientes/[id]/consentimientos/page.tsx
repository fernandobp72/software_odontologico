import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import ConsentForm from "./form";
import PendingRequests from "./pending";

import SealMark from "@/app/seal-mark";

export default async function ConsentimientosPage({ params }: PageProps<"/pacientes/[id]/consentimientos">) {
  const user = await requireUser();
  const { id } = await params;
  const patient = await db.patient.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!patient) return null;
  const consents = await db.consent.findMany({ where: { patientId: id }, orderBy: { signedAt: "desc" }, include: { dentist: { select: { name: true } } } });
  const pending = await db.consentRequest.findMany({ where: { patientId: id, consentId: null, cancelledAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });

  return (
    <div className="space-y-6">
      {user.role !== "RECEPTION" && (
        <ConsentForm patientId={id} patientName={`${patient.firstName} ${patient.lastName}`} patientDocument={`${patient.documentType} ${patient.documentNumber}`} />
      )}
      {user.role !== "RECEPTION" && pending.length > 0 && (
        <PendingRequests rows={pending.map((r) => ({ id: r.id, title: r.title, method: r.method, signerName: r.signerName, expires: fmt.format(r.expiresAt) }))} />
      )}
      <section className="space-y-3">
        <h2 className="section-title">Consentimientos firmados</h2>
        {consents.map((c) => (
          <details key={c.id} className="card">
            <summary className="cursor-pointer">
              <span className="font-semibold text-slate-900">{c.title}</span>
              <span className="muted block">{fmt.format(c.signedAt)} · firma de {c.signerName} ({c.signerRelation}){c.signMethod ? " · desde su celular" : ""} · <SealMark seal={c.seal} /></span>
            </summary>
            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              <p className="whitespace-pre-wrap text-slate-900">{c.body}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.signature} alt={`Firma de ${c.signerName}`} className="h-28 rounded border border-slate-300 bg-white" />
              <p className="muted">
                {c.signerName}{c.signerDocument ? ` · ${c.signerDocument}` : ""}{c.witnessName ? ` · Testigo: ${c.witnessName}` : ""} · Profesional: {c.dentist.name} · Versión de plantilla {c.templateVersion}
              </p>
              {c.signMethod && (
                <p className="muted">
                  Firmado por el paciente en su celular ({c.signMethod === "QR" ? "QR en el consultorio" : "enlace a distancia"}) · red {c.signIp ?? "no disponible"} · {c.signAgent ? c.signAgent.slice(0, 90) : "aparato no disponible"}
                </p>
              )}
            </div>
          </details>
        ))}
        {consents.length === 0 && <p className="card text-center text-slate-700">Sin consentimientos firmados</p>}
      </section>
    </div>
  );
}
