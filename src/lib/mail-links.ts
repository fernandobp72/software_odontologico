import "server-only";
import { headers } from "next/headers";
import { db } from "./db";
import { mailBody, sendMail, type MailResult } from "./mailer";
import { hashToken, newToken } from "./tokens";

// Dirección pública de la aplicación: APP_URL si está definida; si no, la que usó quien hizo la petición.
export async function appOrigin() {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

// Crea el enlace de un solo uso para definir una contraseña nueva y lo manda por correo.
export async function sendResetEmail(user: { id: string; email: string; name: string }, hours = 1): Promise<MailResult> {
  const token = newToken();
  await db.passwordReset.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + hours * 3_600_000) } });
  const url = `${await appOrigin()}/restablecer/${token}`;
  return sendMail(
    user.email,
    "Restablece tu contraseña",
    mailBody({
      title: "Restablece tu contraseña",
      paragraphs: [`Hola ${user.name}, recibimos una solicitud para cambiar la contraseña de tu cuenta.`, `El enlace sirve una sola vez y vence en ${hours === 1 ? "1 hora" : `${hours} horas`}.`],
      button: { label: "Crear contraseña nueva", url },
      footer: "Si no fuiste tú, ignora este correo: tu contraseña actual sigue funcionando.",
    }),
  );
}

export async function sendInviteEmail(o: { to: string; clinic: string; role: string; token: string }): Promise<MailResult> {
  const url = `${await appOrigin()}/invitacion/${o.token}`;
  return sendMail(
    o.to,
    `Te invitaron a ${o.clinic}`,
    mailBody({
      title: `Te invitaron a ${o.clinic}`,
      paragraphs: [`Te agregaron como ${o.role} en ${o.clinic}. Crea tu contraseña y entra con este enlace.`, "El enlace sirve una sola vez y vence en 7 días."],
      button: { label: "Aceptar la invitación", url },
    }),
  );
}
