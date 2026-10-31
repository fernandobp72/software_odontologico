"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAnyUser } from "@/lib/dal";
import { password } from "@/lib/tokens";

export type PwState = { error?: string; ok?: boolean } | undefined;

export async function changePassword(_: PwState, fd: FormData): Promise<PwState> {
  const user = await requireAnyUser();
  const next = password.safeParse(fd.get("next"));
  if (!next.success) return { error: next.error.issues[0].message };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(String(fd.get("current") ?? ""), row.passwordHash))) return { error: "La contraseña actual no es correcta" };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next.data, 12) } });
  await db.auditLog.create({ data: { userId: user.id, action: "PASSWORD_CHANGE", entity: "User", entityId: user.id } });
  return { ok: true };
}

// Nombre (y registro profesional si aplica) de la propia cuenta. El nombre sale en las evoluciones y fórmulas, por eso queda en la auditoría.
export async function saveProfile(_: PwState, fd: FormData): Promise<PwState> {
  const user = await requireAnyUser();
  const name = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ");
  if (name.length < 3) return { error: "Escribe tu nombre completo" };
  if (name.length > 120) return { error: "El nombre es demasiado largo" };
  const license = String(fd.get("license") ?? "").trim();
  if (license.length > 40) return { error: "El registro profesional es demasiado largo" };
  const phone = String(fd.get("phone") ?? "").trim();
  if (phone.length > 30) return { error: "El celular es demasiado largo" };
  const clinical = !user.clinic.system && user.role !== "RECEPTION";
  await db.user.update({ where: { id: user.id }, data: { name, phone: phone || null, ...(clinical ? { licenseNumber: license || null } : {}) } });
  await db.auditLog.create({ data: { userId: user.id, action: "PROFILE_UPDATE", entity: "User", entityId: user.id } });
  revalidatePath("/", "layout");
  return { ok: true };
}

// El correo es el usuario de ingreso: para cambiarlo se pide la contraseña actual.
export async function changeEmail(_: PwState, fd: FormData): Promise<PwState> {
  const user = await requireAnyUser();
  const email = z.string().trim().toLowerCase().email("Correo inválido").safeParse(fd.get("email"));
  if (!email.success) return { error: email.error.issues[0].message };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true, email: true } });
  if (!(await bcrypt.compare(String(fd.get("current") ?? ""), row.passwordHash))) return { error: "La contraseña actual no es correcta" };
  if (email.data === row.email) return { ok: true };
  if (await db.user.findUnique({ where: { email: email.data } })) return { error: "Ese correo ya tiene una cuenta" };
  await db.user.update({ where: { id: user.id }, data: { email: email.data } });
  await db.auditLog.create({ data: { userId: user.id, action: "EMAIL_CHANGE", entity: "User", entityId: user.id } });
  revalidatePath("/", "layout");
  return { ok: true };
}
