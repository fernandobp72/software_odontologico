"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";

const schema = z.object({
  documentType: z.enum(["CC", "TI", "CE", "RC", "PA", "PT"]),
  documentNumber: z.string().trim().min(3, "Documento inválido"),
  firstName: z.string().trim().min(1, "Falta el nombre"),
  lastName: z.string().trim().min(1, "Falta el apellido"),
  phone: z.string().trim().optional(),
  email: z.union([z.literal(""), z.string().email("Correo inválido")]).optional(),
  eps: z.string().trim().optional(),
  allergies: z.string().trim().optional(),
  consent: z.literal("on", { message: "Se requiere la autorización de tratamiento de datos" }),
});

export type PatientState = { error?: string } | undefined;

export async function createPatient(_: PatientState, formData: FormData): Promise<PatientState> {
  const user = await requireUser();
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { consent, ...data } = parsed.data;
  void consent;

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
    data: { ...data, email: data.email || null, clinicId: user.clinicId, dataConsentAt: new Date() },
  });
  await db.auditLog.create({
    data: { userId: user.id, action: "CREATE", entity: "Patient", entityId: patient.id },
  });
  redirect(`/pacientes/${patient.id}`);
}
