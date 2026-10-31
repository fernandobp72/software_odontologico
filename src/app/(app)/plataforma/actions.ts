"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/dal";
import { hashToken, newToken } from "@/lib/tokens";
import { mailConfigured } from "@/lib/mailer";
import { sendResetEmail } from "@/lib/mail-links";

export type SupportState = { error?: string; ok?: boolean; token?: string } | undefined;

const STATUS_LABEL = { ACTIVE: "activó", TRIAL: "pasó a prueba", SUSPENDED: "suspendió" } as const;

async function log(userId: string, action: string, entity: string, entityId: string, detail: string) {
  await db.auditLog.create({ data: { userId, action, entity, entityId, detail } });
}

export async function setClinicStatus(clinicId: string, status: "ACTIVE" | "TRIAL" | "SUSPENDED"): Promise<void> {
  const admin = await requirePlatformAdmin();
  const c = await db.clinic.update({ where: { id: clinicId, system: false }, data: { status } });
  await log(admin.id, `CLINIC_${status}`, "Clinic", clinicId, `${STATUS_LABEL[status]} a ${c.name}`);
  revalidatePath("/plataforma");
  revalidatePath(`/plataforma/${clinicId}`);
}

export async function extendTrial(clinicId: string, days: number): Promise<void> {
  const admin = await requirePlatformAdmin();
  const c = await db.clinic.findFirst({ where: { id: clinicId, system: false }, select: { name: true, trialEndsAt: true } });
  if (!c) return;
  const from = c.trialEndsAt && c.trialEndsAt > new Date() ? c.trialEndsAt : new Date();
  await db.clinic.update({ where: { id: clinicId }, data: { status: "TRIAL", trialEndsAt: new Date(from.getTime() + days * 86_400_000) } });
  await log(admin.id, "TRIAL_EXTEND", "Clinic", clinicId, `dio ${days} días de prueba a ${c.name}`);
  revalidatePath("/plataforma");
  revalidatePath(`/plataforma/${clinicId}`);
}

// Solo personas de consultorios clientes; las cuentas de plataforma no se tocan desde aquí.
async function clientUser(userId: string) {
  return db.user.findFirst({ where: { id: userId, clinic: { system: false } }, select: { id: true, name: true, email: true, clinicId: true, active: true, clinic: { select: { name: true } } } });
}

// Enlace de un solo uso (24 h) para que la persona defina una contraseña nueva. Nunca se ve ni se fija una contraseña.
export async function supportReset(userId: string): Promise<SupportState> {
  const admin = await requirePlatformAdmin();
  const t = await clientUser(userId);
  if (!t) return { error: "Usuario no encontrado" };
  const token = newToken();
  await db.passwordReset.create({ data: { userId, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 24 * 3_600_000) } });
  await log(admin.id, "PLATFORM_RESET_LINK", "User", userId, `generó enlace de restablecimiento para ${t.email} (${t.clinic.name})`);
  return { ok: true, token };
}

// Manda el enlace de restablecimiento al correo de la persona (24 h).
export async function supportEmailReset(userId: string): Promise<SupportState> {
  const admin = await requirePlatformAdmin();
  const t = await clientUser(userId);
  if (!t) return { error: "Usuario no encontrado" };
  if (!(await mailConfigured())) return { error: "Configura primero el correo de la plataforma (menú Correo)" };
  const r = await sendResetEmail({ id: t.id, email: t.email, name: t.name }, 24);
  if (!r.ok) return { error: `No se pudo enviar: ${r.error}` };
  await log(admin.id, "PLATFORM_RESET_EMAIL", "User", userId, `envió por correo el enlace de restablecimiento a ${t.email} (${t.clinic.name})`);
  return { ok: true };
}

export async function supportSetActive(userId: string, active: boolean): Promise<void> {
  const admin = await requirePlatformAdmin();
  const t = await clientUser(userId);
  if (!t) return;
  await db.user.update({ where: { id: userId }, data: { active } });
  await log(admin.id, active ? "PLATFORM_USER_ACTIVATE" : "PLATFORM_USER_DEACTIVATE", "User", userId, `${active ? "reactivó" : "desactivó"} a ${t.email} (${t.clinic.name})`);
  revalidatePath(`/plataforma/${t.clinicId}`);
}

