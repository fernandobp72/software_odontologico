"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { requireClinician } from "@/lib/dal";
import { addPin, addProofHash, enrollmentGate, prepareSign, resolveProof, type SignPrep, finishRegistration, registrationOptions, revokeCredential, selloState } from "@/lib/signing";

export type SelloResult = { error?: string; ok?: boolean };

// Quien ya tiene un sello activo agrega otro dispositivo solo después de confirmar la contraseña (la sesión sola no basta);
// la primera vez también se pide, para que una sesión abierta y olvidada no pueda crearle un sello a otra persona.
async function checkPassword(userId: string, password: string) {
  const row = await db.user.findUniqueOrThrow({ where: { id: userId }, select: { passwordHash: true } });
  return bcrypt.compare(password, row.passwordHash);
}

// Para agregar otro dispositivo quien ya tiene sello debe confirmarlo con uno que ya tiene (la contraseña sola no basta).
export async function prepareAddProof(): Promise<SignPrep> {
  const user = await requireClinician();
  const gate = await enrollmentGate(user.id);
  if (!gate.ok || gate.mode !== "ADD") return { mode: "SESSION" };
  return prepareSign(user, addProofHash(user.id));
}

async function addProofOk(user: { id: string; clinicId: string }, proof: string | undefined) {
  const gate = await enrollmentGate(user.id);
  if (!gate.ok || gate.mode !== "ADD") return { ok: true as const };
  const r = await resolveProof(user, addProofHash(user.id), proof);
  return r.ok ? { ok: true as const } : { error: r.error };
}

export async function startAddDevice(password: string, proof?: string) {
  const user = await requireClinician();
  if (!(await checkPassword(user.id, password))) return { error: "La contraseña no es correcta" } as const;
  const pr = await addProofOk(user, proof);
  if ("error" in pr) return { error: pr.error } as const;
  const gate = await enrollmentGate(user.id);
  if (!gate.ok) return { error: gate.error } as const;
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { licenseNumber: true } });
  if (!me.licenseNumber) return { error: "Primero registra tu registro profesional en «Mis datos»." } as const;
  const r = await registrationOptions({ id: user.id, email: user.email, name: user.name });
  return { options: r.options, challengeId: r.challengeId } as const;
}

export async function finishAddDevice(challengeId: string, response: RegistrationResponseJSON, label: string): Promise<SelloResult> {
  const user = await requireClinician();
  const r = await finishRegistration(user.id, challengeId, response, label);
  if ("error" in r && r.error) return { error: r.error };
  revalidatePath("/perfil/sello");
  return { ok: true };
}

export async function createPin(_: SelloResult | undefined, fd: FormData): Promise<SelloResult> {
  const user = await requireClinician();
  if (!(await checkPassword(user.id, String(fd.get("password") ?? "")))) return { error: "La contraseña no es correcta" };
  const pr = await addProofOk(user, String(fd.get("proof") ?? ""));
  if ("error" in pr) return { error: pr.error };
  const pin = String(fd.get("pin") ?? "");
  if (pin !== String(fd.get("pin2") ?? "")) return { error: "Las dos claves no coinciden" };
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { licenseNumber: true } });
  if (!me.licenseNumber) return { error: "Primero registra tu registro profesional en «Mis datos»." };
  const r = await addPin(user.id, pin);
  if ("error" in r && r.error) return { error: r.error };
  revalidatePath("/perfil/sello");
  return { ok: true };
}

// «Se me perdió / me lo robaron / lo cambié»: se anula de inmediato. Si dice desde cuándo, las firmas hechas con ese dispositivo
// desde esa fecha quedan marcadas «en revisión».
export async function revokeMine(credentialId: string, reason: "LOST" | "CHANGED", fd: FormData): Promise<void> {
  const user = await requireClinician();
  const cred = await db.signingCredential.findFirst({ where: { id: credentialId, userId: user.id } });
  if (!cred) return;
  // Retirar un dispositivo también exige la contraseña: una sesión abierta y olvidada no puede dejar a nadie sin sello.
  if (!(await checkPassword(user.id, String(fd.get("password") ?? "")))) return;
  const sinceRaw = String(fd.get("since") ?? "");
  const since = sinceRaw ? new Date(`${sinceRaw}T00:00:00-05:00`) : null;
  await revokeCredential({ credentialId, byUserId: user.id, reason, since: since && !Number.isNaN(since.getTime()) ? since : null });
  revalidatePath("/perfil/sello");
}

export async function selloSummary() {
  const user = await requireClinician();
  return selloState(user.id, user.clinicId);
}
