import Link from "next/link";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { branchProfessionals } from "@/lib/professionals";
import { addDays, addMonths, dayStart, hhmm, isYmd, longDay, monthGrid, monthStart, monthTitle, shortRange, startOfWeek, ymd } from "@/lib/calendar";
import DayList, { type DayAppointment } from "./day-list";
import NewAppointmentFab from "./new-fab";
import ScrollLock from "./scroll-lock";
import { STATUS } from "./status";
import { patientOption } from "@/lib/patient-fields";

type View = "mes" | "semana" | "dia";
const VIEWS: [View, string][] = [["mes", "Mes"], ["semana", "Semana"], ["dia", "Día"]];
const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export default async function AgendaPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { user, branch, branches } = await requireBranch();
  const now = new Date();
  const today = ymd(now);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const view: View = (["mes", "semana", "dia"] as const).find((v) => v === one(sp.vista)) ?? "mes";
  const selected = isYmd(one(sp.fecha)) ? (one(sp.fecha) as string) : today;
  const proParam = one(sp.pro) ?? "";

  const pros = await branchProfessionals(user.clinicId, branch.id);
  const proId = pros.some((p) => p.id === proParam) ? proParam : "";

  // Rango visible según la vista.
  const monthDays = monthGrid(selected);
  const weekStart = startOfWeek(selected);
  const first = view === "mes" ? monthDays[0] : view === "semana" ? weekStart : selected;
  const last = view === "mes" ? monthDays[monthDays.length - 1] : view === "semana" ? addDays(weekStart, 6) : selected;

  const pacienteParam = one(sp.paciente);
  const [rows, seedPatient] = await Promise.all([
    db.appointment.findMany({
      where: { clinicId: user.clinicId, branchId: branch.id, ...(proId ? { dentistId: proId } : {}), startsAt: { gte: dayStart(first), lt: dayStart(addDays(last, 1)) } },
      include: { patient: { select: { firstName: true, lastName: true, phone: true, whatsappOptInAt: true } }, dentist: { select: { name: true } }, clinic: { select: { name: true } }, branch: { select: { name: true } }, reminders: { where: { status: "SENT" }, select: { id: true }, take: 1 } },
      orderBy: { startsAt: "asc" },
      take: 2000,
    }),
    pacienteParam ? db.patient.findFirst({ where: { id: pacienteParam, clinicId: user.clinicId } }) : Promise.resolve(null),
  ]);
  const appointments: DayAppointment[] = rows;
  const defaultDentistId = user.role === "DENTIST" ? user.id : pros.some((p) => p.id === user.id) ? user.id : null;

  const byDay = new Map<string, DayAppointment[]>();
  for (const a of appointments) {
    const k = ymd(a.startsAt);
    byDay.set(k, [...(byDay.get(k) ?? []), a]);
  }

  // Indicadores del periodo visible (sin contar el mes anterior/siguiente que asoman en la cuadrícula).
  const inPeriod = view === "mes" ? appointments.filter((a) => ymd(a.startsAt).slice(0, 7) === selected.slice(0, 7)) : appointments;
  const count = (s: string) => inPeriod.filter((a) => a.status === s).length;
  const attended = count("ATTENDED");
  const noShow = count("NO_SHOW");
  const isOpen = (a: DayAppointment) => a.status === "SCHEDULED" || a.status === "CONFIRMED";
  const overdue = inPeriod.filter((a) => isOpen(a) && a.endsAt < now).length;
  const upcoming = inPeriod.filter((a) => isOpen(a) && a.endsAt >= now);
  const toConfirm = upcoming.filter((a) => a.status === "SCHEDULED").length;
  const booked = inPeriod.filter((a) => a.status !== "CANCELLED" && a.status !== "NO_SHOW");
  const hours = booked.reduce((n, a) => n + (a.endsAt.getTime() - a.startsAt.getTime()), 0) / 3_600_000;
  const closed = attended + noShow;
  const stats: { label: string; value: string; tone?: string }[] = [
    { label: "Citas", value: String(inPeriod.length) },
    { label: "Por confirmar", value: String(toConfirm), tone: toConfirm ? "text-amber-800" : "" },
    { label: "Confirmadas", value: String(upcoming.filter((a) => a.status === "CONFIRMED").length), tone: "text-blue-800" },
    { label: "Atendidas", value: String(attended), tone: "text-green-800" },
    { label: "Canceladas", value: String(count("CANCELLED")), tone: "text-red-800" },
    { label: "No asistieron", value: String(noShow), tone: noShow ? "text-amber-800" : "" },
    { label: "Asistencia", value: closed ? `${Math.round((attended / closed) * 100)} %` : "—" },
    { label: "Horas agendadas", value: hours ? hours.toFixed(1).replace(/\.0$/, "") : "0" },
  ];

  // Navegación.
  const href = (o: { vista?: View; fecha?: string; pro?: string; abrir?: boolean }) => {
    const q = new URLSearchParams();
    q.set("vista", o.vista ?? view);
    q.set("fecha", o.fecha ?? selected);
    const p = o.pro ?? proId;
    if (p) q.set("pro", p);
    if (o.abrir) q.set("abrir", "1");
    return `/agenda?${q}`;
  };
  const step = (dir: 1 | -1) => {
    if (view !== "mes") return addDays(selected, dir * (view === "semana" ? 7 : 1));
    const d = addMonths(selected, dir);
    return d.slice(0, 7) === today.slice(0, 7) ? today : monthStart(d);
  };
  const title = view === "mes" ? monthTitle(selected) : view === "semana" ? shortRange(weekStart, addDays(weekStart, 6)) : longDay(selected);
  const dayItems = byDay.get(selected) ?? [];
  // En celular y pantallas medianas el día se abre como una hoja inferior; en pantalla ancha es un panel lateral fijo.
  const sheet = one(sp.abrir) === "1" && view !== "dia";
  const pill = (on: boolean) => (on ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-400 bg-white text-slate-900");

  return (
    <div className="space-y-4 pb-24">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="page-title">Agenda</h1>
          {branches.length > 1 && <p className="muted">Sede: {branch.name}</p>}
        </div>
        <Link href="/recordatorios" className="btn-secondary">Recordatorios por WhatsApp</Link>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link href={href({ fecha: step(-1) })} aria-label="Anterior" className="btn-secondary min-w-11">‹</Link>
            <Link href={href({ fecha: today })} className="btn-secondary">Hoy</Link>
            <Link href={href({ fecha: step(1) })} aria-label="Siguiente" className="btn-secondary min-w-11">›</Link>
          </div>
          <h2 className="text-lg font-bold first-letter:uppercase text-slate-900" aria-live="polite">{title}</h2>
          <div className="flex gap-1" role="group" aria-label="Vista">
            {VIEWS.map(([v, label]) => (
              <Link key={v} href={href({ vista: v })} aria-current={view === v ? "page" : undefined} className={`inline-flex min-h-11 items-center rounded-lg border px-3 text-sm font-semibold ${pill(view === v)}`}>{label}</Link>
            ))}
          </div>
        </div>
        {pros.length > 1 && (
          <div className="flex flex-wrap gap-1" role="group" aria-label="Profesional">
            <Link href={href({ pro: "" })} className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold ${pill(!proId)}`}>Todos</Link>
            {pros.map((p) => (
              <Link key={p.id} href={href({ pro: p.id })} className={`inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-semibold ${pill(proId === p.id)}`}>{p.name}</Link>
            ))}
          </div>
        )}
        <dl className="grid grid-cols-4 gap-1.5 sm:gap-2 2xl:grid-cols-8">
          {stats.map((s) => (
            <div key={s.label} className="rounded-lg bg-slate-50 px-2 py-1.5 sm:px-3 sm:py-2">
              <dt className="text-[11px] font-medium leading-tight text-slate-700 sm:text-xs">{s.label}</dt>
              <dd className={`text-lg font-bold sm:text-xl ${s.tone || "text-slate-900"}`}>{s.value}</dd>
            </div>
          ))}
        </dl>
        {overdue > 0 && <p className="rounded-lg bg-amber-50 p-2 text-sm font-medium text-amber-900">Hay {overdue} {overdue === 1 ? "cita pasada sin cerrar" : "citas pasadas sin cerrar"}: márcalas como atendidas o «No asistió» para que los indicadores sean exactos.</p>}
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-800" aria-label="Convenciones de color">
          {Object.entries(STATUS).map(([k, v]) => <li key={k} className="flex items-center gap-1"><span className={`h-2.5 w-2.5 rounded-full ${v.dot}`} aria-hidden="true" />{v.label}</li>)}
        </ul>
      </div>

      {sheet && (<><Link href={href({})} scroll={false} aria-label="Cerrar el día" className="fixed inset-0 z-[35] bg-slate-900/50 xl:hidden" /><ScrollLock /></>)}
      <div className={view === "dia" ? "space-y-4" : "space-y-4 xl:grid xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start xl:gap-4 xl:space-y-0"}>
        <div className="space-y-4">
      {view === "mes" && (
        <div className="card overflow-hidden p-0">
          <div className="grid grid-cols-7 border-b border-slate-300 bg-slate-50 text-center text-xs font-semibold text-slate-800">
            {WEEKDAYS.map((d) => <div key={d} className="py-2">{d}</div>)}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((d) => {
              const list = byDay.get(d) ?? [];
              const inMonth = d.slice(0, 7) === selected.slice(0, 7);
              const isToday = d === today;
              const isSel = d === selected;
              return (
                <Link key={d} href={href({ fecha: d, abrir: true })} scroll={false} aria-label={`${longDay(d)}: ${list.length} ${list.length === 1 ? "cita" : "citas"}`} aria-current={isSel ? "date" : undefined}
                  className={`min-h-16 border-b border-r border-slate-200 p-1 text-left hover:bg-teal-50 sm:min-h-28 sm:p-1.5 ${inMonth ? "bg-white" : "bg-slate-50 text-slate-500"} ${isSel ? "outline outline-2 -outline-offset-2 outline-teal-700" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold ${isToday ? "bg-teal-700 text-white" : ""}`}>{Number(d.slice(8))}</span>
                    {list.length > 0 && <span className="text-[11px] font-semibold text-slate-700 sm:hidden">{list.length}</span>}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                    {list.slice(0, 6).map((a) => <span key={a.id} className={`h-2 w-2 rounded-full ${STATUS[a.status].dot}`} aria-hidden="true" />)}
                  </div>
                  <div className="mt-1 hidden space-y-0.5 sm:block">
                    {list.slice(0, 3).map((a) => (
                      <p key={a.id} className={`truncate rounded border-l-4 px-1 text-[11px] leading-5 ${STATUS[a.status].chip}`}>{hhmm(a.startsAt)} {a.patient.firstName} {a.patient.lastName}</p>
                    ))}
                    {list.length > 3 && <p className="px-1 text-[11px] font-semibold text-slate-700">+{list.length - 3} más</p>}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {view === "semana" && (
        <div className="grid gap-2 sm:grid-cols-2">
          {Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).map((d, i) => {
            const list = byDay.get(d) ?? [];
            return (
              <div key={d} className={`card space-y-2 p-2 ${d === selected ? "outline outline-2 outline-teal-700" : ""}`}>
                <Link href={href({ fecha: d, abrir: true })} scroll={false} className="flex items-baseline justify-between">
                  <span className={`text-sm font-bold ${d === today ? "text-teal-800" : "text-slate-900"}`}>{WEEKDAYS[i]} {Number(d.slice(8))}</span>
                  <span className="text-xs text-slate-700">{list.length} {list.length === 1 ? "cita" : "citas"}</span>
                </Link>
                {list.length === 0 && <p className="text-xs text-slate-600">Libre</p>}
                {list.map((a) => (
                  <Link key={a.id} href={href({ fecha: d, abrir: true })} scroll={false} className={`block rounded border-l-4 px-2 py-1 text-xs ${STATUS[a.status].chip}`}>
                    <span className="font-semibold">{hhmm(a.startsAt)}</span> {a.patient.firstName} {a.patient.lastName}
                    {pros.length > 1 && <span className="block text-[11px] opacity-80">{a.dentist.name}</span>}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
        </div>
      <section aria-label="Citas del día" className={view === "dia" ? "space-y-3" : `${sheet ? "fixed inset-x-0 bottom-0 z-40 flex max-h-[85dvh] flex-col rounded-t-2xl bg-slate-50 shadow-2xl" : "hidden"} xl:sticky xl:top-4 xl:z-auto xl:flex xl:max-h-[calc(100dvh-2rem)] xl:flex-col xl:rounded-none xl:bg-transparent xl:shadow-none`}>
        <div className={view === "dia" ? "" : "flex items-center justify-between gap-2 border-b border-slate-300 px-4 py-3 xl:border-0 xl:px-0 xl:pt-0"}>
          <h2 className="section-title first-letter:uppercase">{longDay(selected)}{dayItems.length > 0 && <span className="ml-2 text-sm font-normal text-slate-700">{dayItems.length} {dayItems.length === 1 ? "cita" : "citas"}</span>}</h2>
          {view !== "dia" && <Link href={href({})} scroll={false} aria-label="Cerrar" className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-2xl text-slate-700 hover:bg-slate-200 xl:hidden">×</Link>}
        </div>
        <div className={view === "dia" ? "" : "overflow-y-auto px-4 pb-6 pt-3 xl:px-0 xl:pb-0"}>
          <DayList items={dayItems} showPro={pros.length > 1} now={now} canAttend={user.role !== "RECEPTION"} />
        </div>
      </section>
      </div>

      <NewAppointmentFab
        key={seedPatient?.id ?? "fab"}
        autoOpen={!!seedPatient}
        initialPatient={seedPatient ? patientOption(seedPatient) : null}
        professionals={user.role === "DENTIST" ? [] : pros.map((p) => ({ id: p.id, name: p.name }))}
        defaultDentistId={defaultDentistId}
        defaultDate={selected < today ? today : selected}
      />
    </div>
  );
}
