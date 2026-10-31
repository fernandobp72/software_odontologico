"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { hashToken, newToken } from "@/lib/tokens";
import { mailConfigured } from "@/lib/mailer";
import { sendInviteEmail, sendResetEmail } from "@/lib/mail-links";

export type TeamState = { error?: string; ok?: boolean; token?: string; kind?: "invite" | "reset"; emailed?: string } | undefined;

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Solo el administrador puede gestionar el equipo");
  return user;
}

const ROLES = ["ADMIN", "DENTIST", "RECEPTION"] as const;
const ROLE_NAMES = { ADMIN: "administrador", DENTIST: "odontólogo", RECEPTION: "recepción" } as const;

export async function invite(_: TeamState, fd: FormData): Promise<TeamState> {
  const admin = await requireAdmin();
  const parsed = z.object({ email: z.string().trim().toLowerCase().email("Correo inválido"), role: z.enum(ROLES) }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  if (await db.user.findUnique({ where: { email: parsed.data.email } })) return { error: "Ese correo ya tiene una cuenta" };
  const wanted = fd.getAll("branchIds").map(String);
  const valid = await db.branch.findMany({ where: { clinicId: admin.clinicId, active: true, id: { in: wanted } }, select: { id: true } });
  if (parsed.data.role !== "ADMIN" && valid.length === 0) return { error: "Elige al menos una sede para esta persona" };

  const token = newToken();
  await db.invitation.create({
    data: { clinicId: admin.clinicId, email: parsed.data.email, role: parsed.data.role, tokenHash: hashToken(token), branchIds: valid.map((b) => b.id), invitedById: admin.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
  });
  await db.auditLog.create({ data: { userId: admin.id, action: "INVITE", entity: "Invitation", entityId: parsed.data.email } });
  revalidatePath("/equipo");
  // Si lo pidió y el correo de la plataforma está configurado, la invitación sale por correo; el enlace se muestra igual por si acaso.
  if (fd.get("sendEmail") === "on" && (await mailConfigured())) {
    const clinic = await db.clinic.findUniqueOrThrow({ where: { id: admin.clinicId }, select: { name: true } });
    const r = await sendInviteEmail({ to: parsed.data.email, clinic: clinic.name, role: ROLE_NAMES[parsed.data.role], token });
    return { ok: true, token, kind: "invite", emailed: r.ok ? parsed.data.email : undefined, error: r.ok ? undefined : `La invitación se creó, pero el correo no salió: ${r.error}` };
  }
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

// El administrador corrige el nombre, el correo, el celular y el registro profesional de cualquier persona de su equipo.
export async function updatePerson(userId: string, fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const target = await db.user.findFirst({ where: { id: userId, clinicId: admin.clinicId } });
  if (!target) return;
  const name = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ");
  const license = String(fd.get("license") ?? "").trim();
  const phone = String(fd.get("phone") ?? "").trim();
  const email = z.string().trim().toLowerCase().email().safeParse(fd.get("email"));
  if (name.length < 3 || name.length > 120 || license.length > 40 || phone.length > 30 || !email.success) return;
  // El correo es el usuario de ingreso: no puede repetirse con otra cuenta.
  if (email.data !== target.email && (await db.user.findUnique({ where: { email: email.data } }))) return;
  await db.user.update({ where: { id: userId }, data: { name, phone: phone || null, email: email.data, licenseNumber: target.role === "RECEPTION" ? null : license || null } });
  await db.auditLog.create({ data: { userId: admin.id, action: "USER_UPDATE", entity: "User", entityId: userId } });
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

// Manda por correo el enlace para restablecer la contraseña de una persona del equipo.
export async function emailReset(userId: string): Promise<TeamState> {
  const admin = await requireAdmin();
  if (!(await mailConfigured())) return { error: "El envío de correos aún no está activado en la plataforma" };
  const target = await db.user.findFirst({ where: { id: userId, clinicId: admin.clinicId, active: true } });
  if (!target) return { error: "Usuario no encontrado" };
  const r = await sendResetEmail(target, 24);
  await db.auditLog.create({ data: { userId: admin.id, action: "RESET_EMAIL", entity: "User", entityId: userId } });
  return r.ok ? { ok: true, emailed: target.email } : { error: `No se pudo enviar: ${r.error}` };
}

// Sedes a las que puede entrar una persona (el administrador entra a todas, no necesita asignación).
export async function setUserBranches(userId: string, fd: FormData): Promise<void> {
  const admin = await requireAdmin();
  const target = await db.user.findFirst({ where: { id: userId, clinicId: admin.clinicId } });
  if (!target) return;
  const wanted = fd.getAll("branchIds").map(String);
  const valid = await db.branch.findMany({ where: { clinicId: admin.clinicId, id: { in: wanted } }, select: { id: true } });
  await db.$transaction([
    db.userBranch.deleteMany({ where: { userId } }),
    db.userBranch.createMany({ data: valid.map((b) => ({ userId, branchId: b.id })) }),
  ]);
  await db.auditLog.create({ data: { userId: admin.id, action: "USER_BRANCHES", entity: "User", entityId: userId } });
  revalidatePath("/equipo");
}
