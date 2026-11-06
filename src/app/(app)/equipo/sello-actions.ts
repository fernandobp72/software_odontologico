"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { revokeCredential } from "@/lib/signing";

async function admin() {
  const u = await requireUser();
  if (u.role !== "ADMIN") throw new Error("Solo el administrador");
  return u;
}

// Como pedir un sello físico nuevo: el administrador autoriza y el profesional lo crea. Nadie se autoriza a sí mismo al instante:
// si es el único administrador, la autorización se activa 24 horas después (queda en el registro).
export async function authorizeNewSeal(userId: string): Promise<void> {
  const a = await admin();
  const target = await db.user.findFirst({ where: { id: userId, clinicId: a.clinicId, active: true, role: { not: "RECEPTION" } }, select: { id: true, name: true } });
  if (!target) return;
  const had = await db.signingCredential.count({ where: { userId } });
  const active = await db.signingCredential.count({ where: { userId, revokedAt: null } });
  if (!had || active) return; // solo cuando perdió todos sus dispositivos
  const self = target.id === a.id;
  const startsAt = self ? new Date(Date.now() + 24 * 3_600_000) : new Date();
  await db.signingGrant.updateMany({ where: { userId, usedAt: null }, data: { expiresAt: new Date() } });
  await db.signingGrant.create({ data: { userId, createdById: a.id, startsAt, expiresAt: new Date(startsAt.getTime() + 72 * 3_600_000) } });
  await db.auditLog.create({ data: { userId: a.id, action: "SELLO_GRANT", entity: "User", entityId: userId, detail: `autorizó un sello nuevo para ${target.name}${self ? " (a sí mismo: se activa en 24 horas)" : ""}` } });
  revalidatePath("/equipo");
}

// El administrador retira un dispositivo (la persona lo perdió y no puede entrar, o se retiró del consultorio).
export async function adminRevoke(credentialId: string): Promise<void> {
  const a = await admin();
  const cred = await db.signingCredential.findFirst({ where: { id: credentialId, user: { clinicId: a.clinicId } } });
  if (!cred) return;
  await revokeCredential({ credentialId, byUserId: a.id, reason: "ADMIN" });
  revalidatePath("/equipo");
}

export async function setRequireSello(on: boolean): Promise<void> {
  const a = await admin();
  await db.clinic.update({ where: { id: a.clinicId }, data: { requireSello: on } });
  await db.auditLog.create({ data: { userId: a.id, action: "SELLO_POLICY", entity: "Clinic", entityId: a.clinicId, detail: on ? "exigió firmar con el sello digital" : "dejó de exigir el sello digital" } });
  revalidatePath("/equipo");
}
