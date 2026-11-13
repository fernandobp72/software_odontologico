"use server";

import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireAnyUser } from "@/lib/dal";
import { clearFailures, isBlocked, recordFailure } from "@/lib/rate-limit";
import { decryptSecret, encryptSecret } from "@/lib/secrets";
import { createSession } from "@/lib/session";
import { newSecret, otpauthUri, verify } from "@/lib/totp";

export type TfaState = { error?: string; ok?: boolean; secret?: string; qr?: string } | undefined;

// Paso 1: crea una clave nueva (todavía sin activar) y devuelve el QR para escanear con la app del celular.
export async function startTwoFactor(): Promise<TfaState> {
  const user = await requireAnyUser();
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpEnabledAt: true, email: true } });
  if (row.totpEnabledAt) return { error: "La verificación en dos pasos ya está activa." };
  const secret = newSecret();
  await db.user.update({ where: { id: user.id }, data: { totpSecret: encryptSecret(secret), totpLastStep: null } });
  const qr = await QRCode.toString(otpauthUri(secret, row.email, user.clinic.name.slice(0, 40) || "Consultorio"), { type: "svg", margin: 1, width: 220 });
  return { secret: secret.replace(/(.{4})/g, "$1 ").trim(), qr };
}

// Paso 2: la persona escribe el código que ve en la app; si coincide, queda activa y se cierran las demás sesiones.
export async function confirmTwoFactor(_: TfaState, fd: FormData): Promise<TfaState> {
  const user = await requireAnyUser();
  const key = `tfa-setup:${user.id}`;
  if (await isBlocked(key)) return { error: "Demasiados intentos. Espera 15 minutos." };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { totpSecret: true, totpEnabledAt: true } });
  if (row.totpEnabledAt) return { ok: true };
  const secret = row.totpSecret ? decryptSecret(row.totpSecret) : null;
  if (!secret) return { error: "Vuelve a empezar: toca «Activar» otra vez." };
  const step = verify(secret, String(fd.get("code") ?? ""), null);
  if (step === null) {
    await recordFailure(key);
    return { error: "El código no coincide. Revisa que la hora del celular esté en automático y escribe el código que se ve ahora." };
  }
  await clearFailures(key);
  const u = await db.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date(), totpLastStep: step, sessionVersion: { increment: 1 } }, select: { sessionVersion: true } });
  await createSession({ userId: user.id, clinicId: user.clinicId, role: user.role, sv: u.sessionVersion });
  await db.auditLog.create({ data: { userId: user.id, action: "TOTP_ENABLE", entity: "User", entityId: user.id } });
  revalidatePath("/perfil");
  return { ok: true };
}

// Para quitarla se pide la contraseña y un código vigente: alguien con el computador abierto no puede apagarla.
export async function disableTwoFactor(_: TfaState, fd: FormData): Promise<TfaState> {
  const user = await requireAnyUser();
  const key = `tfa-off:${user.id}`;
  if (await isBlocked(key)) return { error: "Demasiados intentos. Espera 15 minutos." };
  const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true, totpSecret: true, totpEnabledAt: true, totpLastStep: true } });
  if (!row.totpEnabledAt || !row.totpSecret) return { ok: true };
  const okPw = await bcrypt.compare(String(fd.get("current") ?? ""), row.passwordHash);
  const secret = decryptSecret(row.totpSecret);
  const step = okPw && secret ? verify(secret, String(fd.get("code") ?? ""), row.totpLastStep) : null;
  if (step === null) {
    await recordFailure(key);
    return { error: okPw ? "El código no coincide." : "La contraseña actual no es correcta." };
  }
  await clearFailures(key);
  const u = await db.user.update({ where: { id: user.id }, data: { totpSecret: null, totpEnabledAt: null, totpLastStep: null, sessionVersion: { increment: 1 } }, select: { sessionVersion: true } });
  await createSession({ userId: user.id, clinicId: user.clinicId, role: user.role, sv: u.sessionVersion });
  await db.auditLog.create({ data: { userId: user.id, action: "TOTP_DISABLE", entity: "User", entityId: user.id } });
  revalidatePath("/perfil");
  return { ok: true };
}
