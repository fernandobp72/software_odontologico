"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { dataFor, patientSchema } from "@/lib/patient-fields";

const schema = patientSchema.extend({
  consent: z.literal("on", { message: "Se requiere la autorización de tratamiento de datos" }),
  whatsapp: z.literal("on").optional(),
});

export type PatientState = { error?: string } | undefined;

export async function createPatient(_: PatientState, formData: FormData): Promise<PatientState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { consent, whatsapp, ...input } = parsed.data;
  void consent;
  const data = dataFor(input);

  const exists = await db.patient.findUnique({
    where: {
      clinicId_documentType_documentNumber: {
        clinicId: user.clinicId,
        documentType: data.documentType,
        documentNumber: data.documentNumber,
      },
    },
  });
  if (exists) return { error: "Ya existe un paciente con ese documento" };

  const patient = await db.patient.create({
    data: { ...data, clinicId: user.clinicId, dataConsentAt: new Date(), whatsappOptInAt: whatsapp ? new Date() : null },
  });
  await db.auditLog.create({
    data: { userId: user.id, action: "CREATE", entity: "Patient", entityId: patient.id },
  });
  redirect(`/pacientes/${patient.id}`);
}

export type EditState = { error?: string; ok?: boolean } | undefined;

// Corrige los datos de identificación y contacto. No toca la historia clínica; el cambio queda en la auditoría.
export async function updatePatient(patientId: string, _: EditState, formData: FormData): Promise<EditState> {
  const user = await requireUser();
  const parsed = patientSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const current = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId }, select: { id: true } });
  if (!current) return { error: "Paciente no encontrado" };
  const data = dataFor(parsed.data);
  const clash = await db.patient.findFirst({ where: { clinicId: user.clinicId, documentType: data.documentType, documentNumber: data.documentNumber, id: { not: patientId } }, select: { id: true } });
  if (clash) return { error: "Ya existe otro paciente con ese documento" };
  await db.patient.update({ where: { id: patientId }, data });
  await db.auditLog.create({ data: { userId: user.id, action: "UPDATE", entity: "Patient", entityId: patientId } });
  revalidatePath(`/pacientes/${patientId}`, "layout");
  revalidatePath("/pacientes");
  redirect(`/pacientes/${patientId}`);
}
