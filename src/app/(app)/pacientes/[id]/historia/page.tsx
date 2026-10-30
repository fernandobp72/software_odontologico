import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copTotal, type AssessmentData } from "@/lib/assessment";
import { mergeIntake } from "@/lib/intake";
import { normalizePhone } from "@/lib/whatsapp";
import AssessmentForm from "./form";
import IntakePanel, { type IntakeInfo } from "./intake-panel";

export default async function HistoriaPage({ params, searchParams }: PageProps<"/pacientes/[id]/historia">) {
  const user = await requireUser();
  const { id } = await params;
  const { intake: intakeParam } = await searchParams;
  if (user.role === "RECEPTION") return <p className="card">Sin acceso a la historia clínica.</p>;
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
  const versions = await db.assessment.findMany({
    where: { patientId: id, patient: { clinicId: user.clinicId } },
    orderBy: { createdAt: "desc" },
    include: { author: { select: { name: true } } },
    take: 20,
  });
  const latest = versions[0];
  const [patient, form] = await Promise.all([
    db.patient.findFirst({ where: { id, clinicId: user.clinicId }, select: { firstName: true, phone: true, clinic: { select: { name: true } } } }),
    db.intakeForm.findFirst({ where: { patientId: id, clinicId: user.clinicId, revokedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);
  const submitted = form?.submittedAt ? form : null;
  const loadId = typeof intakeParam === "string" && submitted && !submitted.reviewedAt && submitted.id === intakeParam ? submitted.id : undefined;
  const current = (latest?.data ?? null) as AssessmentData | null;
  const data = loadId ? mergeIntake(current, submitted!.data as AssessmentData) : current;
  const info: IntakeInfo = submitted
    ? { kind: "submitted", id: submitted.id, at: fmt.format(submitted.submittedAt!), signer: submitted.signerName ?? "el paciente", reviewed: !!submitted.reviewedAt }
    : form && form.expiresAt > new Date()
      ? { kind: "pending", expires: fmt.format(form.expiresAt) }
      : { kind: "none" };
  const cop = copTotal(data);

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-900">
          {latest ? <>Versión vigente: <strong>{fmt.format(latest.createdAt)}</strong> · {latest.author.name}</> : "Aún no hay valoración registrada."}
        </p>
        {cop !== null && cop > 0 && <p className="text-sm font-semibold text-slate-900">COP-D total: {cop}</p>}
      </div>
      {patient && <IntakePanel patientId={id} firstName={patient.firstName} clinic={patient.clinic.name} phone={normalizePhone(patient.phone)} info={info} />}
      {loadId && <p className="card border-teal-700 bg-teal-50 text-sm text-slate-900">Se cargaron las respuestas del paciente en la valoración. Revísalas, corrige lo que haga falta y guarda para incorporarlas a la historia.</p>}
      <AssessmentForm key={loadId ?? latest?.id ?? "nuevo"} patientId={id} initial={data} intakeId={loadId} />
      {versions.length > 1 && (
        <details className="card">
          <summary className="cursor-pointer font-semibold text-slate-900">Versiones anteriores ({versions.length - 1})</summary>
          <ul className="mt-3 divide-y divide-slate-200">
            {versions.slice(1).map((v) => (
              <li key={v.id} className="py-2 text-sm text-slate-800">{fmt.format(v.createdAt)} · {v.author.name}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
