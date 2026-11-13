import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { ASSESSMENT_SECTIONS, copTotal, type AssessmentData } from "@/lib/assessment";
import { CIE10, CONDITIONS, PHASES, type ConditionKey } from "@/lib/catalogs";
import { ageText, docText } from "@/lib/patient-fields";
import PrintButton from "../../recibo/[id]/print-button";
import ClinicLogo from "../../clinic-logo";
import SealMark from "../../seal-mark";

// Historia clínica completa imprimible: copia para el paciente (Res. 1995 de 1999, art. 14), remisiones y auditoría.
// Reúne identificación, valoración vigente, odontograma actual, diagnósticos, planes, evoluciones, consentimientos y fórmulas.
// Cada impresión queda en el registro de auditoría.
export default async function HistoriaClinicaPage({ params }: PageProps<"/historia-clinica/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  if (user.role === "RECEPTION") notFound();
  const p = await db.patient.findFirst({ where: { id, clinicId: user.clinicId }, include: { clinic: true } });
  if (!p) notFound();

  const [assessment, findings, diagnoses, plans, evolutions, consents, prescriptions] = await Promise.all([
    db.assessment.findFirst({ where: { patientId: p.id }, orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } }),
    db.toothFinding.findMany({ where: { patientId: p.id }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } }),
    db.diagnosis.findMany({ where: { patientId: p.id }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], include: { dentist: { select: { name: true } }, closedBy: { select: { name: true } } } }),
    db.treatmentPlan.findMany({ where: { patientId: p.id }, orderBy: { createdAt: "desc" }, include: { items: { orderBy: [{ phase: "asc" }, { createdAt: "asc" }] } } }),
    db.evolution.findMany({ where: { patientId: p.id }, orderBy: { signedAt: "asc" }, include: { dentist: { select: { name: true, licenseNumber: true } }, corrects: { select: { signedAt: true, dentist: { select: { name: true } } } } } }),
    db.consent.findMany({ where: { patientId: p.id }, orderBy: { signedAt: "asc" }, select: { id: true, title: true, signedAt: true, signerName: true, signerRelation: true, seal: true, dentist: { select: { name: true } } } }),
    db.prescription.findMany({ where: { patientId: p.id }, orderBy: { issuedAt: "asc" }, include: { items: { orderBy: { position: "asc" } }, dentist: { select: { name: true } } } }),
  ]);
  await db.auditLog.create({ data: { userId: user.id, action: "PRINT", entity: "Patient", entityId: p.id, detail: "historia clínica completa" } });

  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });
  const fmtDay = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "America/Bogota" });
  const data = (assessment?.data ?? null) as AssessmentData | null;
  const cop = copTotal(data);
  const latest = new Map<string, { tooth: number; surface: string | null; condition: ConditionKey; at: Date; by: string | null }>();
  for (const f of findings) latest.set(`${f.tooth}|${f.surface ?? ""}`, { tooth: f.tooth, surface: f.surface, condition: f.condition, at: f.createdAt, by: f.author?.name ?? null });
  const current = [...latest.values()].filter((f) => f.condition !== "HEALTHY").sort((a, b) => a.tooth - b.tooth);
  const value = (v: string | string[] | undefined) => (Array.isArray(v) ? v.join(", ") : v ?? "");
  const cie = (code: string) => CIE10.find((c) => c.code === code)?.label;

  const ident: [string, string | null][] = [
    ["Paciente", `${p.firstName} ${p.lastName}`],
    ["Documento", docText(p.documentType, p.documentNumber)],
    ["Nacimiento", p.birthDate ? `${new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" }).format(p.birthDate)} (${ageText(p.birthDate)})` : null],
    ["Sexo", p.sex === "F" ? "Femenino" : p.sex === "M" ? "Masculino" : p.sex === "O" ? "Otro" : null],
    ["Celular", p.phone],
    ["Dirección", [p.address, p.city].filter(Boolean).join(", ") || null],
    ["Ocupación", p.occupation],
    ["EPS", [p.eps, p.regime].filter(Boolean).join(" · ") || null],
    ["Acompañante", [p.companionName, p.companionKin ? `(${p.companionKin})` : null, p.companionPhone].filter(Boolean).join(" ") || null],
    ["Alergias", p.allergies],
  ];

  return (
    <main className="mx-auto max-w-3xl bg-white p-6 text-slate-900 print:p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-400 pb-3">
        <div>
          <ClinicLogo clinicId={p.clinic.id} version={p.clinic.logoUpdatedAt} className="mb-2 h-14 w-auto max-w-44" />
          <h1 className="text-xl font-bold">{p.clinic.name}</h1>
          {p.clinic.nit && <p className="text-sm">NIT {p.clinic.nit}</p>}
          {p.clinic.address && <p className="text-sm">{p.clinic.address}</p>}
          {p.clinic.phone && <p className="text-sm">Tel. {p.clinic.phone}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">Historia clínica odontológica</p>
          <p className="text-sm">Copia generada el {fmtDay.format(new Date())}</p>
          <p className="text-sm">por {user.name}</p>
        </div>
      </header>

      <Section title="Identificación">
        <dl className="grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
          {ident.map(([k, v]) => <div key={k}><dt className="inline font-semibold">{k}: </dt><dd className="inline">{v || "—"}</dd></div>)}
        </dl>
      </Section>

      <Section title="Valoración (anamnesis y examen)">
        {assessment && data ? (
          <>
            <p className="mb-2 text-xs text-slate-700">Versión vigente del {fmt.format(assessment.createdAt)} · {assessment.author.name}{cop ? ` · COP-D ${cop}` : ""}</p>
            {ASSESSMENT_SECTIONS.map((s) => {
              const rows = s.fields.map((f) => [f.label, value(data[f.name])] as const).filter(([, v]) => v);
              if (!rows.length) return null;
              return (
                <div key={s.id} className="mb-3 break-inside-avoid">
                  <h3 className="text-sm font-bold">{s.title}</h3>
                  <dl className="text-sm">
                    {rows.map(([k, v]) => <div key={k}><dt className="inline font-semibold">{k}: </dt><dd className="inline whitespace-pre-wrap">{v}</dd></div>)}
                  </dl>
                </div>
              );
            })}
          </>
        ) : <p className="text-sm">Sin valoración registrada.</p>}
      </Section>

      <Section title="Odontograma actual">
        {current.length ? (
          <ul className="grid gap-x-6 text-sm sm:grid-cols-2">
            {current.map((f) => <li key={`${f.tooth}${f.surface}`}>Diente {f.tooth}{f.surface ? ` (${f.surface})` : ""}: {CONDITIONS[f.condition].label} <span className="text-xs text-slate-700">· {fmtDay.format(f.at)}{f.by ? `, ${f.by}` : ""}</span></li>)}
          </ul>
        ) : <p className="text-sm">Sin hallazgos registrados.</p>}
      </Section>

      <Section title="Diagnósticos">
        {diagnoses.length ? (
          <ul className="space-y-1 text-sm">
            {diagnoses.map((d) => (
              <li key={d.id}>{d.code} {d.description || cie(d.code) || ""}{d.tooth ? ` · diente ${d.tooth}` : ""} · {fmtDay.format(d.createdAt)}, {d.dentist.name} · {DX_STATUS[d.status] ?? d.status}{d.resolvedAt ? ` el ${fmtDay.format(d.resolvedAt)}` : ""}{d.closedBy ? ` por ${d.closedBy.name}` : ""}{d.closeReason ? ` (motivo: ${d.closeReason})` : ""}</li>
            ))}
          </ul>
        ) : <p className="text-sm">Sin diagnósticos registrados.</p>}
      </Section>

      <Section title="Planes de tratamiento">
        {plans.length ? plans.map((plan) => (
          <div key={plan.id} className="mb-3 break-inside-avoid text-sm">
            <p className="font-semibold">{plan.title} · {fmtDay.format(plan.createdAt)}{plan.acceptedAt ? ` · aceptado ${fmtDay.format(plan.acceptedAt)}` : ""}</p>
            <ul className="ml-4 list-disc">
              {plan.items.map((i) => (
                <li key={i.id}>{PHASES.find((ph) => ph.n === i.phase)?.label}: {i.name}{i.tooth ? ` · diente ${i.tooth}` : ""}{i.surfaces ? ` (${i.surfaces})` : ""}{i.procedureCode ? ` · CUPS ${i.procedureCode}` : ""} · {ITEM_STATUS[i.status] ?? i.status}{i.doneAt ? ` ${fmtDay.format(i.doneAt)}` : ""}</li>
              ))}
            </ul>
          </div>
        )) : <p className="text-sm">Sin planes de tratamiento.</p>}
      </Section>

      <Section title="Evoluciones">
        {evolutions.length ? (
          <ol className="space-y-3 text-sm">
            {evolutions.map((e) => (
              <li key={e.id} className="break-inside-avoid border-l-2 border-slate-300 pl-3">
                <p className="font-semibold">{fmt.format(e.signedAt)} · {e.dentist.name}{e.dentist.licenseNumber ? ` (RP ${e.dentist.licenseNumber})` : ""}</p>
                <p className="text-xs text-slate-700">{[e.diagnosisCode ? `CIE-10 ${e.diagnosisCode}` : null, e.procedureCode ? `CUPS ${e.procedureCode}` : null].filter(Boolean).join(" · ")}{e.seal ? <> · Sello <SealMark seal={e.seal} /></> : null}</p>
                {e.corrects && <p className="font-semibold">Nota aclaratoria a la evolución del {fmt.format(e.corrects.signedAt)} de {e.corrects.dentist.name}</p>}
                {e.reason && !e.corrects && <p><span className="font-semibold">Motivo:</span> {e.reason}</p>}
                <p className="whitespace-pre-wrap">{e.note}</p>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm">Sin evoluciones.</p>}
      </Section>

      <Section title="Consentimientos informados">
        {consents.length ? (
          <ul className="space-y-1 text-sm">
            {consents.map((c) => <li key={c.id}>{fmt.format(c.signedAt)} · {c.title} · firmado por {c.signerName} ({c.signerRelation}) · {c.dentist.name}{c.seal ? <> · Sello <SealMark seal={c.seal} /></> : null}</li>)}
          </ul>
        ) : <p className="text-sm">Sin consentimientos.</p>}
      </Section>

      <Section title="Fórmulas médicas">
        {prescriptions.length ? (
          <ul className="space-y-2 text-sm">
            {prescriptions.map((r) => (
              <li key={r.id} className="break-inside-avoid">
                <p className="font-semibold">N.º {r.number} · {fmtDay.format(r.issuedAt)} · {r.dentist.name}{r.voidedAt ? " · ANULADA" : ""}</p>
                <ul className="ml-4 list-disc">{r.items.map((it) => <li key={it.id}>{it.name} {it.concentration} · {it.dose} · {it.frequency} · {it.duration}</li>)}</ul>
              </li>
            ))}
          </ul>
        ) : <p className="text-sm">Sin fórmulas.</p>}
      </Section>

      <footer className="mt-8 border-t border-slate-400 pt-3 text-xs text-slate-700">
        <p>Documento reservado (Ley 23 de 1981 y Res. 1995 de 1999). Solo puede entregarse al paciente, a quien él autorice o a las autoridades que la ley indica.</p>
        <p className="mt-1">La integridad de evoluciones y consentimientos se puede verificar en /verificar/ con el código del sello.</p>
      </footer>
      <div className="mt-6 text-center print:hidden"><PrintButton /></div>
    </main>
  );
}

const DX_STATUS: Record<string, string> = { ACTIVE: "activo", RESOLVED: "resuelto", REPLACED: "corregido", VOIDED: "anulado" };
const ITEM_STATUS: Record<string, string> = { PLANNED: "pendiente", IN_PROGRESS: "en curso", DONE: "realizado", CANCELLED: "cancelado" };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-slate-300 py-3">
      <h2 className="mb-2 text-base font-bold uppercase tracking-wide text-teal-900">{title}</h2>
      {children}
    </section>
  );
}
