import "server-only";
import { randomBytes } from "node:crypto";
import { db } from "./db";

// Cada cita tiene un enlace público de confirmación con un token aleatorio.
export async function ensureToken(appointmentId: string, current: string | null) {
  if (current) return current;
  const token = randomBytes(18).toString("base64url");
  await db.appointment.update({ where: { id: appointmentId }, data: { confirmToken: token } });
  return token;
}

export function baseUrl(fallback?: string) {
  return (process.env.APP_URL ?? fallback ?? "").replace(/\/$/, "");
}
