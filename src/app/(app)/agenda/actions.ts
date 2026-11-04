"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { branchProfessionals } from "@/lib/professionals";

const schema = z.object({
  patientId: z.string().min(1, "Elige un paciente"),
  startsAt: z.string().min(1, "Elige fecha y hora"),
  minutes: z.coerce.number().int().min(10).max(240),
  reason: z.string().trim().optional(),
  dentistId: z.string().optional(),
});

export type AppointmentState = { error?: string; ok?: boolean } | undefined;

export async function createAppointment(_: AppointmentState, formData: FormData): Promise<AppointmentState> {
  const { user, branch } = await requireBranch();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // El odontólogo agenda para sí mismo; administración y recepción eligen al profesional de la sede.
  const pros = await branchProfessionals(user.clinicId, branch.id);
  const dentistId = user.role === "DENTIST" ? user.id : parsed.data.dentistId || (pros.some((p) => p.id === user.id) ? user.id : "");
  if (!dentistId) return { error: "Elige el profesional que atenderá la cita" };
  if (!pros.some((p) => p.id === dentistId)) return { error: "Ese profesional no atiende en esta sede" };

  const patient = await db.patient.findFirst({ where: { id: parsed.data.patientId, clinicId: user.clinicId } });
  if (!patient) return { error: "Paciente no encontrado" };

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(startsAt.getTime() + parsed.data.minutes * 60_000);

  const overlap = await db.appointment.findFirst({
    where: {
      dentistId,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (overlap) return { error: dentistId === user.id ? "Ya tienes una cita en ese horario" : "Ese profesional ya tiene una cita en ese horario" };

  await db.appointment.create({
    data: { clinicId: user.clinicId, branchId: branch.id, patientId: patient.id, dentistId, startsAt, endsAt, reason: parsed.data.reason || null },
  });
  revalidatePath("/agenda");
  return { ok: true };
}

export async function setStatus(id: string, status: "CONFIRMED" | "ATTENDED" | "CANCELLED" | "NO_SHOW") {
  const { user, branches } = await requireBranch();
  await db.appointment.updateMany({ where: { id, clinicId: user.clinicId, branchId: { in: branches.map((b) => b.id) } }, data: { status } });
  revalidatePath("/agenda");
}
