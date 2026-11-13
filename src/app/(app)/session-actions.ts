"use server";

import { createSession, readSession, sessionCurrent } from "@/lib/session";
import { db } from "@/lib/db";

// «Seguir conectado»: renueva la sesión de 8 horas sin salir de lo que se está escribiendo.
export async function renewSession(): Promise<{ expiresAt: number } | { error: string }> {
  const s = await readSession();
  if (!s) return { error: "La sesión ya se cerró. Lo que escribiste quedó guardado en este aparato: vuelve a ingresar." };
  const user = await db.user.findUnique({ where: { id: s.userId }, select: { id: true, clinicId: true, role: true, active: true, sessionVersion: true } });
  if (!user?.active || !sessionCurrent(s, user)) return { error: "La sesión ya no es válida. Vuelve a ingresar." };
  await createSession({ userId: user.id, clinicId: user.clinicId, role: user.role, sv: user.sessionVersion });
  return { expiresAt: Date.now() + 8 * 3_600_000 };
}
