import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { decryptSecret } from "./secrets";
import { replyConfig, sendWaButtons, sendWaText } from "./whatsapp";

// Respuestas de los pacientes a los botones del recordatorio (webhook de WhatsApp Cloud).
// Los botones traen una clave «C:<token>» (confirmar), «X:<token>» (quiere cancelar → se pide confirmación),
// «Y:<token>» (sí, cancelar) o «N:<token>» (no, mantener). El token es el secreto de la cita.

export function validSignature(raw: string, header: string | null, appSecret: string) {
  const given = (header ?? "").replace(/^sha256=/, "");
  const want = createHmac("sha256", appSecret).update(raw).digest("hex");
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

type Msg = { from?: string; type?: string; button?: { payload?: string }; interactive?: { button_reply?: { id?: string } } };
type Payload = { entry?: { changes?: { value?: { messages?: Msg[] } }[] }[] };

const fmt = new Intl.DateTimeFormat("es-CO", { weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit", timeZone: "America/Bogota" });

export async function handleInbound(clinicId: string, payload: Payload) {
  const clinic = await db.clinic.findUnique({ where: { id: clinicId }, select: { id: true, whatsappPhoneId: true, whatsappToken: true } });
  const cfg = clinic && replyConfig(clinic);
  if (!clinic || !cfg) return;
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      for (const m of change.value?.messages ?? []) {
        const raw = m.type === "button" ? m.button?.payload : m.type === "interactive" ? m.interactive?.button_reply?.id : undefined;
        const mt = /^([CXYN]):([A-Za-z0-9_-]{16,64})$/.exec(raw ?? "");
        if (!mt || !m.from) continue;
        const [, action, token] = mt;
        const a = await db.appointment.findFirst({ where: { confirmToken: token, clinicId }, include: { patient: { select: { firstName: true } } } });
        if (!a || a.startsAt < new Date()) {
          await sendWaText(cfg, m.from, "Esta cita ya pasó o no está disponible. Comunícate con nosotros si necesitas ayuda.");
          continue;
        }
        const when = fmt.format(a.startsAt);
        const set = async (status: "CONFIRMED" | "CANCELLED") => {
          if (a.status === status) return;
          if (!["SCHEDULED", "CONFIRMED"].includes(a.status)) return;
          await db.appointment.update({ where: { id: a.id }, data: { status } });
          await db.auditLog.create({ data: { action: `PATIENT_${status}`, entity: "Appointment", entityId: a.id, detail: `respondió por WhatsApp (${m.from})` } });
        };
        if (a.status === "CANCELLED" && action !== "N") {
          await sendWaText(cfg, m.from, "Tu cita ya estaba cancelada. Si quieres una nueva, comunícate con nosotros.");
        } else if (action === "C") {
          await set("CONFIRMED");
          await sendWaText(cfg, m.from, `¡Listo, ${a.patient.firstName}! Tu cita del ${when} quedó confirmada. Te esperamos.`);
        } else if (action === "X") {
          await sendWaButtons(cfg, m.from, `${a.patient.firstName}, ¿seguro que quieres cancelar tu cita del ${when}?`, [{ id: `Y:${token}`, title: "Sí, cancelar" }, { id: `N:${token}`, title: "No, mantenerla" }]);
        } else if (action === "Y") {
          await set("CANCELLED");
          await sendWaText(cfg, m.from, "Tu cita quedó cancelada. Cuando quieras una nueva, escríbenos y la agendamos.");
        } else {
          await sendWaText(cfg, m.from, `Perfecto, tu cita del ${when} se mantiene. Te esperamos.`);
        }
      }
    }
  }
}

export const appSecretOf = (blob: string | null) => (blob ? decryptSecret(blob) : null);
