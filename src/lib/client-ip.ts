import "server-only";
import { headers } from "next/headers";

// IP del visitante tal como la ve el proxy de confianza (Traefik en Coolify).
// El primer valor de X-Forwarded-For lo puede escribir el propio navegador; cada proxy agrega la IP de quien le habló
// al final de la lista. Por eso se cuenta desde el final: con un solo proxy delante (lo normal), es el último valor.
// Si algún día hay otro proxy delante (p. ej. una CDN), define TRUSTED_PROXY_HOPS con el número de proxies.
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const hops = Math.max(1, Number(process.env.TRUSTED_PROXY_HOPS) || 1);
  const list = (h.get("x-forwarded-for") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const ip = list.length ? list[Math.max(0, list.length - hops)] : h.get("x-real-ip")?.trim();
  return ip ? ip.slice(0, 64) : null;
}
