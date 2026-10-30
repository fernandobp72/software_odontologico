"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";

export type BranchState = { error?: string; ok?: boolean } | undefined;

async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new Error("Solo el administrador puede gestionar las sedes");
  return user;
}

const schema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre de la sede").max(80),
  address: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function createBranch(_: BranchState, fd: FormData): Promise<BranchState> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const b = await db.branch.create({ data: { clinicId: admin.clinicId, name: parsed.data.name, address: parsed.data.address || null, phone: parsed.data.phone || null } });
  // El administrador que la crea queda asignado, y los demás se asignan desde Equipo.
  await db.userBranch.create({ data: { userId: admin.id, branchId: b.id } });
  await db.auditLog.create({ data: { userId: admin.id, action: "BRANCH_CREATE", entity: "Branch", entityId: b.id } });
  revalidatePath("/sedes");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateBranch(branchId: string, _: BranchState, fd: FormData): Promise<BranchState> {
  const admin = await requireAdmin();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const r = await db.branch.updateMany({ where: { id: branchId, clinicId: admin.clinicId }, data: { name: parsed.data.name, address: parsed.data.address || null, phone: parsed.data.phone || null } });
  if (!r.count) return { error: "Sede no encontrada" };
  await db.auditLog.create({ data: { userId: admin.id, action: "BRANCH_UPDATE", entity: "Branch", entityId: branchId } });
  revalidatePath("/sedes");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setBranchActive(branchId: string, active: boolean): Promise<void> {
  const admin = await requireAdmin();
  const branch = await db.branch.findFirst({ where: { id: branchId, clinicId: admin.clinicId } });
  if (!branch) return;
  if (!active) {
    // Siempre debe quedar una sede activa, y no se cierra una sede con caja abierta.
    const activeCount = await db.branch.count({ where: { clinicId: admin.clinicId, active: true } });
    const openCash = await db.cashSession.count({ where: { branchId, closedAt: null } });
    if (activeCount <= 1 || openCash > 0) return;
  }
  await db.branch.update({ where: { id: branchId }, data: { active } });
  await db.auditLog.create({ data: { userId: admin.id, action: active ? "BRANCH_ACTIVATE" : "BRANCH_DEACTIVATE", entity: "Branch", entityId: branchId } });
  revalidatePath("/sedes");
  revalidatePath("/", "layout");
}
