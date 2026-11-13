import Link from "next/link";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { copFmt } from "@/lib/cartera";
import { dateStr, fmtDate, todayStr } from "@/lib/finanzas";
import { OUTSIDE, labStatus } from "@/lib/labs";
import { labAlerts } from "@/lib/labs-data";
import { LabStatusButton } from "./forms";

const when = new Intl.DateTimeFormat("es-CO", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });
const VIEWS = { activos: "Por llegar y en el consultorio", colocados: "Colocados" } as const;

// Laboratorio: trabajos enviados, recibidos y colocados. El odontólogo ve los suyos; recepción y administración, todos.
export default async function LaboratorioPage({ searchParams }: PageProps<"/laboratorio">) {
  const user = await requireUser();
  const view = (await searchParams).ver === "colocados" ? "colocados" : "activos";
  const mine = user.role === "DENTIST" ? { dentistId: user.id } : {};
  const [orders, alerts] = await Promise.all([
    db.labOrder.findMany({
      where: { clinicId: user.clinicId, voidedAt: null, ...mine, status: view === "activos" ? { in: ["SENT", "ADJUST", "RECEIVED"] } : "PLACED" },
      orderBy: view === "activos" ? [{ promisedAt: "asc" }, { number: "asc" }] : { placedAt: "desc" },
      take: view === "activos" ? 200 : 50,
      select: { id: true, number: true, workType: true, tooth: true, status: true, promisedAt: true, cost: true, patientId: true, payee: { select: { name: true } }, dentist: { select: { name: true } } },
    }),
    labAlerts(user.clinicId, user.role === "DENTIST" ? { dentistId: user.id } : {}),
  ]);
  const patients = await db.patient.findMany({ where: { id: { in: orders.map((o) => o.patientId) } }, select: { id: true, firstName: true, lastName: true } });
  const name = new Map(patients.map((p) => [p.id, `${p.firstName} ${p.lastName}`]));
  const today = todayStr();
  const seeCost = user.role !== "RECEPTION";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">Laboratorio</h1>
        {user.role !== "RECEPTION" && <Link href="/laboratorio/nueva" className="btn-primary">+ Orden</Link>}
      </div>

      {alerts.length > 0 && (
        <section className="card space-y-2 border-amber-600">
          <h2 className="section-title">Tienen cita y el trabajo no ha llegado</h2>
          <ul className="space-y-1">
            {alerts.map((a) => (
              <li key={a.id}><Link href={`/laboratorio/${a.id}`} className="font-semibold text-slate-900 underline">{a.appointment.patient.firstName} {a.appointment.patient.lastName}</Link> · cita el {when.format(a.appointment.startsAt)} · {a.workType}{a.tooth ? ` diente ${a.tooth}` : ""} en {a.payee.name}{a.promisedAt ? ` (prometido para el ${fmtDate(a.promisedAt)})` : ""}</li>
            ))}
          </ul>
        </section>
      )}

      <nav aria-label="Ver" className="flex flex-wrap gap-2">
        {(Object.keys(VIEWS) as (keyof typeof VIEWS)[]).map((v) => (
          <Link key={v} href={v === "activos" ? "/laboratorio" : `/laboratorio?ver=${v}`} aria-current={v === view ? "true" : undefined} className={`rounded-lg border px-3 py-2 text-sm font-semibold ${v === view ? "border-slate-900 bg-slate-900 text-white" : "border-slate-400 bg-white text-slate-900"}`}>{VIEWS[v]}</Link>
        ))}
      </nav>

      <ul className="space-y-2">
        {orders.map((o) => {
          const late = OUTSIDE.includes(o.status as never) && o.promisedAt && dateStr(o.promisedAt) < today;
          return (
            <li key={o.id} className="card space-y-2">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link href={`/laboratorio/${o.id}`} className="hover:underline">
                  <span className="block font-semibold">{name.get(o.patientId) ?? "Paciente"} · {o.workType}{o.tooth ? ` diente ${o.tooth}` : ""}</span>
                  <span className="muted">Orden {o.number} · {o.payee.name} · {o.dentist.name}{seeCost ? ` · ${copFmt.format(o.cost)}` : ""}</span>
                  {o.promisedAt && OUTSIDE.includes(o.status as never) && <span className={`block text-sm ${late ? "font-semibold text-red-700" : "text-slate-700"}`}>{late ? "Atrasado: " : ""}prometido para el {fmtDate(o.promisedAt)}</span>}
                </Link>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${labStatus(o.status).cls}`}>{labStatus(o.status).label}</span>
              </div>
              {OUTSIDE.includes(o.status as never) && <LabStatusButton id={o.id} to="RECEIVED" />}
            </li>
          );
        })}
        {orders.length === 0 && <li className="card text-center text-slate-700">{view === "activos" ? "No hay trabajos pendientes en el laboratorio." : "Aún no hay trabajos colocados."}</li>}
      </ul>
      {user.role !== "RECEPTION" && <p className="muted">Para enviar un trabajo ligado al procedimiento, usa «Enviar a laboratorio» en el plan de tratamiento del paciente: así su costo se descuenta solo en la liquidación del profesional.</p>}
    </div>
  );
}
