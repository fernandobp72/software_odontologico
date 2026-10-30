"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";

export type ClinicState = { error?: string; ok?: boolean } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del consultorio").max(120),
  nit: z.string().trim().max(30).optional(),
  address: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function saveClinic(_: ClinicState, fd: FormData): Promise<ClinicState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Solo administración puede cambiar estos datos" };
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await db.clinic.update({ where: { id: user.clinicId }, data: { name: d.name, nit: d.nit || null, address: d.address || null, phone: d.phone || null } });
  await db.auditLog.create({ data: { userId: user.id, action: "CLINIC_UPDATE", entity: "Clinic", entityId: user.clinicId } });
  revalidatePath("/configuracion");
  return { ok: true };
}
