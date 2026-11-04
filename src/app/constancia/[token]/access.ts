import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { hashToken } from "@/lib/tokens";

export const MAX_FAILURES = 5;

// Cookie de acceso a la constancia ya desbloqueada con el documento: firma del hash del enlace con el secreto del servidor (30 minutos).
export function constanciaCookie(token: string) {
  const h = hashToken(token);
  return { name: `con_${h.slice(0, 16)}`, value: createHmac("sha256", `constancia:${process.env.SESSION_SECRET ?? ""}`).update(h).digest("hex") };
}

export async function constanciaUnlocked(token: string) {
  const want = constanciaCookie(token);
  const got = (await cookies()).get(want.name)?.value ?? "";
  return got.length === want.value.length && timingSafeEqual(Buffer.from(got), Buffer.from(want.value));
}

export const last4 = (doc: string | null | undefined) => {
  const d = (doc ?? "").replace(/\D/g, "");
  return d.length >= 4 ? d.slice(-4) : "";
};
