import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE = "session";
const MAX_AGE_SECONDS = 60 * 60 * 8;

export type SessionPayload = {
  userId: string;
  clinicId: string;
  role: "ADMIN" | "DENTIST" | "RECEPTION";
  // Versión de sesión del usuario al ingresar. Si en la base es otra (cambió la contraseña, cerró las demás sesiones), el token ya no sirve.
  // Los tokens emitidos antes de este campo no la traen y cuentan como 0.
  sv: number;
};

// ¿Sigue vigente esta sesión para el usuario tal como está hoy en la base?
export const sessionCurrent = (session: SessionPayload, user: { sessionVersion: number }) => (session.sv ?? 0) === user.sessionVersion;

function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET no está definido");
  return new TextEncoder().encode(secret);
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(key());

  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function readSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

// Paso intermedio de la verificación en dos pasos: la contraseña ya se comprobó y falta el código (5 minutos).
const MFA_COOKIE = "mfa";
export async function createMfaPending(userId: string, sv: number) {
  const token = await new SignJWT({ uid: userId, sv, k: "mfa" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("300s").sign(key());
  (await cookies()).set(MFA_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 300 });
}
export async function readMfaPending(): Promise<{ uid: string; sv: number } | null> {
  const token = (await cookies()).get(MFA_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    return payload.k === "mfa" && typeof payload.uid === "string" ? { uid: payload.uid, sv: Number(payload.sv ?? 0) } : null;
  } catch {
    return null;
  }
}
export async function clearMfaPending() {
  (await cookies()).delete(MFA_COOKIE);
}
