"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/dal";

export async function setClinicStatus(clinicId: string, status: "ACTIVE" | "TRIAL" | "SUSPENDED"): Promise<void> {
  const admin = await requirePlatformAdmin();
  await db.clinic.update({ where: { id: clinicId }, data: { status } });
  await db.auditLog.create({ data: { userId: admin.id, action: `CLINIC_${status}`, entity: "Clinic", entityId: clinicId } });
  revalidatePath("/plataforma");
}

export async function extendTrial(clinicId: string, days: number): Promise<void> {
  const admin = await requirePlatformAdmin();
  const c = await db.clinic.findUnique({ where: { id: clinicId }, select: { trialEndsAt: true } });
  const from = c?.trialEndsAt && c.trialEndsAt > new Date() ? c.trialEndsAt : new Date();
  await db.clinic.update({ where: { id: clinicId }, data: { status: "TRIAL", trialEndsAt: new Date(from.getTime() + days * 86_400_000) } });
  await db.auditLog.create({ data: { userId: admin.id, action: "TRIAL_EXTEND", entity: "Clinic", entityId: clinicId } });
  revalidatePath("/plataforma");
}
