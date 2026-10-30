"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClinician } from "@/lib/dal";

export type ImageState = { error?: string; ok?: boolean } | undefined;

// La interpretación se escribe una sola vez y queda firmada con fecha (anexo de la historia clínica).
export async function interpretImage(imageId: string, _: ImageState, fd: FormData): Promise<ImageState> {
  const user = await requireClinician();
  const text = String(fd.get("interpretation") ?? "").trim();
  if (text.length < 10) return { error: "Escribe la interpretación (mínimo 10 caracteres)" };
  const img = await db.clinicalImage.findFirst({ where: { id: imageId, patient: { clinicId: user.clinicId }, interpretation: null, voidedAt: null }, select: { id: true, patientId: true } });
  if (!img) return { error: "La imagen ya tiene interpretación o fue anulada" };
  await db.clinicalImage.update({ where: { id: img.id }, data: { interpretation: text.slice(0, 3000), interpretedById: user.id, interpretedAt: new Date() } });
  await db.auditLog.create({ data: { userId: user.id, action: "INTERPRET", entity: "ClinicalImage", entityId: img.id } });
  revalidatePath(`/pacientes/${img.patientId}/imagenes`);
  revalidatePath(`/pacientes/${img.patientId}/imagenes/${img.id}`);
  return { ok: true };
}

// Los archivos no se borran: se anulan con motivo y dejan de mostrarse en la galería.
export async function voidImage(imageId: string, fd: FormData): Promise<void> {
  const user = await requireClinician();
  const reason = String(fd.get("reason") ?? "").trim();
  if (reason.length < 5) return;
  const img = await db.clinicalImage.findFirst({ where: { id: imageId, patient: { clinicId: user.clinicId }, voidedAt: null }, select: { id: true, patientId: true } });
  if (!img) return;
  await db.clinicalImage.update({ where: { id: img.id }, data: { voidedAt: new Date(), voidReason: reason.slice(0, 200) } });
  await db.auditLog.create({ data: { userId: user.id, action: "VOID", entity: "ClinicalImage", entityId: img.id } });
  revalidatePath(`/pacientes/${img.patientId}/imagenes`);
}
