import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { readSession } from "./session";
import { db } from "./db";

// Verificación real de sesión (el proxy solo hace una comprobación optimista).
export const requireUser = cache(async () => {
  const session = await readSession();
  if (!session) redirect("/login");
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, clinicId: true, active: true, isPlatformAdmin: true, clinic: { select: { name: true, status: true, trialEndsAt: true } } },
  });
  if (!user || !user.active) redirect("/login");
  // Un consultorio suspendido no puede usar el sistema (los datos se conservan).
  if (user.clinic.status === "SUSPENDED") redirect("/suspendida");
  return user;
});

// Solo odontólogos y administradores pueden escribir en la historia clínica.
export async function requireClinician() {
  const user = await requireUser();
  if (user.role === "RECEPTION") throw new Error("No autorizado para modificar la historia clínica");
  return user;
}

// Variante sin redirección para route handlers: devuelve null si no hay sesión válida.
export async function currentUser() {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, role: true, clinicId: true, active: true } });
  return user?.active ? user : null;
}

export async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) redirect("/agenda");
  return user;
}
