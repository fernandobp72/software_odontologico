// Cuenta de un paciente: lo realizado (cargos) menos lo pagado. Los pagos se aplican a los
// procedimientos más antiguos primero (FIFO) para calcular desde cuándo hay deuda.
export type Charge = { doneAt: Date; amount: number };

export function account(charges: Charge[], paid: number, now = new Date()) {
  const charged = charges.reduce((s, c) => s + c.amount, 0);
  let remaining = paid;
  let oldestUnpaid: Date | null = null;
  for (const c of [...charges].sort((a, b) => a.doneAt.getTime() - b.doneAt.getTime())) {
    if (remaining >= c.amount) remaining -= c.amount;
    else {
      oldestUnpaid = c.doneAt;
      break;
    }
  }
  const balance = charged - paid; // > 0 debe; < 0 saldo a favor (anticipo)
  const days = balance > 0 && oldestUnpaid ? Math.floor((now.getTime() - oldestUnpaid.getTime()) / 86_400_000) : 0;
  return { charged, paid, balance, oldestUnpaid, days };
}

export const AGING = [
  { key: "0-30", label: "0–30 días", max: 30 },
  { key: "31-60", label: "31–60 días", max: 60 },
  { key: "61-90", label: "61–90 días", max: 90 },
  { key: "90+", label: "Más de 90 días", max: Infinity },
] as const;

export const bucket = (days: number) => AGING.find((a) => days <= a.max)!.key;

export const METHODS = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  WALLET: "Nequi / Daviplata",
  OTHER: "Otro",
} as const;
export type MethodKey = keyof typeof METHODS;

export const copFmt = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
