"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";

const schema = z.object({
  patientId: z.string().min(1, "Elige un paciente"),
  startsAt: z.string().min(1, "Elige fecha y hora"),
  minutes: z.coerce.number().int().min(10).max(240),
  reason: z.string().trim().optional(),
});

export type AppointmentState = { error?: string; ok?: boolean } | undefined;

export async function createAppointment(_: AppointmentState, formData: FormData): Promise<AppointmentState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const patient = await db.patient.findFirst({ where: { id: parsed.data.patientId, clinicId: user.clinicId } });
  if (!patient) return { error: "Paciente no encontrado" };

  const startsAt = new Date(parsed.data.startsAt);
  const endsAt = new Date(startsAt.getTime() + parsed.data.minutes * 60_000);

  const overlap = await db.appointment.findFirst({
    where: {
      dentistId: user.id,
      status: { notIn: ["CANCELLED", "NO_SHOW"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
  });
  if (overlap) return { error: "Ya tienes una cita en ese horario" };

  await db.appointment.create({
    data: { clinicId: user.clinicId, patientId: patient.id, dentistId: user.id, startsAt, endsAt, reason: parsed.data.reason || null },
  });
  revalidatePath("/agenda");
  return { ok: true };
}

export async function setStatus(id: string, status: "CONFIRMED" | "ATTENDED" | "CANCELLED" | "NO_SHOW") {
  const user = await requireUser();
  await db.appointment.updateMany({ where: { id, clinicId: user.clinicId }, data: { status } });
  revalidatePath("/agenda");
}
