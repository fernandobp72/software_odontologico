"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { ensureToken } from "@/lib/reminders";

// Registra que el recordatorio se envió a mano y devuelve el token de confirmación de la cita.
export async function prepareManualReminder(appointmentId: string): Promise<{ token?: string; error?: string }> {
  const user = await requireUser();
  const a = await db.appointment.findFirst({ where: { id: appointmentId, clinicId: user.clinicId }, include: { patient: { select: { whatsappOptInAt: true } } } });
  if (!a) return { error: "Cita no encontrada" };
  if (!a.patient.whatsappOptInAt) return { error: "El paciente no autorizó recordatorios por WhatsApp" };
  return { token: await ensureToken(a.id, a.confirmToken) };
}

export async function markReminderSent(appointmentId: string): Promise<void> {
  const user = await requireUser();
  const a = await db.appointment.findFirst({ where: { id: appointmentId, clinicId: user.clinicId }, select: { id: true } });
  if (!a) return;
  await db.reminder.create({ data: { appointmentId: a.id, channel: "MANUAL", status: "SENT" } });
  await db.auditLog.create({ data: { userId: user.id, action: "REMINDER", entity: "Appointment", entityId: a.id } });
  revalidatePath("/recordatorios");
  revalidatePath("/agenda");
}

export async function setWhatsappOptIn(patientId: string, enabled: boolean): Promise<void> {
  const user = await requireUser();
  const p = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId }, select: { id: true } });
  if (!p) return;
  await db.patient.update({ where: { id: p.id }, data: { whatsappOptInAt: enabled ? new Date() : null } });
  await db.auditLog.create({ data: { userId: user.id, action: enabled ? "OPTIN_WA" : "OPTOUT_WA", entity: "Patient", entityId: p.id } });
  revalidatePath(`/pacientes/${p.id}`);
  revalidatePath("/recordatorios");
}
