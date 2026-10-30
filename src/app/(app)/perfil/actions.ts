"use server";

import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { password } from "@/lib/tokens";

export type PwState = { error?: string; ok?: boolean } | undefined;

export async function changePassword(_: PwState, fd: FormData): Promise<PwState> {
  const user = await requireUser();
  const next = password.safeParse(fd.get("next"));
  if (!next.success) return { error: next.error.issues[0].message };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
  if (!(await bcrypt.compare(String(fd.get("current") ?? ""), row.passwordHash))) return { error: "La contraseña actual no es correcta" };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await bcrypt.hash(next.data, 12) } });
  await db.auditLog.create({ data: { userId: user.id, action: "PASSWORD_CHANGE", entity: "User", entityId: user.id } });
  return { ok: true };
}
