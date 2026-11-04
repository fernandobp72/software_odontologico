import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import ConsentForm from "./form";
import PendingRequests from "./pending";
import ConstanciaActions from "./constancia-actions";
import { deviceLabel } from "@/lib/device";

import SealMark from "@/app/seal-mark";

export default async function ConsentimientosPage({ params }: PageProps<"/pacientes/[id]/consentimientos">) {
  const user = await requireUser();
  const { id } = await params;
  const patient = await db.patient.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!patient) return null;
  const consents = await db.consent.findMany({ where: { patientId: id }, orderBy: { signedAt: "desc" }, include: { dentist: { select: { name: true } } } });
  // Señales de una firma dudosa (solo para firmas hechas en el celular del paciente).
  const devices = [...new Set(consents.map((c) => c.signDevice).filter((d): d is string => !!d))];
  const sharedBy = devices.length ? await db.consent.findMany({ where: { signDevice: { in: devices }, patient: { clinicId: user.clinicId } }, select: { signDevice: true, patientId: true } }) : [];
  const contactChanges = await db.auditLog.findMany({ where: { action: "PATIENT_CONTACT_CHANGE", entity: "Patient", entityId: id }, select: { createdAt: true, detail: true } });
  const alertsFor = (c: (typeof consents)[number]) => {
    if (!c.signMethod) return [] as string[];
    const out: string[] = [];
    const patientsOnDevice = new Set(sharedBy.filter((s) => s.signDevice === c.signDevice).map((s) => s.patientId));
    if (c.signDevice && patientsOnDevice.size > 1) out.push(`El mismo aparato firmó por ${patientsOnDevice.size} pacientes distintos (puede ser normal si es un familiar).`);
    if (c.signReadSec !== null && c.signReadSec < 8) out.push(`Firmó muy rápido: ${c.signReadSec} segundos desde que abrió el documento.`);
    const recent = contactChanges.find((x) => x.createdAt <= c.signedAt && c.signedAt.getTime() - x.createdAt.getTime() < 86_400_000);
    if (recent) out.push(`Se cambió el ${recent.detail ?? "contacto"} del paciente en las 24 horas anteriores a la firma.`);
    if (!c.receiptSentAt) out.push("Todavía no se le envió la constancia al paciente.");
    return out;
  };
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
              <span className="muted block">{fmt.format(c.signedAt)} · firma de {c.signerName} ({c.signerRelation}){c.signMethod ? " · desde su celular" : ""} · <SealMark seal={c.seal} />{alertsFor(c).filter((a) => !a.startsWith("Todavía")).length > 0 && <span className="font-semibold text-amber-900"> · ⚠ revisar</span>}</span>
            </summary>
            <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
              <p className="whitespace-pre-wrap text-slate-900">{c.body}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.signature} alt={`Firma de ${c.signerName}`} className="h-28 rounded border border-slate-300 bg-white" />
              <p className="muted">
                {c.signerName}{c.signerDocument ? ` · ${c.signerDocument}` : ""}{c.witnessName ? ` · Testigo: ${c.witnessName}` : ""} · Profesional: {c.dentist.name} · Versión de plantilla {c.templateVersion}
              </p>
              {c.signMethod && (
                <div className="space-y-1 rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm text-slate-900">
                  <p className="font-semibold">Cómo se firmó</p>
                  <p>Por el paciente, en su celular ({c.signMethod === "QR" ? "QR en el consultorio" : "enlace a distancia"}).</p>
                  <p>Aparato: <strong>{deviceLabel(c.signAgent)}</strong> · red {c.signIp ?? "no disponible"} · huella {c.signDevice ? c.signDevice.slice(0, 6) : "—"}{c.signReadSec !== null ? ` · tardó ${c.signReadSec} s entre abrir y firmar` : ""}</p>
                  {c.signAgent && <p className="muted break-all">{c.signAgent}</p>}
                </div>
              )}
              {alertsFor(c).length > 0 && (
                <ul role="status" className="space-y-1 rounded-lg border border-amber-500 bg-amber-50 p-3 text-sm text-amber-950">
                  {alertsFor(c).map((a) => <li key={a}>⚠ {a}</li>)}
                </ul>
              )}
              {user.role !== "RECEPTION" && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">Constancia para el paciente</p>
                  <p className="muted">{c.receiptSentAt ? `Enviada por correo a ${c.receiptSentTo} el ${fmt.format(c.receiptSentAt)}.` : "No se ha enviado."} Cada envío crea un enlace nuevo y el anterior deja de servir.</p>
                  <ConstanciaActions consentId={c.id} hasEmail={!!patient.email} hasPhone={!!patient.phone} />
                </div>
              )}
            </div>
          </details>
        ))}
        {consents.length === 0 && <p className="card text-center text-slate-700">Sin consentimientos firmados</p>}
      </section>
    </div>
  );
}
