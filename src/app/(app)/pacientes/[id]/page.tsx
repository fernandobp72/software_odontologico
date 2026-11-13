import { docText } from "@/lib/patient-fields";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { canWriteClinical, requireUser } from "@/lib/dal";
import { CONDITIONS, type ConditionKey } from "@/lib/catalogs";
import { setWhatsappOptIn } from "../../recordatorios/actions";
import Odontogram from "./odontogram";
import EvolutionForm from "./evolution-form";
import CorrectionForm from "./correction-form";
import DeleteTestPatient from "./delete-test";
import SealMark from "@/app/seal-mark";
import { ageText, isRecentPatient } from "@/lib/patient-fields";
import { ymd } from "@/lib/calendar";
import Link from "next/link";
import { STATUS } from "../../agenda/status";

export default async function PacientePage({ params, searchParams }: PageProps<"/pacientes/[id]">) {
  const user = await requireUser();
  const { id } = await params;
  const { cita, evoluciones, desde } = await searchParams;
  // Evoluciones: las 50 más recientes, o todas, o desde una fecha (filtro para tratamientos largos).
  const allEvos = evoluciones === "todas";
  const since = typeof desde === "string" && /^\d{4}-\d{2}-\d{2}$/.test(desde) ? new Date(`${desde}T05:00:00Z`) : null;
  const p = await db.patient.findFirst({ where: { id, clinicId: user.clinicId } });
  if (!p) notFound();

  const canEdit = canWriteClinical(user);
  // Recepción no es equipo de salud: ve datos, citas y cuenta, pero no la historia clínica (Res. 1995 de 1999, art. 14).
  const canReadClinical = user.role !== "RECEPTION";
  const clin = <T,>(q: () => Promise<T>, empty: T) => (canReadClinical ? q() : Promise.resolve(empty));
  const now = new Date();
  const [allFindings, evolutions, openItemsRaw, initialSnap, activeDx, appts, evoCount, phrases] = await Promise.all([
    clin(() => db.toothFinding.findMany({ where: { patientId: p.id }, orderBy: { createdAt: "asc" }, include: { author: { select: { name: true } } } }), []),
    clin(() => db.evolution.findMany({
      where: { patientId: p.id, ...(since ? { signedAt: { gte: since } } : {}) }, orderBy: { signedAt: "desc" }, ...(allEvos || since ? {} : { take: 50 }),
      include: { dentist: { select: { name: true } }, corrects: { select: { signedAt: true, dentist: { select: { name: true } } } }, corrections: { select: { signedAt: true, dentist: { select: { name: true } } }, orderBy: { signedAt: "asc" } } },
    }), []),
    clin(() => db.treatmentItem.findMany({ where: { status: { in: ["PLANNED", "IN_PROGRESS"] }, plan: { patientId: p.id, status: { in: ["DRAFT", "PRESENTED", "ACCEPTED", "IN_PROGRESS"] } } }, orderBy: [{ phase: "asc" }, { createdAt: "asc" }] }), []),
    clin(() => db.odontogramSnapshot.findUnique({ where: { patientId_kind: { patientId: p.id, kind: "INITIAL" } } }), null),
    clin(() => db.diagnosis.findMany({ where: { patientId: p.id, status: "ACTIVE" }, select: { code: true, tooth: true } }), []),
    db.appointment.findMany({ where: { patientId: p.id, clinicId: user.clinicId }, orderBy: { startsAt: "desc" }, include: { dentist: { select: { name: true } }, branch: { select: { name: true } } }, take: 200 }),
    clin(() => db.evolution.count({ where: { patientId: p.id } }), 0),
    canEdit ? db.notePhrase.findMany({ where: { userId: user.id }, orderBy: { label: "asc" }, select: { id: true, label: true, text: true } }) : Promise.resolve([]),
  ]);
  // Citas del paciente: la próxima, el historial y cuántas veces no asistió o canceló.
  const isOpenAppt = (a: { status: string }) => a.status === "SCHEDULED" || a.status === "CONFIRMED";
  const nextAppt = appts.filter((a) => isOpenAppt(a) && a.endsAt >= now).at(-1) ?? null;
  const pastAppts = appts.filter((a) => a !== nextAppt && a.startsAt < now);
  const noShows = appts.filter((a) => a.status === "NO_SHOW").length;
  const cancelled = appts.filter((a) => a.status === "CANCELLED").length;
  // Cita que se está atendiendo: la que llega desde «Atender» en la agenda o, si no, la de hoy que siga abierta.
  const citaId = typeof cita === "string" ? cita : "";
  const attending = canEdit
    ? appts.find((a) => a.id === citaId && isOpenAppt(a)) ?? appts.find((a) => isOpenAppt(a) && ymd(a.startsAt) === ymd(now)) ?? null
    : null;
  const sigs = await db.proSignature.findMany({ where: { docKind: "Evolution", docId: { in: evolutions.map((e) => e.id) } }, include: { credential: { select: { serial: true, label: true, compromisedSince: true } } } });
  const sigOf = new Map(sigs.map((x) => [x.docId, x]));
  const pending = openItemsRaw.filter((i) => i.tooth).map((i) => ({ tooth: i.tooth as number, surfaces: i.surfaces ?? "" }));
  const openItems = openItemsRaw.map((i) => ({
    id: i.id, name: i.name, tooth: i.tooth, surfaces: i.surfaces, material: i.material, procedureCode: i.procedureCode,
    // Diagnóstico activo del mismo diente (si hay), para completar el código y la redacción.
    diagnosisCode: (i.tooth ? activeDx.find((d) => d.tooth === i.tooth)?.code : undefined) ?? null,
  }));
  // El último registro por diente/superficie es el estado actual.
  const latest = new Map<string, { tooth: number; surface: string | null; condition: ConditionKey }>();
  for (const f of allFindings) latest.set(`${f.tooth}|${f.surface ?? ""}`, { tooth: f.tooth, surface: f.surface, condition: f.condition });
  const findings = [...latest.values()].filter((f) => f.condition !== "HEALTHY");
  // Quién marcó qué en el odontograma, lo más reciente primero.
  const findingLog = allFindings.slice(-80).reverse();
  const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Bogota" });

  const rows: [string, string | null][] = [
    ["Documento", docText(p.documentType, p.documentNumber)],
    ["Nacimiento", p.birthDate ? `${new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: "UTC" }).format(p.birthDate)} (${ageText(p.birthDate)})` : null],
    ["Sexo", p.sex === "F" ? "Femenino" : p.sex === "M" ? "Masculino" : p.sex === "O" ? "Otro" : null],
    ["Celular", p.phone],
    ["Correo", p.email],
    ["Dirección", [p.address, p.city].filter(Boolean).join(", ") || null],
    ["Ocupación", p.occupation],
    ["EPS", [p.eps, p.regime ? p.regime.charAt(0) + p.regime.slice(1).toLowerCase() : null].filter(Boolean).join(" · ") || null],
    ["Acompañante", [p.companionName, p.companionKin ? `(${p.companionKin})` : null, p.companionPhone].filter(Boolean).join(" ") || null],
    ["Alergias", p.allergies],
  ];

  const dataPanel = (
    <>
      <dl className="card divide-y divide-slate-200 p-0">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-4 px-4 py-3">
            <dt className="muted">{k}</dt>
            <dd className="min-w-0 text-right text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">{v || "—"}</dd>
          </div>
        ))}
      </dl>
      <div className="card flex items-center justify-between gap-3">
        <div>
          <p className="muted">Recordatorios por WhatsApp</p>
          <p className="text-sm font-semibold text-slate-900">{p.whatsappOptInAt ? "Autorizado" : "No autorizado"}</p>
        </div>
        <form action={setWhatsappOptIn.bind(null, p.id, !p.whatsappOptInAt)}>
          <button className="btn-secondary min-h-10">{p.whatsappOptInAt ? "Retirar" : "Registrar autorización"}</button>
        </form>
      </div>
      <section className="card space-y-3" aria-label="Citas">
        <div className="flex items-center justify-between gap-3">
          <h2 className="section-title">Citas</h2>
          <Link href={`/agenda?paciente=${p.id}`} className="btn-secondary min-h-10">Agendar</Link>
        </div>
        {nextAppt ? (
          <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-slate-900"><span className="font-semibold">Próxima:</span> {fmt.format(nextAppt.startsAt)} · {nextAppt.dentist.name}{nextAppt.reason ? ` · ${nextAppt.reason}` : ""} <span className={`ml-1 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[nextAppt.status].cls}`}>{STATUS[nextAppt.status].label}</span></p>
        ) : <p className="muted">Sin cita próxima.</p>}
        {(noShows > 0 || cancelled > 0) && (
          <p className={`text-sm font-semibold ${noShows ? "text-amber-900" : "text-slate-800"}`}>{noShows ? `No asistió ${noShows} ${noShows === 1 ? "vez" : "veces"}` : ""}{noShows && cancelled ? " · " : ""}{cancelled ? `${cancelled} ${cancelled === 1 ? "cancelada" : "canceladas"}` : ""}</p>
        )}
        {pastAppts.length > 0 && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-teal-800">Citas anteriores ({pastAppts.length}{appts.length >= 200 ? "+" : ""})</summary>
            <ul className="mt-2 divide-y divide-slate-200">
              {pastAppts.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 text-slate-900">{fmt.format(a.startsAt)}<span className="block text-xs text-slate-700">{a.dentist.name}{a.reason ? ` · ${a.reason}` : ""}</span></span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[a.status].cls}`}>{STATUS[a.status].label}</span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>
      {user.role === "ADMIN" && isRecentPatient(p.createdAt) && <DeleteTestPatient patientId={p.id} documentNumber={p.documentNumber} />}
    </>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:items-start">
        <aside className="order-first min-w-0 lg:order-last lg:sticky lg:top-8">
          {/* Celular: una línea compacta (con las alergias a la vista) y los datos plegados, para dejar el odontograma como protagonista. */}
          <details className="card p-0 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:hidden">
              <span className="min-w-0 text-sm text-slate-900">
                {p.allergies ? <span className="font-semibold text-red-700">⚠ Alergias: {p.allergies}</span> : <span className="font-semibold">Datos y citas del paciente</span>}
              </span>
              <span className="shrink-0 text-sm font-semibold text-teal-800">Ver ▾</span>
            </summary>
            <div className="space-y-3 border-t border-slate-200 p-3">{dataPanel}</div>
          </details>
          {/* Escritorio: panel lateral siempre abierto. */}
          <div className="hidden space-y-3 lg:block">{dataPanel}</div>
        </aside>
        <div className="min-w-0 space-y-6 lg:col-span-2">
          {!canReadClinical && <p className="card text-center text-slate-700">Sin acceso a la historia clínica.</p>}
          {canReadClinical && <>
          <Odontogram patientId={p.id} findings={findings} canEdit={canEdit} initial={initialSnap ? (initialSnap.data as unknown as { tooth: number; surface: string | null; condition: ConditionKey }[]) : null} planned={pending} />
          {findingLog.length > 0 && (
            <details className="card">
              <summary className="cursor-pointer text-sm font-semibold text-slate-900">Historial de cambios del odontograma</summary>
              <ul className="mt-2 divide-y divide-slate-200 text-sm text-slate-800">
                {findingLog.map((f) => (
                  <li key={f.id} className="py-1.5">Diente {f.tooth}{f.surface ? ` (${f.surface})` : ""}: {CONDITIONS[f.condition].label} <span className="text-xs text-slate-700">· {fmt.format(f.createdAt)} · {f.author?.name ?? "sin autor registrado"}</span></li>
                ))}
              </ul>
            </details>
          )}
          {canEdit && <EvolutionForm patientId={p.id} openItems={openItems} appointment={attending ? { id: attending.id, time: fmt.format(attending.startsAt), reason: attending.reason } : null} phrases={phrases} />}
          <section className="space-y-3">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="section-title">Evoluciones{evoCount > evolutions.length ? ` · ${evolutions.length} de ${evoCount}` : ""}</h2>
              {evoCount > 10 && (
                <form className="flex flex-wrap items-end gap-2" action={`/pacientes/${p.id}`}>
                  <label className="label">Desde<input type="date" name="desde" defaultValue={typeof desde === "string" ? desde : ""} className="field mt-1" /></label>
                  <button className="btn-secondary">Filtrar</button>
                  {(since || allEvos) && <a href={`/pacientes/${p.id}`} className="btn-secondary">Quitar filtro</a>}
                </form>
              )}
            </div>
            {evolutions.map((e) => (
              <article key={e.id} className="card">
                <p className="muted">{fmt.format(e.signedAt)} · {e.dentist.name}{e.diagnosisCode ? ` · ${e.diagnosisCode}` : ""}{e.procedureCode ? ` · CUPS ${e.procedureCode}` : ""} · <SealMark seal={e.seal} /></p>
                {(() => {
                  const sg = sigOf.get(e.id);
                  if (!sg) return null;
                  const bad = sg.credential?.compromisedSince && sg.signedAt >= sg.credential.compromisedSince;
                  return bad
                    ? <p className="text-xs font-semibold text-red-800">⚠ Firmada con un dispositivo que el profesional reportó como perdido o robado (desde {fmt.format(sg.credential!.compromisedSince!)}). En revisión.</p>
                    : <p className="text-xs text-slate-700">🔐 Firmada con el sello digital del profesional{sg.credential ? ` · N.º ${sg.credential.serial}` : ""}{sg.method === "PIN" ? " (clave de firma)" : ""}</p>;
                })()}
                {e.corrects && <p className="text-sm font-semibold text-amber-900">Nota aclaratoria a la evolución del {fmt.format(e.corrects.signedAt)} de {e.corrects.dentist.name}</p>}
                {e.corrections.length > 0 && <p className="text-sm font-semibold text-amber-900">Tiene {e.corrections.length === 1 ? "una nota aclaratoria" : `${e.corrections.length} notas aclaratorias`}: {e.corrections.map((c) => `${fmt.format(c.signedAt)} (${c.dentist.name})`).join(", ")}</p>}
                {e.reason && !e.corrects && <p className="font-semibold">{e.reason}</p>}
                <p className="whitespace-pre-wrap">{e.note}</p>
                {canEdit && !e.corrects && <CorrectionForm patientId={p.id} evolutionId={e.id} author={e.dentist.name} />}
              </article>
            ))}
            {evolutions.length === 0 && <p className="card text-center text-slate-700">Sin evoluciones{since ? " desde esa fecha" : ""}</p>}
            {evoCount > evolutions.length && !since && <a href={`/pacientes/${p.id}?evoluciones=todas`} className="btn-secondary w-full text-center">Ver las {evoCount} evoluciones</a>}
          </section>
          </>}
        </div>
      </div>
    </div>
  );
}
