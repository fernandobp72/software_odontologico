import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { headers } from "next/headers";
import { readSession } from "@/lib/session";
import { hashToken } from "@/lib/tokens";

export const MAX_FAILURES = 5;

// Cookie de acceso a la firma ya desbloqueada con el documento: firma del hash del enlace con el secreto del servidor (30 minutos).
export function signCookie(token: string) {
  const h = hashToken(token);
  const secret = process.env.SESSION_SECRET ?? "";
  return { name: `fir_${h.slice(0, 16)}`, value: createHmac("sha256", `consent-sign:${secret}`).update(h).digest("hex") };
}

// Últimos 4 dígitos (o de letras y números si el documento no es numérico).
export const last4 = (doc: string | null | undefined) => {
  const d = (doc ?? "").replace(/\D/g, "");
  return d.length >= 4 ? d.slice(-4) : "";
};

// Constancia técnica de la firma: desde qué red y con qué aparato se hizo.
export async function evidence() {
  const h = await headers();
  const ip = (h.get("cf-connecting-ip") ?? h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "").trim().slice(0, 64) || null;
  const agent = (h.get("user-agent") ?? "").slice(0, 300) || null;
  return { ip, agent };
}

// Una sesión abierta del consultorio no puede firmar por el paciente: el documento se firma en el celular del paciente.
export const STAFF_BLOCK = "Este documento se firma en el celular del paciente. No se puede firmar desde un navegador con la sesión del consultorio abierta.";
export const staffSession = async () => !!(await readSession());

export async function unlocked(token: string) {
  const want = signCookie(token);
  const got = (await cookies()).get(want.name)?.value ?? "";
  return got.length === want.value.length && timingSafeEqual(Buffer.from(got), Buffer.from(want.value));
}
