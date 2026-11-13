"use server";

import { PRE_BLOCK, isPreRegistered } from "@/lib/patient-fields";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { appOrigin } from "@/lib/mail-links";
import { hashToken, newToken } from "@/lib/tokens";
import { normalizePhone, waLink } from "@/lib/whatsapp";
import { z } from "zod";
import { db } from "@/lib/db";
import { sealConsent } from "@/lib/seal";
import { CONSTANCIA_DAYS, constanciaAfterSigning, emailConstancia, issueConstancia } from "@/lib/constancia";
import { requireClinicalAuthor } from "@/lib/dal";
import { CONSENT_TEMPLATES, CONSENT_VERSION, buildConsentBody } from "@/lib/consents";

export type ConsentState = { error?: string; ok?: boolean } | undefined;
export type RequestState = { error?: string; link?: string; qr?: string; whatsapp?: string; expiresAt?: string; method?: "QR" | "ENLACE" } | undefined;

const schema = z.object({
  templateId: z.string().min(1),
  procedureNote: z.string().trim().max(300).optional(),
  signerName: z.string().trim().min(3, "Escribe el nombre de quien firma").max(120),
  signerDocument: z.string().trim().max(30).optional(),
  signerRelation: z.enum(["Paciente", "Padre o madre", "Representante legal", "Acudiente"]),
  witnessName: z.string().trim().max(120).optional(),
  signature: z.string().startsWith("data:image/png;base64,", "Falta la firma").max(400_000, "La firma es demasiado grande"),
});

export async function signConsent(patientId: string, _: ConsentState, fd: FormData): Promise<ConsentState> {
  const user = await requireClinicalAuthor();
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId } });
  if (!patient) return { error: "Paciente no encontrado" };
  if (isPreRegistered(patient)) return { error: PRE_BLOCK };
  const dentist = await db.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const template = CONSENT_TEMPLATES.find((t) => t.id === d.templateId);
  if (!template) return { error: "Plantilla inválida" };

  const body = buildConsentBody(template, {
    paciente: `${patient.firstName} ${patient.lastName}`,
    documento: `${patient.documentType} ${patient.documentNumber}`,
    profesional: dentist?.name ?? "el profesional tratante",
    procedimiento: d.procedureNote || undefined,
  });

  const row = await db.consent.create({
    data: {
      patientId,
      dentistId: user.id,
      templateId: template.id,
      templateVersion: CONSENT_VERSION,
      title: template.title,
      body,
      procedureNote: d.procedureNote || null,
      signerName: d.signerName,
      signerDocument: d.signerDocument || null,
      signerRelation: d.signerRelation,
      witnessName: d.witnessName || null,
      signature: d.signature,
    },
  });
  await sealConsent(row.id);
  await constanciaAfterSigning(row.id);
  await db.auditLog.create({ data: { userId: user.id, action: "SIGN", entity: "Consent", entityId: row.id } });
  revalidatePath(`/pacientes/${patientId}/consentimientos`);
  return { ok: true };
}

// ---- Firma del paciente en su propio celular (QR en el consultorio o enlace a distancia) ----

const HOURS = { QR: 2, ENLACE: 48 } as const;
const digitsOf = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "");

const requestSchema = schema.omit({ signature: true, witnessName: true }).extend({ method: z.enum(["QR", "ENLACE"]) });

