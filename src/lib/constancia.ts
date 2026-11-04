import "server-only";
import { db } from "./db";
import { appOrigin } from "./mail-links";
import { mailBody, sendMail } from "./mailer";
import { hashToken, newToken } from "./tokens";

export const CONSTANCIA_DAYS = 60;

const fmt = new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeStyle: "short", timeZone: "America/Bogota" });

// Crea (o renueva) el enlace secreto de la constancia: el anterior deja de servir. Devuelve la dirección completa.
export async function issueConstancia(consentId: string) {
  const token = newToken();
  await db.consent.update({ where: { id: consentId }, data: { receiptTokenHash: hashToken(token), receiptExpiresAt: new Date(Date.now() + CONSTANCIA_DAYS * 86_400_000), receiptFailures: 0 } });
  return `${await appOrigin()}/constancia/${token}`;
}

// Aviso al correo del paciente: corto, con enlace protegido; no lleva el documento ni datos de salud.
export async function emailConstancia(consentId: string, url: string) {
  const c = await db.consent.findUnique({
    where: { id: consentId },
    select: { title: true, signedAt: true, signerName: true, patient: { select: { email: true, clinic: { select: { name: true, phone: true } } } } },
  });
  const to = c?.patient.email;
  if (!c || !to) return { ok: false as const, error: "El paciente no tiene correo" };
  const clinic = c.patient.clinic;
  const body = mailBody({
    title: "Constancia de tu firma",
    paragraphs: [
      `Hola ${c.signerName.split(" ")[0]}, el ${fmt.format(c.signedAt)} se registró tu firma del documento «${c.title}» en ${clinic.name}.`,
      `Si no fuiste tú quien firmó, avísanos de inmediato${clinic.phone ? ` al ${clinic.phone}` : ""}.`,
      `Puedes ver y guardar tu constancia con el botón. Te pedirá los últimos 4 dígitos del documento de quien firmó y el enlace vale ${CONSTANCIA_DAYS} días.`,
    ],
    button: { label: "Ver mi constancia", url },
    footer: `Enviado por ${clinic.name} con su software odontológico.`,
  });
  const r = await sendMail(to, `Constancia de tu firma — ${clinic.name}`, body);
  if (r.ok) await db.consent.update({ where: { id: consentId }, data: { receiptSentAt: new Date(), receiptSentTo: to } });
  return r.ok ? ({ ok: true as const, to }) : ({ ok: false as const, error: r.error ?? "No se pudo enviar" });
}

// Al firmar: se crea el enlace y, si el paciente tiene correo, el aviso sale solo (sin que lo decida una persona).
export async function constanciaAfterSigning(consentId: string) {
  try {
    const url = await issueConstancia(consentId);
    const r = await emailConstancia(consentId, url);
    await db.auditLog.create({ data: { userId: null, action: r.ok ? "CONSTANCIA_SENT" : "CONSTANCIA_NOT_SENT", entity: "Consent", entityId: consentId, detail: r.ok ? "correo" : r.error } });
  } catch (e) {
    console.error("Constancia de firma falló", e);
  }
}
