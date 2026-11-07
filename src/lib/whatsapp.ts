import "server-only";
import { decryptSecret } from "./secrets";

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

export type CloudConfig = { phoneId: string; token: string; template: string; lang: string };

const apiVersion = () => process.env.WHATSAPP_API_VERSION ?? "v21.0";

// Credenciales propias del consultorio: solo si activó el envío automático y tiene número y token guardados.
export function cloudConfig(c: { whatsappAuto: boolean; whatsappPhoneId: string | null; whatsappToken: string | null; whatsappTemplate: string | null; whatsappLang: string | null }): CloudConfig | null {
  if (!c.whatsappAuto || !c.whatsappPhoneId || !c.whatsappToken) return null;
  const token = decryptSecret(c.whatsappToken);
  if (!token) return null;
  return { phoneId: c.whatsappPhoneId, token, template: c.whatsappTemplate || "recordatorio_cita", lang: c.whatsappLang || "es" };
}

// Envío automático con la API de WhatsApp Cloud (Meta) del propio consultorio. Requiere una plantilla de mensaje aprobada
// cuyo cuerpo use cinco variables: {{1}} nombre, {{2}} consultorio, {{3}} fecha, {{4}} hora, {{5}} enlace.
// Con `buttons`, la plantilla lleva dos botones de respuesta rápida (Confirmar / No podré asistir) y solo 4 variables
// ({{1}} nombre, {{2}} consultorio, {{3}} fecha, {{4}} hora); cada botón lleva escondida la clave de la cita.
export async function sendCloudTemplate(cfg: CloudConfig, to: string, p: ReminderParams, buttons?: { token: string }): Promise<{ ok: boolean; error?: string }> {
  const bodyVars = buttons ? [p.nombre, p.clinica, p.fecha, p.hora] : [p.nombre, p.clinica, p.fecha, p.hora, p.enlace];
  const components: unknown[] = [{ type: "body", parameters: bodyVars.map((text) => ({ type: "text", text })) }];
  if (buttons) {
    (["C", "X"] as const).forEach((k, i) => components.push({ type: "button", sub_type: "quick_reply", index: String(i), parameters: [{ type: "payload", payload: `${k}:${buttons.token}` }] }));
  }
  const res = await fetch(`https://graph.facebook.com/${apiVersion()}/${cfg.phoneId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: cfg.template,
        language: { code: cfg.lang },
        components,
      },
    }),
  });
  if (res.ok) return { ok: true };
  const body = await res.text();
  return { ok: false, error: `HTTP ${res.status}: ${body.slice(0, 200)}` };
}

// Consulta el número en Meta para comprobar que el identificador y el token sirven.
export async function checkCloud(phoneId: string, token: string): Promise<{ ok: boolean; number?: string; name?: string; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/${apiVersion()}/${encodeURIComponent(phoneId)}?fields=display_phone_number,verified_name`, { headers: { Authorization: `Bearer ${token}` } });
    const body = (await res.json().catch(() => ({}))) as { display_phone_number?: string; verified_name?: string; error?: { message?: string } };
    if (!res.ok) return { ok: false, error: body.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, number: body.display_phone_number, name: body.verified_name };
  } catch {
    return { ok: false, error: "No se pudo conectar con Meta" };
  }
}

// Credenciales para RESPONDER a un paciente (no depende de que el envío automático esté activo).
export function replyConfig(c: { whatsappPhoneId: string | null; whatsappToken: string | null }): CloudConfig | null {
  if (!c.whatsappPhoneId || !c.whatsappToken) return null;
  const token = decryptSecret(c.whatsappToken);
  return token ? { phoneId: c.whatsappPhoneId, token, template: "", lang: "es" } : null;
}

async function graphSend(cfg: CloudConfig, body: Record<string, unknown>) {
  try {
    const res = await fetch(`https://graph.facebook.com/${apiVersion()}/${cfg.phoneId}/messages`, { method: "POST", headers: { Authorization: `Bearer ${cfg.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ messaging_product: "whatsapp", to: body.to, ...body }) });
    return res.ok;
  } catch {
    return false;
  }
}

// Mensajes dentro de la ventana de 24 h que abre el paciente al tocar un botón.
export const sendWaText = (cfg: CloudConfig, to: string, text: string) => graphSend(cfg, { to, type: "text", text: { body: text } });
export const sendWaButtons = (cfg: CloudConfig, to: string, text: string, buttons: { id: string; title: string }[]) =>
  graphSend(cfg, { to, type: "interactive", interactive: { type: "button", body: { text }, action: { buttons: buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title.slice(0, 20) } })) } } });
