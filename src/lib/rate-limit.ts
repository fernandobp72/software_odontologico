import "server-only";
import { db } from "./db";

// Límite de intentos guardado en la base: funciona con varias réplicas y no se reinicia al desplegar.
const WINDOW_MS = 15 * 60_000;
const MAX_FAILS = 5;
const since = () => new Date(Date.now() - WINDOW_MS);

export async function isBlocked(key: string) {
  return (await db.rateHit.count({ where: { key, at: { gte: since() } } })) >= MAX_FAILS;
}

export async function anyBlocked(keys: string[]) {
  return (await Promise.all(keys.map(isBlocked))).some(Boolean);
}

export async function recordFailure(key: string) {
  await db.rateHit.create({ data: { key } });
  // Limpieza ocasional de intentos viejos para que la tabla no crezca.
  if (Math.random() < 0.02) await db.rateHit.deleteMany({ where: { at: { lt: new Date(Date.now() - 24 * 3_600_000) } } });
}

export async function clearFailures(key: string) {
  await db.rateHit.deleteMany({ where: { key } });
}
