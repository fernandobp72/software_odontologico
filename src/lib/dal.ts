import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession, sessionCurrent } from "./session";
import { db } from "./db";

// Verificación real de sesión (el proxy solo hace una comprobación optimista).
// Incluye la cuenta de plataforma; las pantallas clínicas usan requireUser, que la deja fuera.
export const requireAnyUser = cache(async () => {
  const session = await readSession();
  if (!session) redirect("/api/sesion/cerrar");
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, role: true, clinicId: true, active: true, sessionVersion: true, isPlatformAdmin: true, licenseNumber: true, clinic: { select: { id: true, name: true, status: true, trialEndsAt: true, system: true, noun: true, logoUpdatedAt: true, appIconUpdatedAt: true, iconColor: true, requireSello: true } } },
  });
  if (!user || !user.active || !sessionCurrent(session, user)) redirect("/api/sesion/cerrar");
  // Un consultorio suspendido no puede usar el sistema (los datos se conservan).
  if (user.clinic.status === "SUSPENDED") redirect("/suspendida");
  return user;
});

// Las cuentas de plataforma (dueño del negocio) no usan el software clínico: van a su propia zona.
export async function requireUser() {
  const user = await requireAnyUser();
  if (user.clinic.system) redirect("/plataforma");
  return user;
}

// Solo odontólogos y administradores pueden escribir en la historia clínica.
export async function requireClinician() {
  const user = await requireUser();
  if (user.role === "RECEPTION") throw new Error("No autorizado para modificar la historia clínica");
  return user;
}

// Escribir en la historia clínica de un paciente exige además el registro profesional (RETHUS o tarjeta profesional):
// así cada anotación queda a nombre de un profesional identificable, también cuando el administrador no es odontólogo.
export const NO_LICENSE = "Registra tu registro profesional (RETHUS o tarjeta profesional) en «Mis datos» para escribir en la historia clínica.";
export const canWriteClinical = (user: { role: string; licenseNumber: string | null }) => user.role !== "RECEPTION" && !!user.licenseNumber?.trim();

export async function requireClinicalAuthor() {
  const user = await requireClinician();
  if (!canWriteClinical(user)) throw new Error(NO_LICENSE);
  return user;
}

// Variante sin redirección para route handlers: devuelve null si no hay sesión válida.
export async function currentUser() {
  const session = await readSession();
  if (!session) return null;
  const user = await db.user.findUnique({ where: { id: session.userId }, select: { id: true, name: true, role: true, clinicId: true, active: true, sessionVersion: true } });
  return user?.active && sessionCurrent(session, user) ? user : null;
}

export async function requirePlatformAdmin() {
  const user = await requireAnyUser();
  if (!user.isPlatformAdmin) redirect("/agenda");
  return user;
}

export type BranchInfo = { id: string; name: string; address: string | null; phone: string | null };

// Sedes a las que puede entrar la persona: el administrador entra a todas las activas.
export async function allowedBranches(user: { id: string; role: string; clinicId: string }): Promise<BranchInfo[]> {
  return db.branch.findMany({
    where: { clinicId: user.clinicId, active: true, ...(user.role === "ADMIN" ? {} : { users: { some: { userId: user.id } } }) },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, address: true, phone: true },
  });
}

// Sede activa: la que eligió en el selector (cookie) si todavía tiene acceso; si no, la primera.
export const branchState = cache(async () => {
  const user = await requireUser();
  const branches = await allowedBranches(user);
  const wanted = (await cookies()).get("branch")?.value;
  const branch = branches.find((b) => b.id === wanted) ?? branches[0] ?? null;
  return { user, branches, branch };
});

// Para pantallas que dependen de la sede (agenda, caja, recordatorios).
export async function requireBranch() {
  const { user, branches, branch } = await branchState();
  if (!branch) redirect("/sin-sede");
  return { user, branches, branch };
}