export async function supportChangeEmail(userId: string, _: SupportState, fd: FormData): Promise<SupportState> {
  const admin = await requirePlatformAdmin();
  const parsed = z.string().trim().toLowerCase().email("Correo inválido").safeParse(fd.get("email"));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const t = await clientUser(userId);
  if (!t) return { error: "Usuario no encontrado" };
  if (await db.user.findUnique({ where: { email: parsed.data } })) return { error: "Ese correo ya tiene una cuenta" };
  await db.user.update({ where: { id: userId }, data: { email: parsed.data } });
  await log(admin.id, "PLATFORM_EMAIL_CHANGE", "User", userId, `cambió el correo de ${t.email} a ${parsed.data} (${t.clinic.name})`);
  revalidatePath(`/plataforma/${t.clinicId}`);
  return { ok: true };
}

export async function supportRevokeInvitation(id: string): Promise<void> {
  const admin = await requirePlatformAdmin();
  const inv = await db.invitation.findFirst({ where: { id, clinic: { system: false }, acceptedAt: null, revokedAt: null }, include: { clinic: { select: { name: true } } } });
  if (!inv) return;
  await db.invitation.update({ where: { id }, data: { revokedAt: new Date() } });
  await log(admin.id, "PLATFORM_INVITE_REVOKE", "Invitation", id, `anuló la invitación de ${inv.email} (${inv.clinic.name})`);
  revalidatePath(`/plataforma/${inv.clinicId}`);
}

// Eliminación definitiva. La historia clínica se conserva por ley (Res. 839 de 2017, 15 años), así que un cliente con pacientes
// no se borra: se suspende. Solo se eliminan cuentas sin pacientes (pruebas abandonadas, registros de ensayo).
export async function deleteClinic(clinicId: string, _: SupportState, fd: FormData): Promise<SupportState> {
  const admin = await requirePlatformAdmin();
  const c = await db.clinic.findFirst({ where: { id: clinicId, system: false }, select: { name: true, _count: { select: { patients: true } } } });
  if (!c) return { error: "Cliente no encontrado" };
  if (c._count.patients > 0) return { error: "Tiene pacientes con historia clínica, que debe conservarse. Suspéndelo en su lugar." };
  if (String(fd.get("confirm") ?? "").trim().toLowerCase() !== c.name.trim().toLowerCase()) return { error: "Escribe el nombre exacto para confirmar" };
  try {
    await db.$transaction([
      db.passwordReset.deleteMany({ where: { user: { clinicId } } }),
      db.invitation.deleteMany({ where: { clinicId } }),
      db.cashSession.deleteMany({ where: { clinicId } }),
      db.clinicProcedure.deleteMany({ where: { clinicId } }),
      db.userBranch.deleteMany({ where: { branch: { clinicId } } }),
      db.appointment.deleteMany({ where: { clinicId } }),
      db.user.deleteMany({ where: { clinicId } }),
      db.branch.deleteMany({ where: { clinicId } }),
      db.clinic.delete({ where: { id: clinicId } }),
    ]);
  } catch {
    return { error: "Tiene registros asociados que impiden borrarlo. Suspéndelo en su lugar." };
  }
  await log(admin.id, "PLATFORM_CLINIC_DELETE", "Clinic", clinicId, `eliminó definitivamente a ${c.name} (sin pacientes)`);
  revalidatePath("/plataforma");
  redirect("/plataforma");
}

// Un usuario solo se borra si no dejó registros (evoluciones, cobros, imágenes…); si los dejó se desactiva.
export async function supportDeleteUser(userId: string): Promise<SupportState> {
  const admin = await requirePlatformAdmin();
  const t = await clientUser(userId);
  if (!t) return { error: "Usuario no encontrado" };
  const full = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { role: true, active: true } });
  if (full.role === "ADMIN" && full.active && (await db.user.count({ where: { clinicId: t.clinicId, role: "ADMIN", active: true, id: { not: userId } } })) === 0) {
    return { error: "Es el único administrador activo. Suspende el cliente o crea otro administrador antes." };
  }
  try {
    await db.$transaction([
      db.passwordReset.deleteMany({ where: { userId } }),
      db.userBranch.deleteMany({ where: { userId } }),
      db.invitation.deleteMany({ where: { invitedById: userId } }),
      db.user.delete({ where: { id: userId } }),
    ]);
  } catch {
    return { error: "Esa persona tiene registros clínicos o de caja a su nombre. Desactívala en su lugar." };
  }
  await log(admin.id, "PLATFORM_USER_DELETE", "User", userId, `eliminó a ${t.email} (${t.clinic.name})`);
  revalidatePath(`/plataforma/${t.clinicId}`);
  return { ok: true };
}
