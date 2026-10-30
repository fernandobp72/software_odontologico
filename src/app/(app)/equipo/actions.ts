"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { hashToken, newToken } from "@/lib/tokens";

export type TeamState = { error?: string; ok?: boolean; token?: string; kind?: "invite" | "reset" } | undefined;

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Solo el administrador puede gestionar el equipo");
  return user;
}

const ROLES = ["ADMIN", "DENTIST", "RECEPTION"] as const;

export async function invite(_: TeamState, fd: FormData): Promise<TeamState> {
  const admin = await requireAdmin();
  const parsed = z.object({ email: z.string().trim().toLowerCase().email("Correo inválido"), role: z.enum(ROLES) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) return { error: "Ese correo ya tiene una cuenta" };

  const token = newToken();
  await db.invitation.create({
    data: { clinicId: admin.clinicId, email: parsed.data.email, role: parsed.data.role, tokenHash: hashToken(token), invitedById: admin.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
  });
  await db.auditLog.create({ data: { userId: admin.id, action: "INVITE", entity: "Invitation", entityId: parsed.data.email } });
  revalidatePath("/equipo");
  return { ok: true, token, kind: "invite" };
}

export async function revokeInvitation(id: string): Promise<void> {
  const admin = await requireAdmin();
  await db.invitation.updateMany({ where: { id, clinicId: admin.clinicId, acceptedAt: null, revokedAt: null }, data: { revokedAt: new Date() } });
  revalidatePath("/equipo");
}

async function activeAdmins(clinicId: string) {
  return db.user.count({ where: { clinicId, role: "ADMIN", active: true } });
}

export async function setRole(userId: string, fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const role = z.enum(ROLES).safeParse(fd.get("role"));
  if (!role.success) return;
  const target = await db.user.findFirst({ where: { id: userId, clinicId: admin.clinicId } });
  if (!target) return;
  if (target.role === "ADMIN" && role.data !== "ADMIN" && (await activeAdmins(admin.clinicId)) <= 1) return; // siempre debe quedar un administrador
  await db.user.update({ where: { id: userId }, data: { role: role.data } });
  await db.auditLog.create({ data: { userId: admin.id, action: "ROLE", entity: "User", entityId: userId } });
  revalidatePath("/equipo");
}

export async function setActive(userId: string, active: boolean): Promise<void> {
  const admin = await requireAdmin();
  const target = await db.user.findFirst({ where: { id: userId, clinicId: admin.clinicId } });
  if (!target) return;
  if (!active && (userId === admin.id || (target.role === "ADMIN" && (await activeAdmins(admin.clinicId)) <= 1))) return;
  await db.user.update({ where: { id: userId }, data: { active } });
  await db.auditLog.create({ data: { userId: admin.id, action: active ? "USER_ACTIVATE" : "USER_DEACTIVATE", entity: "User", entityId: userId } });
  revalidatePath("/equipo");
}

// Genera un enlace de un solo uso (24 h) para que la persona defina una contraseña nueva.
export async function createReset(userId: string): Promise<TeamState> {
  const admin = await requireAdmin();
  const target = await db.user.findFirst({ where: { id: userId, clinicId: admin.clinicId } });
  if (!target) return { error: "Usuario no encontrado" };
  const token = newToken();
  await db.passwordReset.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 24 * 3_600_000) } });
  await db.auditLog.create({ data: { userId: admin.id, action: "RESET_LINK", entity: "User", entityId: userId } });
  return { ok: true, token, kind: "reset" };
}
