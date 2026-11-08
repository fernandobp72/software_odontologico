"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireBranch } from "@/lib/dal";
import { branchProfessionals } from "@/lib/professionals";
import { PRE_DOC } from "@/lib/patient-fields";

const schema = z.object({
  patientId: z.string().optional(),
  startsAt: z.string().min(1, "Elige fecha y hora"),
  minutes: z.coerce.number().int().min(10).max(240),
  reason: z.string().trim().optional(),
  dentistId: z.string().optional(),
});

export type AppointmentState = { error?: string; ok?: boolean; newPatient?: { id: string; name: string } } | undefined;

export async function createAppointment(_: AppointmentState, formData: FormData): Promise<AppointmentState> {
  const { user, branch } = await requireBranch();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // El odontólogo agenda para sí mismo; administración y recepción eligen al profesional de la sede.
  const pros = await branchProfessionals(user.clinicId, branch.id);
  const dentistId = user.role === "DENTIST" ? user.id : parsed.data.dentistId || (pros.some((p) => p.id === user.id) ? user.id : "");
  if (!dentistId) return { error: "Elige el profesional que atenderá la cita" };
  if (!pros.some((p) => p.id === dentistId)) return { error: "Ese profesional no atiende en esta sede" };

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

  // Paciente: uno de la lista, o un alta rápida (solo nombre y celular) para quien llama por primera vez.
  let patient: { id: string; firstName: string; lastName: string };
  let created: { id: string; name: string } | undefined;
  if (formData.get("newPatient") === "on") {
    const name = String(formData.get("newName") ?? "").trim().replace(/\s+/g, " ");
    const digits = String(formData.get("newPhone") ?? "").replace(/\D/g, "");
    if (name.length < 2) return { error: "Escribe el nombre de la persona" };
    if (digits.length < 7 || digits.length > 15) return { error: "Escribe un celular o teléfono válido" };
    const tail = digits.slice(-10);
    const withPhone = await db.patient.findMany({ where: { clinicId: user.clinicId, phone: { not: null } }, select: { firstName: true, lastName: true, phone: true } });
    const dup = withPhone.find((p) => (p.phone ?? "").replace(/\D/g, "").slice(-10) === tail);
    if (dup) return { error: `Ya existe ${dup.firstName} ${dup.lastName}`.trim() + " con ese número. Elígelo en la lista de pacientes." };
    const [first, ...rest] = name.split(" ");
    patient = await db.patient.create({
      data: { clinicId: user.clinicId, documentType: PRE_DOC, documentNumber: `PRE-${randomBytes(4).toString("hex").toUpperCase()}`, firstName: first, lastName: rest.join(" "), phone: digits },
      select: { id: true, firstName: true, lastName: true },
    });
    created = { id: patient.id, name };
    await db.auditLog.create({ data: { userId: user.id, action: "CREATE_PRE", entity: "Patient", entityId: patient.id, detail: "alta rápida desde la agenda" } });
  } else {
    const found = await db.patient.findFirst({ where: { id: parsed.data.patientId ?? "", clinicId: user.clinicId }, select: { id: true, firstName: true, lastName: true } });
    if (!found) return { error: "Elige un paciente" };
    patient = found;
  }

  await db.appointment.create({
    data: { clinicId: user.clinicId, branchId: branch.id, patientId: patient.id, dentistId, startsAt, endsAt, reason: parsed.data.reason || null },
  });
  revalidatePath("/agenda");
  revalidatePath("/pacientes");
  return { ok: true, newPatient: created };
}

export async function setStatus(id: string, status: "CONFIRMED" | "ATTENDED" | "CANCELLED" | "NO_SHOW") {
  const { user, branches } = await requireBranch();
  await db.appointment.updateMany({ where: { id, clinicId: user.clinicId, branchId: { in: branches.map((b) => b.id) } }, data: { status } });
  revalidatePath("/agenda");
}

const rescheduleSchema = z.object({
  startsAt: z.string().min(1, "Elige fecha y hora"),
  minutes: z.coerce.number().int().min(10).max(240),
});

export type RescheduleState = { error?: string; ok?: boolean } | undefined;

// Cambia la fecha y hora de una cita: valida cruces con el mismo profesional, la vuelve a dejar
// «Programada» y borra los recordatorios previos para que el aviso salga con el nuevo horario.
export async function rescheduleAppointment(id: string, _: RescheduleState, formData: FormData): Promise<RescheduleState> {
  const { user, branches } = await requireBranch();
  const parsed = rescheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const a = await db.appointment.findFirst({ where: { id, clinicId: user.clinicId, branchId: { in: branches.map((b) => b.id) } } });
  if (!a) return { error: "Cita no encontrada" };
  if (a.status === "ATTENDED") return { error: "Una cita atendida no se puede reprogramar" };

  const startsAt = new Date(parsed.data.startsAt);
  if (Number.isNaN(startsAt.getTime())) return { error: "Fecha no válida" };
  if (startsAt.getTime() < Date.now() - 60_000) return { error: "Elige una fecha y hora futuras" };
  const endsAt = new Date(startsAt.getTime() + parsed.data.minutes * 60_000);

  const overlap = await db.appointment.findFirst({
    where: { id: { not: a.id }, dentistId: a.dentistId, status: { notIn: ["CANCELLED", "NO_SHOW"] }, startsAt: { lt: endsAt }, endsAt: { gt: startsAt } },
  });
  if (overlap) return { error: a.dentistId === user.id ? "Ya tienes una cita en ese horario" : "Ese profesional ya tiene una cita en ese horario" };

  await db.$transaction([
    db.appointment.update({ where: { id: a.id }, data: { startsAt, endsAt, status: "SCHEDULED" } }),
    db.reminder.deleteMany({ where: { appointmentId: a.id } }),
    db.auditLog.create({ data: { userId: user.id, action: "RESCHEDULE", entity: "Appointment", entityId: a.id, detail: `de ${a.startsAt.toISOString()} a ${startsAt.toISOString()}` } }),
  ]);
  revalidatePath("/agenda");
  revalidatePath("/recordatorios");
  revalidatePath(`/pacientes/${a.patientId}`);
  return { ok: true };
}
