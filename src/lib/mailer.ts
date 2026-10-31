import "server-only";
import nodemailer from "nodemailer";
import { db } from "./db";
import { decryptSecret } from "./secrets";

// Correo saliente con la conexión SMTP que configura el dueño de la plataforma (Plataforma → Correo).
export type MailResult = { ok: boolean; error?: string };

export async function mailConfigured() {
  return !!(await db.emailConfig.findUnique({ where: { id: "main" }, select: { id: true } }));
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Plantilla sencilla: título, párrafos y un botón opcional. El texto plano va siempre incluido.
export function mailBody(o: { title: string; paragraphs: string[]; button?: { label: string; url: string }; footer?: string }) {
  const text = [o.title, "", ...o.paragraphs, ...(o.button ? ["", `${o.button.label}: ${o.button.url}`] : []), ...(o.footer ? ["", o.footer] : [])].join("\n");
  const html = `<div style="font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#232b26">
<h1 style="font-size:20px;color:#22633d;margin:0 0 16px">${esc(o.title)}</h1>
${o.paragraphs.map((p) => `<p style="font-size:15px;line-height:1.5;margin:0 0 12px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("")}
${o.button ? `<p style="margin:20px 0"><a href="${esc(o.button.url)}" style="background:#2a7a4b;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">${esc(o.button.label)}</a></p><p style="font-size:12px;color:#576359;word-break:break-all">Si el botón no funciona, copia este enlace: ${esc(o.button.url)}</p>` : ""}
${o.footer ? `<p style="font-size:12px;color:#576359;margin-top:24px">${esc(o.footer)}</p>` : ""}
</div>`;
  return { text, html };
}

export async function sendMail(to: string, subject: string, body: { text: string; html: string }): Promise<MailResult> {
  const c = await db.emailConfig.findUnique({ where: { id: "main" } });
  if (!c) return { ok: false, error: "El correo de la plataforma no está configurado" };
  const pass = c.passwordEnc ? decryptSecret(c.passwordEnc) : undefined;
  if (c.passwordEnc && !pass) return { ok: false, error: "No se pudo leer la contraseña de correo guardada; vuelve a escribirla" };
  try {
    const t = nodemailer.createTransport({
      host: c.host, port: c.port, secure: c.secure,
      auth: c.username ? { user: c.username, pass: pass ?? "" } : undefined,
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000,
    });
    await t.sendMail({ from: { name: c.fromName, address: c.fromEmail }, to, subject, text: body.text, html: body.html });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "No se pudo enviar" };
  }
}

// Comprueba la conexión y la autenticación sin enviar nada.
export async function verifyMail(c: { host: string; port: number; secure: boolean; username?: string | null; password?: string | null }): Promise<MailResult> {
  try {
    const t = nodemailer.createTransport({
      host: c.host, port: c.port, secure: c.secure,
      auth: c.username ? { user: c.username, pass: c.password ?? "" } : undefined,
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 15_000,
    });
    await t.verify();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 200) : "No se pudo conectar" };
  }
}