export async function requestConsentSignature(patientId: string, _: RequestState, fd: FormData): Promise<RequestState> {
  const user = await requireClinicalAuthor();
  const parsed = requestSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const patient = await db.patient.findFirst({ where: { id: patientId, clinicId: user.clinicId }, include: { clinic: { select: { name: true } } } });
  if (!patient) return { error: "Paciente no encontrado" };
  if (isPreRegistered(patient)) return { error: PRE_BLOCK };
  const template = CONSENT_TEMPLATES.find((t) => t.id === d.templateId);
  if (!template) return { error: "Plantilla inválida" };
  // El documento de quien firma es la clave de acceso: hacen falta al menos 4 dígitos.
  const gateDoc = d.signerDocument || `${patient.documentType} ${patient.documentNumber}`;
  if (digitsOf(gateDoc).length < 4) return { error: "El documento de quien firma debe tener al menos 4 números: es la clave de acceso del paciente" };
  const dentist = await db.user.findUnique({ where: { id: user.id }, select: { name: true } });
  const body = buildConsentBody(template, {
    paciente: `${patient.firstName} ${patient.lastName}`,
    documento: `${patient.documentType} ${patient.documentNumber}`,
    profesional: dentist?.name ?? "el profesional tratante",
    procedimiento: d.procedureNote || undefined,
  });
  const token = newToken();
  const expiresAt = new Date(Date.now() + HOURS[d.method] * 3_600_000);
  const row = await db.consentRequest.create({
    data: {
      clinicId: user.clinicId, patientId, dentistId: user.id, templateId: template.id, templateVersion: CONSENT_VERSION, title: template.title, body,
      procedureNote: d.procedureNote || null, signerName: d.signerName, signerDocument: gateDoc, signerRelation: d.signerRelation, method: d.method, tokenHash: hashToken(token), expiresAt,
    },
  });
  await db.auditLog.create({ data: { userId: user.id, action: "CONSENT_REQUEST", entity: "ConsentRequest", entityId: row.id, detail: d.method === "QR" ? "QR en el consultorio" : "enlace a distancia" } });
  const link = `${await appOrigin()}/firmar/${token}`;
  const phone = normalizePhone(patient.phone);
  const hint = `Te pedirá los últimos 4 dígitos del documento de quien firma. Vence en ${HOURS[d.method]} horas.`;
  revalidatePath(`/pacientes/${patientId}/consentimientos`);
  return {
    link, method: d.method, expiresAt: expiresAt.toISOString(),
    qr: d.method === "QR" ? await QRCode.toString(link, { type: "svg", margin: 1, width: 260 }) : undefined,
    whatsapp: d.method === "ENLACE" && phone ? waLink(phone, `Hola ${patient.firstName}, ${patient.clinic.name} te envía "${template.title}" para que lo leas y lo firmes desde tu celular: ${link}\n${hint}`) : undefined,
  };
}

export async function cancelConsentRequest(requestId: string): Promise<void> {
  const user = await requireClinicalAuthor();
  const r = await db.consentRequest.updateMany({ where: { id: requestId, clinicId: user.clinicId, consentId: null, cancelledAt: null }, data: { cancelledAt: new Date() } });
  if (r.count) await db.auditLog.create({ data: { userId: user.id, action: "CONSENT_REQUEST_CANCEL", entity: "ConsentRequest", entityId: requestId } });
  revalidatePath("/pacientes", "layout");
}

// ---- Constancia para el paciente: reenviar o entregar por otro medio ----

export type ConstanciaResult = { error?: string; ok?: string; link?: string; whatsapp?: string } | undefined;

// Cada envío crea un enlace nuevo y el anterior deja de servir.
export async function sendConstancia(consentId: string, channel: "correo" | "whatsapp" | "enlace"): Promise<ConstanciaResult> {
  const user = await requireClinicalAuthor();
  const c = await db.consent.findFirst({
    where: { id: consentId, patient: { clinicId: user.clinicId } },
    select: { id: true, title: true, patientId: true, patient: { select: { firstName: true, phone: true, email: true, clinic: { select: { name: true } } } } },
  });
  if (!c) return { error: "Consentimiento no encontrado" };
  const url = await issueConstancia(c.id);
  await db.auditLog.create({ data: { userId: user.id, action: "CONSTANCIA_RESEND", entity: "Consent", entityId: c.id, detail: channel } });
  revalidatePath(`/pacientes/${c.patientId}/consentimientos`);
  if (channel === "correo") {
    const r = await emailConstancia(c.id, url);
    return r.ok ? { ok: `Constancia enviada a ${r.to}` } : { error: `No se pudo enviar el correo: ${r.error}. Puedes usar WhatsApp o copiar el enlace.` };
  }
  if (channel === "whatsapp") {
    const phone = normalizePhone(c.patient.phone);
    if (!phone) return { error: "El paciente no tiene un celular válido en su ficha" };
    return { ok: "Se abrió WhatsApp con el mensaje listo", whatsapp: waLink(phone, `Hola ${c.patient.firstName}, ${c.patient.clinic.name} te envía la constancia de tu firma de «${c.title}»: ${url}\nTe pedirá los últimos 4 dígitos del documento de quien firmó. Vale ${CONSTANCIA_DAYS} días.`) };
  }
  return { ok: "Enlace listo", link: url };
}
