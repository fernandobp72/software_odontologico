"use server";

import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { appOrigin } from "@/lib/mail-links";
import { mailBody, sendMail } from "@/lib/mailer";
import { copFmt } from "@/lib/cartera";
import { hashToken, newToken } from "@/lib/tokens";
import { normalizePhone, waLink } from "@/lib/whatsapp";

export type ShareState = { error?: string; ok?: string; whatsapp?: string; link?: string } | undefined;

const DAYS = 30;

// Genera (o renueva) el enlace secreto del recibo. Solo se guarda su huella; el enlace anterior deja de servir.
async function shareUrl(paymentId: string, clinicId: string) {
  const p = await db.payment.findFirst({
    where: { id: paymentId, clinicId },
    select: { id: true, number: true, amount: true, voidedAt: true, patient: { select: { firstName: true, phone: true, email: true } }, clinic: { select: { name: true } } },
  });
  if (!p) return { error: "Recibo no encontrado" } as const;
  if (p.voidedAt) return { error: "El recibo está anulado y no se comparte" } as const;
  const token = newToken();
  await db.payment.update({ where: { id: p.id }, data: { shareTokenHash: hashToken(token), shareExpiresAt: new Date(Date.now() + DAYS * 86_400_000) } });
  return { p, url: `${await appOrigin()}/comprobante/${token}` } as const;
}

const text = (p: { number: number; amount: number; patient: { firstName: string }; clinic: { name: string } }, url: string) =>
  `Hola ${p.patient.firstName}, este es tu recibo de caja N.º ${p.number} por ${copFmt.format(p.amount)} de ${p.clinic.name}: ${url}`;

export async function whatsappReceipt(paymentId: string): Promise<ShareState> {
  const user = await requireUser();
  const r = await shareUrl(paymentId, user.clinicId);
  if ("error" in r) return { error: r.error };
  const phone = normalizePhone(r.p.patient.phone);
  if (!phone) return { error: "El paciente no tiene un celular válido. Agrégalo en Editar." };
  await db.auditLog.create({ data: { userId: user.id, action: "RECEIPT_SHARE", entity: "Payment", entityId: paymentId, detail: "whatsapp" } });
  return { ok: "Se abrió WhatsApp con el mensaje listo", whatsapp: waLink(phone, text(r.p, r.url)) };
}

export async function emailReceipt(paymentId: string): Promise<ShareState> {
  const user = await requireUser();
  const r = await shareUrl(paymentId, user.clinicId);
  if ("error" in r) return { error: r.error };
  const to = r.p.patient.email;
  if (!to) return { error: "El paciente no tiene correo. Agrégalo en Editar." };
  const body = mailBody({
    title: `Recibo de caja N.º ${r.p.number}`,
    paragraphs: [`Hola ${r.p.patient.firstName}, gracias por tu pago de ${copFmt.format(r.p.amount)} en ${r.p.clinic.name}.`, `Puedes ver, imprimir o guardar tu recibo con el botón de abajo. El enlace vence en ${DAYS} días.`],
    button: { label: "Ver mi recibo", url: r.url },
    footer: `Enviado por ${r.p.clinic.name} con su software odontológico.`,
  });
  const res = await sendMail(to, `Recibo de caja N.º ${r.p.number} — ${r.p.clinic.name}`, body);
  if (!res.ok) return { error: `No se pudo enviar el correo: ${res.error}. Puedes copiar el enlace y enviarlo por otro medio.`, link: r.url };
  await db.auditLog.create({ data: { userId: user.id, action: "RECEIPT_SHARE", entity: "Payment", entityId: paymentId, detail: "correo" } });
  return { ok: `Recibo enviado a ${to}` };
}

export async function linkReceipt(paymentId: string): Promise<ShareState> {
  const user = await requireUser();
  const r = await shareUrl(paymentId, user.clinicId);
  if ("error" in r) return { error: r.error };
  await db.auditLog.create({ data: { userId: user.id, action: "RECEIPT_SHARE", entity: "Payment", entityId: paymentId, detail: "enlace" } });
  return { ok: "Enlace listo", link: r.url };
}
