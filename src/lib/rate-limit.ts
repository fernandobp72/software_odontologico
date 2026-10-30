// Límite de intentos en memoria (una sola instancia). Si se escala a varias
// réplicas hay que moverlo a la base de datos o a Redis.
const WINDOW_MS = 15 * 60_000;
const MAX_FAILS = 5;
const fails = new Map<string, number[]>();

function recent(key: string) {
  const now = Date.now();
  const list = (fails.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length) fails.set(key, list);
  else fails.delete(key);
  return list;
}

export function isBlocked(key: string) {
  return recent(key).length >= MAX_FAILS;
}

export function recordFailure(key: string) {
  fails.set(key, [...recent(key), Date.now()]);
}

export function clearFailures(key: string) {
  fails.delete(key);
}
