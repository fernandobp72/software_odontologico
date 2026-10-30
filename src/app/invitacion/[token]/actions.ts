"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { hashToken, password } from "@/lib/tokens";

export type AcceptState = { error?: string } | undefined;

export async function accept(token: string, _: AcceptState, fd: FormData): Promise<AcceptState> {
  const parsed = z.object({ name: z.string().trim().min(3, "Escribe tu nombre").max(120), password }).safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const inv = await db.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!inv || inv.acceptedAt || inv.revokedAt || inv.expiresAt < new Date()) return { error: "La invitación venció o ya fue usada. Pide una nueva." };
  if (await db.user.findUnique({ where: { email: inv.email } })) return { error: "Ese correo ya tiene una cuenta" };

  const user = await db.$transaction(async (tx) => {
    // Marcar como usada primero evita que dos personas usen el mismo enlace a la vez.
    const used = await tx.invitation.updateMany({ where: { id: inv.id, acceptedAt: null }, data: { acceptedAt: new Date() } });
    if (used.count === 0) return null;
    const created = await tx.user.create({ data: { clinicId: inv.clinicId, email: inv.email, name: parsed.data.name, role: inv.role, passwordHash: await bcrypt.hash(parsed.data.password, 12) } });
    const branches = await tx.branch.findMany({ where: { clinicId: inv.clinicId, id: { in: inv.branchIds } }, select: { id: true } });
    await tx.userBranch.createMany({ data: branches.map((b) => ({ userId: created.id, branchId: b.id })) });
    return created;
  });
  if (!user) return { error: "La invitación ya fue usada" };
  await db.auditLog.create({ data: { userId: user.id, action: "ACCEPT_INVITE", entity: "User", entityId: user.id } });
  await createSession({ userId: user.id, clinicId: user.clinicId, role: user.role });
  redirect("/agenda");
}
