"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { clearMfaPending, createMfaPending, createSession, destroySession, readMfaPending } from "@/lib/session";
import { anyBlocked, clearFailures, isBlocked, recordFailure } from "@/lib/rate-limit";
import { decryptSecret } from "@/lib/secrets";
import { verify } from "@/lib/totp";
import { clientIp } from "@/lib/client-ip";

const schema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

// Devuelve el correo escrito para que no se borre cuando hay un error (la contraseña sí se vuelve a pedir).
export type LoginState = { error?: string; email?: string; mfa?: boolean } | undefined;

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const typed = String(formData.get("email") ?? "");
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message, email: typed };

  const email = parsed.data.email.toLowerCase();
  const ip = (await clientIp()) ?? "local";
  const keys = [`email:${email}`, `ip:${ip}`];
  if (await anyBlocked(keys)) return { error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo.", email: typed };

  const user = await db.user.findUnique({ where: { email } });
  // Mismo mensaje y mismo costo de bcrypt exista o no el usuario.
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi";
  const ok = await bcrypt.compare(parsed.data.password, hash);
  if (!user || !user.active || !ok) {
    await Promise.all(keys.map(recordFailure));
    return { error: "Correo o contraseña incorrectos", email: typed };
  }
  await Promise.all(keys.map(clearFailures));

  // Verificación en dos pasos: falta el código de la app autenticadora.
  if (user.totpEnabledAt && user.totpSecret) {
    await createMfaPending(user.id, user.sessionVersion);
    return { mfa: true, email: typed };
  }

  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession({ userId: user.id, clinicId: user.clinicId, role: user.role, sv: user.sessionVersion });
  redirect("/agenda");
}

export async function verifyMfa(_: LoginState, formData: FormData): Promise<LoginState> {
  const pending = await readMfaPending();
  if (!pending) return { error: "Pasaron más de 5 minutos. Vuelve a escribir tu contraseña." };
  const key = `mfa:${pending.uid}`;
  if (await isBlocked(key)) return { mfa: true, error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo." };
  const user = await db.user.findUnique({ where: { id: pending.uid } });
  if (!user || !user.active || user.sessionVersion !== pending.sv || !user.totpSecret || !user.totpEnabledAt) return { error: "Vuelve a ingresar." };
  const secret = decryptSecret(user.totpSecret);
  const step = secret ? verify(secret, String(formData.get("code") ?? ""), user.totpLastStep) : null;
  if (step === null) {
    await recordFailure(key);
    return { mfa: true, error: "Código incorrecto. Revisa la hora del celular y escribe el código que se ve ahora." };
  }
  // Se guarda el paso usado solo si nadie lo usó antes (dos ingresos al mismo tiempo con el mismo código).
  const r = await db.user.updateMany({ where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] }, data: { totpLastStep: step, lastLoginAt: new Date() } });
  if (!r.count) return { mfa: true, error: "Ese código ya se usó. Espera el siguiente." };
  await clearFailures(key);
  await clearMfaPending();
  await createSession({ userId: user.id, clinicId: user.clinicId, role: user.role, sv: user.sessionVersion });
  redirect("/agenda");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
