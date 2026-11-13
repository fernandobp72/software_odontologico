// Pagos a empleados en versión ligera: el software ordena pagos, novedades y fechas; la nómina legal la liquida el contador.
import { addDays, dateOnly, dateStr, daysBetween, monthRange } from "./finanzas";

export const CONTRACTS = {
  INDEFINIDO: "Término indefinido",
  FIJO: "Término fijo",
  OBRA: "Obra o labor",
  APRENDIZ: "Aprendiz SENA",
  PRESTACION: "Prestación de servicios",
} as const;
export type ContractKey = keyof typeof CONTRACTS;
export const CONTRACT_KEYS = Object.keys(CONTRACTS) as [ContractKey, ...ContractKey[]];
export const contractLabel = (k: string) => (CONTRACTS as Record<string, string>)[k] ?? k;
// Contratos laborales: tienen aportes, prestaciones y fechas legales.
export const isLabor = (k: string) => k !== "PRESTACION";

// Novedades: sign 1 suma al pago, -1 resta, 0 solo queda registrada (el contador decide su efecto).
export const NOVELTIES = {
  HORAS_EXTRA: { label: "Horas extra o recargos", sign: 1 },
  BONO: { label: "Bono o bonificación", sign: 1 },
  ADELANTO: { label: "Adelanto", sign: -1 },
  PRESTAMO: { label: "Cuota de préstamo", sign: -1 },
  FALTA: { label: "Falta o permiso no remunerado", sign: -1 },
  INCAPACIDAD: { label: "Incapacidad", sign: 0 },
  VACACIONES: { label: "Vacaciones", sign: 0 },
  OTRO_SUMA: { label: "Otro (suma)", sign: 1 },
  OTRO_RESTA: { label: "Otro (resta)", sign: -1 },
} as const;
export type NoveltyKey = keyof typeof NOVELTIES;
export const NOVELTY_KEYS = Object.keys(NOVELTIES) as [NoveltyKey, ...NoveltyKey[]];
export const noveltyLabel = (k: string) => (NOVELTIES as Record<string, { label: string }>)[k]?.label ?? k;

// Periodos de pago: 1.ª quincena (1–15), 2.ª quincena (16–fin) o mes completo.
export type PeriodKind = "Q1" | "Q2" | "M";
const monthName = new Intl.DateTimeFormat("es-CO", { month: "long", year: "numeric", timeZone: "UTC" });
export function periodInfo(key: string) {
  const m = /^(\d{4}-\d{2})-(Q1|Q2|M)$/.exec(key);
  if (!m) return null;
  const [, month, kind] = m as unknown as [string, string, PeriodKind];
  const { from, to } = monthRange(month);
  const end = addDays(to, -1);
  const name = monthName.format(dateOnly(`${month}-01`));
  if (kind === "Q1") return { key, month, kind, from, to: `${month}-15`, label: `1.ª quincena de ${name}` };
  if (kind === "Q2") return { key, month, kind, from: `${month}-16`, to: end, label: `2.ª quincena de ${name}` };
  return { key, month, kind, from, to: end, label: `Mes de ${name}` };
}
// El periodo que toca pagar hoy: la quincena en curso.
export const currentPeriodKey = (today: string, every: "QUINCENAL" | "MENSUAL" = "QUINCENAL") => `${today.slice(0, 7)}-${every === "MENSUAL" ? "M" : Number(today.slice(8)) <= 15 ? "Q1" : "Q2"}`;

export type Settings = { minWage: number; transportAid: number };

// Total sugerido para un empleado en un periodo. Es editable: el contador puede ajustar cualquier valor.
export function suggestPay(e: { salary: number; payEvery: string; contractType: string }, novelties: { amount: number }[], periodKind: PeriodKind, s: Settings) {
  const share = periodKind === "M" || e.payEvery === "MENSUAL" ? 1 : 0.5;
  const base = Math.round(e.salary * share);
  // Auxilio de transporte: hasta dos salarios mínimos, solo en contratos laborales (no aprendices ni prestación de servicios).
  const transport = isLabor(e.contractType) && e.contractType !== "APRENDIZ" && e.salary <= 2 * s.minWage ? Math.round(s.transportAid * share) : 0;
  const additions = novelties.filter((n) => n.amount > 0).reduce((t, n) => t + n.amount, 0);
  const minus = novelties.filter((n) => n.amount < 0).reduce((t, n) => t - n.amount, 0);
  // Aporte del empleado a salud (4 %) y pensión (4 %), descontado del pago. Sugerencia: lo confirma el contador.
  const contributions = isLabor(e.contractType) && e.contractType !== "APRENDIZ" ? Math.round(base * 0.08) : 0;
  const deductions = minus + contributions;
  return { base, transport, additions, deductions, contributions, total: Math.max(0, base + transport + additions - deductions) };
}

// Costo real estimado para la clínica al sumar aportes y prestaciones (cerca de 1,55 veces el salario básico en salario mínimo).
export const realCost = (salary: number, contractType: string) => (isLabor(contractType) ? Math.round(salary * 1.55) : salary);

// Fechas legales de cada año. La de seguridad social depende de los últimos dígitos del NIT: se muestra como recordatorio mensual.
const YEARLY: { label: string; md: string }[] = [
  { label: "Intereses de cesantías al empleado", md: "01-31" },
  { label: "Cesantías al fondo", md: "02-14" },
  { label: "Dotación", md: "04-30" },
  { label: "Prima de servicios (1.ª)", md: "06-30" },
  { label: "Dotación", md: "08-31" },
  { label: "Prima de servicios (2.ª)", md: "12-20" },
  { label: "Dotación", md: "12-20" },
];

export function legalDates(today: string, horizonDays = 60) {
  const year = Number(today.slice(0, 4));
  const out: { label: string; date: string; days: number; note?: string }[] = [];
  for (const y of [year, year + 1]) for (const d of YEARLY) out.push({ label: d.label, date: `${y}-${d.md}`, days: 0 });
  // Nómina electrónica DIAN: primeros 10 días del mes siguiente.
  const nextMonth = addDays(monthRange(today.slice(0, 7)).to, 0);
  out.push({ label: "Nómina electrónica DIAN del mes anterior", date: Number(today.slice(8)) <= 10 ? `${today.slice(0, 7)}-10` : `${nextMonth.slice(0, 7)}-10`, days: 0 });
  // Seguridad social (PILA): cada mes, entre el día hábil 2 y 16 según el NIT. Se recuerda hacia el 16.
  out.push({ label: "Seguridad social (PILA)", date: Number(today.slice(8)) <= 16 ? `${today.slice(0, 7)}-16` : `${nextMonth.slice(0, 7)}-16`, days: 0, note: "Entre el día hábil 2 y 16 según el NIT: confirma la fecha exacta con tu contador" });
  return out
    .map((d) => ({ ...d, days: daysBetween(today, d.date) }))
    .filter((d) => d.days >= 0 && d.days <= horizonDays)
    .sort((a, b) => a.days - b.days || a.label.localeCompare(b.label))
    .filter((d, i, arr) => arr.findIndex((x) => x.label === d.label && x.date === d.date) === i);
}

export const isoDay = (d: Date) => dateStr(d);
