// Semáforo del inventario. Rojo: agotado, vencido o por debajo del mínimo. Amarillo: cerca del mínimo o con vencimiento próximo.
// Verde: todo bien. Gris: producto activado al que todavía no se le ha registrado ninguna existencia (no cuenta como alerta).
export type Level = "RED" | "YELLOW" | "GREEN" | "NONE";

export type ItemRule = { minStock: number; warnDays: number };
export type LotLite = { quantity: number; expiresAt: Date | null };
export type StockStatus = { level: Level; stock: number; expiredQty: number; nextExpiry: Date | null; daysToExpiry: number | null; reasons: string[] };

const DAY = 86_400_000;

// Hoy en Colombia como fecha sin hora (UTC medianoche), para compararla con las columnas DATE.
export function todayBogota(now = new Date()) {
  const iso = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Bogota" }).format(now);
  return new Date(`${iso}T00:00:00.000Z`);
}

export function evaluate(rule: ItemRule, lots: LotLite[], everStocked: boolean, today = todayBogota()): StockStatus {
  const live = lots.filter((l) => l.quantity > 0);
  const expired = live.filter((l) => l.expiresAt && l.expiresAt < today);
  const usable = live.filter((l) => !l.expiresAt || l.expiresAt >= today);
  const stock = usable.reduce((s, l) => s + l.quantity, 0);
  const expiredQty = expired.reduce((s, l) => s + l.quantity, 0);
  const dated = usable.filter((l) => l.expiresAt).map((l) => l.expiresAt as Date).sort((a, b) => a.getTime() - b.getTime());
  const nextExpiry = dated[0] ?? null;
  const daysToExpiry = nextExpiry ? Math.round((nextExpiry.getTime() - today.getTime()) / DAY) : null;

  if (!everStocked && live.length === 0) return { level: "NONE", stock, expiredQty, nextExpiry, daysToExpiry, reasons: ["Sin existencias registradas"] };

  const red: string[] = [];
  const yellow: string[] = [];
  if (expiredQty > 0) red.push(`Vencido, por retirar: ${expiredQty}`);
  if (stock === 0) red.push("Agotado");
  else if (stock < rule.minStock) red.push(`Bajo el mínimo (${stock} de ${rule.minStock})`);
  else if (rule.minStock > 0 && stock <= Math.ceil(rule.minStock * 1.5)) yellow.push(`Cerca del mínimo (${stock}, mínimo ${rule.minStock})`);
  if (daysToExpiry !== null && daysToExpiry <= rule.warnDays) yellow.push(daysToExpiry <= 0 ? "Vence hoy" : `Vence en ${daysToExpiry} día${daysToExpiry === 1 ? "" : "s"}`);

  const level: Level = red.length ? "RED" : yellow.length ? "YELLOW" : "GREEN";
  return { level, stock, expiredQty, nextExpiry, daysToExpiry, reasons: [...red, ...yellow] };
}

export const LEVEL_ORDER: Record<Level, number> = { RED: 0, YELLOW: 1, GREEN: 2, NONE: 3 };
export const LEVEL_LABEL: Record<Level, string> = { RED: "Atención", YELLOW: "Pronto", GREEN: "Bien", NONE: "Sin registrar" };

// Toma lo necesario de los lotes que vencen primero (los vencidos no se consumen). Devuelve null si no alcanza.
export function pickFefo<T extends { quantity: number; expiresAt: Date | null }>(lots: T[], qty: number, today = todayBogota()) {
  const usable = lots
    .filter((l) => l.quantity > 0 && (!l.expiresAt || l.expiresAt >= today))
    .sort((a, b) => (a.expiresAt?.getTime() ?? Infinity) - (b.expiresAt?.getTime() ?? Infinity));
  let left = qty;
  const takes: { lot: T; take: number }[] = [];
  for (const lot of usable) {
    if (left <= 0) break;
    const take = Math.min(lot.quantity, left);
    takes.push({ lot, take });
    left -= take;
  }
  return left > 0 ? null : takes;
}

// «3 cajas», «1 unidad», «5 unidades», «2 kits».
export function unitLabel(unit: string, n: number) {
  if (n === 1) return unit;
  if (unit.endsWith("d") || unit.endsWith("r") || unit.endsWith("l")) return `${unit}es`;
  return `${unit}s`;
}
