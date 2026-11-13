// Finanzas: nombres en palabras de consultorio (sin jerga contable) y fechas en horario de Colombia (UTC-5, sin horario de verano).
export const CATEGORIES = {
  ARRIENDO: "Arriendo y administración",
  SERVICIOS: "Servicios públicos e internet",
  INSUMOS: "Insumos clínicos",
  LABORATORIO: "Laboratorio dental",
  HONORARIOS: "Pagos a profesionales",
  EMPLEADOS: "Empleados y seguridad social",
  MANTENIMIENTO: "Mantenimiento y equipos",
  ASEO: "Aseo, papelería y residuos",
  PUBLICIDAD: "Publicidad",
  SOFTWARE: "Software y bancos",
  IMPUESTOS: "Impuestos",
  OTROS: "Otros",
} as const;
export type CategoryKey = keyof typeof CATEGORIES;
export const CATEGORY_KEYS = Object.keys(CATEGORIES) as [CategoryKey, ...CategoryKey[]];
export const categoryLabel = (k: string) => (CATEGORIES as Record<string, string>)[k] ?? k;

// De dónde salió la plata.
export const SOURCES = {
  BANK: "Banco (transferencia o tarjeta)",
  CASH_BOX: "Efectivo de la caja del día",
  PETTY: "Caja menor",
  OWNER: "Mi bolsillo",
} as const;
export type SourceKey = keyof typeof SOURCES;
export const SOURCE_KEYS = Object.keys(SOURCES) as [SourceKey, ...SourceKey[]];
export const sourceLabel = (k: string) => (SOURCES as Record<string, string>)[k] ?? k;
// Recepción solo maneja efectivo del consultorio.
export const sourcesFor = (role: string): SourceKey[] => (role === "ADMIN" ? [...SOURCE_KEYS] : ["CASH_BOX", "PETTY"]);

// Qué papel respalda el gasto. Sirve para avisar, sin bloquear, cuando el soporte puede no bastarle al contador.
export const DOC_KINDS = {
  NONE: "Sin especificar",
  FACTURA: "Factura electrónica",
  DOC_SOPORTE: "Documento soporte",
  CUENTA_COBRO: "Cuenta de cobro",
  RECIBO: "Recibo o tirilla",
} as const;
export type DocKind = keyof typeof DOC_KINDS;
export const DOC_KEYS = Object.keys(DOC_KINDS) as [DocKind, ...DocKind[]];
export const docLabel = (k: string) => (DOC_KINDS as Record<string, string>)[k] ?? k;
export const needsReview = (docKind: string) => docKind === "NONE" || docKind === "CUENTA_COBRO" || docKind === "RECIBO";

const DAY = 86_400_000;
const OFFSET = 5 * 3_600_000;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Hoy en Colombia, como «2026-11-13».
export const todayStr = (now = new Date()) => new Date(now.getTime() - OFFSET).toISOString().slice(0, 10);
export const isDateStr = (s: unknown): s is string => typeof s === "string" && ISO.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
// Las fechas sin hora (fecha del gasto, vencimiento) se guardan a medianoche UTC.
export const dateOnly = (s: string) => new Date(`${s}T00:00:00Z`);
export const dateStr = (d: Date) => d.toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => dateStr(new Date(dateOnly(s).getTime() + n * DAY));
// Instante en que empieza ese día en Colombia.
export const dayStart = (s: string) => new Date(`${s}T05:00:00Z`);
export const daysBetween = (from: string, to: string) => Math.round((dateOnly(to).getTime() - dateOnly(from).getTime()) / DAY);

const longDate = new Intl.DateTimeFormat("es-CO", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
export const fmtDate = (d: Date | string) => longDate.format(typeof d === "string" ? dateOnly(d) : d);
const monthName = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
export const fmtMonth = (period: string) => monthName.format(dateOnly(`${period}-01`));

export const PERIODS = { hoy: "Hoy", semana: "Esta semana", mes: "Este mes" } as const;
export type PeriodKey = keyof typeof PERIODS;

// Rango [desde, hasta) del periodo, en fechas de Colombia. La semana empieza el lunes.
export function periodRange(p: PeriodKey, today = todayStr()) {
  if (p === "hoy") return { from: today, to: addDays(today, 1) };
  if (p === "semana") {
    const dow = (dateOnly(today).getUTCDay() + 6) % 7;
    const from = addDays(today, -dow);
    return { from, to: addDays(from, 7) };
  }
  return monthRange(today.slice(0, 7));
}

export const isPeriodStr = (s: unknown): s is string => typeof s === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
export function monthRange(period: string) {
  const [y, m] = period.split("-").map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
  return { from: `${period}-01`, to: `${next}-01` };
}
export const prevMonth = (period: string) => dateStr(new Date(dateOnly(`${period}-01`).getTime() - DAY)).slice(0, 7);

// Día de vencimiento de un gasto que se repite, dentro del mes (el 31 en febrero cae el último día).
export function dueInMonth(period: string, dayOfMonth: number) {
  const last = Number(addDays(monthRange(period).to, -1).slice(8));
  return `${period}-${String(Math.min(dayOfMonth, last)).padStart(2, "0")}`;
}

export type DueState = "vencido" | "hoy" | "semana" | "despues" | "sin-fecha";
export function dueState(due: Date | null, today = todayStr()): DueState {
  if (!due) return "sin-fecha";
  const n = daysBetween(today, dateStr(due));
  return n < 0 ? "vencido" : n === 0 ? "hoy" : n <= 7 ? "semana" : "despues";
}
export function dueText(due: Date | null, today = todayStr()) {
  if (!due) return "Sin fecha límite";
  const n = daysBetween(today, dateStr(due));
  if (n < -1) return `Venció hace ${-n} días`;
  if (n === -1) return "Venció ayer";
  if (n === 0) return "Vence hoy";
  if (n === 1) return "Vence mañana";
  return n <= 7 ? `Vence en ${n} días` : `Vence el ${fmtDate(due)}`;
}

export const paidOf = (payments: { amount: number; voidedAt: Date | null }[]) => payments.reduce((s, p) => s + (p.voidedAt ? 0 : p.amount), 0);

// El soporte llega reducido desde el celular (las fotos se pasan a JPG de 1600 px); los PDF deben ser livianos.
export const MAX_SUPPORT = 900 * 1024;
