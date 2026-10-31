import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { baseUrl, ensureToken } from "@/lib/reminders";
import { cloudConfig, normalizePhone, reminderParams, sendCloudTemplate } from "@/lib/whatsapp";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Envía por la API de WhatsApp de cada consultorio (si activó el envío automático) los recordatorios de las citas de las próximas horas.
// Programar cada 30 minutos con: curl -X POST -H "Authorization: Bearer $CRON_SECRET" <APP_URL>/api/cron/reminders
export async function POST(req: Request) {
  if (!authorized(req)) return new Response("No autorizado", { status: 401 });
  const root = baseUrl();
  if (!root) return Response.json({ sent: 0, skipped: "Falta APP_URL" });

  const hours = Number(process.env.REMINDER_HOURS_BEFORE ?? 24);
  const now = new Date();
  const appointments = await db.appointment.findMany({
    where: {
      status: "SCHEDULED",
      startsAt: { gt: new Date(now.getTime() + 60 * 60_000), lte: new Date(now.getTime() + hours * 3_600_000) },
      patient: { whatsappOptInAt: { not: null } },
      clinic: { whatsappAuto: true, whatsappToken: { not: null }, status: { not: "SUSPENDED" } },
      reminders: { none: { status: "SENT" } },
    },
    include: { patient: true, clinic: true, branch: true },
    take: 100,
  });

  let sent = 0;
  let failed = 0;
  for (const a of appointments) {
    // Cada consultorio envía con su propio WhatsApp Business.
    const cfg = cloudConfig(a.clinic);
    const to = normalizePhone(a.patient.phone);
    if (!cfg || !to) continue;
    const token = await ensureToken(a.id, a.confirmToken);
    const params = reminderParams(a, a.patient.firstName, a.branch.name === "Sede principal" ? a.clinic.name : `${a.clinic.name} - ${a.branch.name}`, `${root}/confirmar/${token}`);
    const r = await sendCloudTemplate(cfg, to, params);
    await db.reminder.create({ data: { appointmentId: a.id, channel: "CLOUD", status: r.ok ? "SENT" : "FAILED", error: r.error ?? null } });
    if (r.ok) sent++;
    else failed++;
  }
  return Response.json({ checked: appointments.length, sent, failed });
}
