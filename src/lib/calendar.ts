// Utilidades de calendario en hora de Colombia (UTC-5, sin horario de verano).
// Las fechas del calendario viajan como texto AAAA-MM-DD para evitar errores de zona horaria.
const TZ = "America/Bogota";
const dayFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
const timeFmt = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });

export const ymd = (d: Date) => dayFmt.format(d);
export const hhmm = (d: Date) => timeFmt.format(d);
export const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`));
const noon = (s: string) => new Date(`${s}T12:00:00Z`);

export const addDays = (s: string, n: number) => {
  const d = noon(s);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
export const dayStart = (s: string) => new Date(`${s}T00:00:00-05:00`);
/** Lunes = 0 … domingo = 6. */
export const weekday = (s: string) => (noon(s).getUTCDay() + 6) % 7;
export const startOfWeek = (s: string) => addDays(s, -weekday(s));
export const monthStart = (s: string) => `${s.slice(0, 8)}01`;
export const daysInMonth = (s: string) => new Date(Date.UTC(Number(s.slice(0, 4)), Number(s.slice(5, 7)), 0)).getUTCDate();
export const addMonths = (s: string, n: number) => {
  const d = noon(monthStart(s));
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 10);
};

/** Días visibles de la cuadrícula del mes: semanas completas de lunes a domingo. */
export function monthGrid(s: string) {
  const first = monthStart(s);
  const weeks = Math.ceil((weekday(first) + daysInMonth(s)) / 7);
  const start = startOfWeek(first);
  return Array.from({ length: weeks * 7 }, (_, i) => addDays(start, i));
}

export const longDay = (s: string) => new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(noon(s));
export const monthTitle = (s: string) => new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", month: "long", year: "numeric" }).format(noon(s));
export const shortRange = (a: string, b: string) => {
  const f = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "numeric", month: "short" });
  return `${f.format(noon(a))} – ${f.format(noon(b))}`;
};
