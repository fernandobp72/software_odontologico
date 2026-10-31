import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Cifrado de secretos de los consultorios (p. ej. el token de WhatsApp) con AES-256-GCM.
// Usa SECRETS_KEY y, si no existe, SESSION_SECRET. Si cambia la clave, los secretos guardados hay que volver a escribirlos.
const key = () => {
  const base = process.env.SECRETS_KEY ?? process.env.SESSION_SECRET;
  if (!base) throw new Error("Falta SECRETS_KEY o SESSION_SECRET");
  return createHash("sha256").update(`secrets:${base}`).digest();
};

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(blob: string): string | null {
  try {
    const [iv, tag, enc] = blob.split(".").map((p) => Buffer.from(p, "base64"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
