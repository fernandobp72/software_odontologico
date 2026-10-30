"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { hashToken, password } from "@/lib/tokens";

export type ResetState = { error?: string } | undefined;

export async function resetPassword(token: string, _: ResetState, fd: FormData): Promise<ResetState> {
  const pw = password.safeParse(fd.get("password"));
  if (!pw.success) return { error: pw.error.issues[0].message };
  const r = await db.passwordReset.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
  if (!r || r.usedAt || r.expiresAt < new Date() || !r.user.active) return { error: "El enlace venció o ya fue usado. Pide uno nuevo." };

  const used = await db.passwordReset.updateMany({ where: { id: r.id, usedAt: null }, data: { usedAt: new Date() } });
  if (used.count === 0) return { error: "El enlace ya fue usado" };
  await db.user.update({ where: { id: r.userId }, data: { passwordHash: await bcrypt.hash(pw.data, 12) } });
  await db.auditLog.create({ data: { userId: r.userId, action: "PASSWORD_RESET", entity: "User", entityId: r.userId } });
  await createSession({ userId: r.user.id, clinicId: r.user.clinicId, role: r.user.role });
  redirect("/agenda");
}
