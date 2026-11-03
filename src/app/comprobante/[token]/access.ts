import "server-only";
import { createHmac } from "node:crypto";
import { hashToken } from "@/lib/tokens";

// Cookie de acceso al recibo ya desbloqueado: firma del hash del enlace con el secreto del servidor (30 minutos).
export function receiptCookie(token: string) {
  const h = hashToken(token);
  const secret = process.env.SESSION_SECRET ?? "";
  return { name: `cmp_${h.slice(0, 16)}`, value: createHmac("sha256", `receipt:${secret}`).update(h).digest("hex") };
}
