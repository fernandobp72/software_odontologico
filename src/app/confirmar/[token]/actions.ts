"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";

// Acción pública: la autoriza el token secreto de la cita (sin sesión).
export async function respond(token: string, decision: "CONFIRMED" | "CANCELLED"): Promise<void> {
  if (!token || token.length < 16) return;
  const a = await db.appointment.findUnique({ where: { confirmToken: token } });
  if (!a || a.startsAt < new Date() || !["SCHEDULED", "CONFIRMED"].includes(a.status)) return;
  await db.appointment.update({ where: { id: a.id }, data: { status: decision } });
  await db.auditLog.create({ data: { action: `PATIENT_${decision}`, entity: "Appointment", entityId: a.id } });
  revalidatePath(`/confirmar/${token}`);
  revalidatePath("/agenda");
  revalidatePath("/recordatorios");
}
