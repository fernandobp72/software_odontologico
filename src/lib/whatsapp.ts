import "server-only";

// Teléfono colombiano a formato internacional sin "+" (ej. 573001234567). null si no es válido.
export function normalizePhone(raw: string | null | undefined): string | null {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length === 10 && d.startsWith("3")) return `57${d}`;
  if (d.length === 12 && d.startsWith("57")) return d;
  return null;
}

export type ReminderParams = { nombre: string; clinica: string; fecha: string; hora: string; enlace: string };

const dateFmt = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", timeZone: "America/Bogota" });
const timeFmt = new Intl.DateTimeFormat("es-CO", { hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

export function reminderParams(a: { startsAt: Date }, patientFirstName: string, clinicName: string, link: string): ReminderParams {
  return { nombre: patientFirstName, clinica: clinicName, fecha: dateFmt.format(a.startsAt), hora: timeFmt.format(a.startsAt), enlace: link };
}

// Texto del recordatorio. No incluye datos de salud (motivo, tratamiento ni diagnóstico).
export function reminderText(p: ReminderParams) {
  return `Hola ${p.nombre}, te recordamos tu cita en ${p.clinica} el ${p.fecha} a las ${p.hora}${p.hora.endsWith(".") ? "" : "."} Confirma o cancela aquí: ${p.enlace}`;
}

export const waLink = (phone: string, text: string) => `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;

export const cloudConfigured = () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_ID);

// Envío automático con la API de WhatsApp Cloud (Meta). Requiere una plantilla de mensaje aprobada
// cuyo cuerpo use cinco variables: {{1}} nombre, {{2}} consultorio, {{3}} fecha, {{4}} hora, {{5}} enlace.
export async function sendCloudTemplate(to: string, p: ReminderParams): Promise<{ ok: boolean; error?: string }> {
  const version = process.env.WHATSAPP_API_VERSION ?? "v21.0";
  const res = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_ID}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE ?? "recordatorio_cita",
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG ?? "es" },
        components: [{ type: "body", parameters: [p.nombre, p.clinica, p.fecha, p.hora, p.enlace].map((text) => ({ type: "text", text })) }],
      },
    }),
  });
  if (res.ok) return { ok: true };
  const body = await res.text();
  return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
}
