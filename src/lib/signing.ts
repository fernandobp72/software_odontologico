import "server-only";
import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/server";
import { db } from "./db";
import { appOrigin } from "./mail-links";
import { deviceLabel } from "./device";
import { clientIp } from "@/lib/client-ip";

// Sello digital del profesional. Funciona como un sello físico: puede tener varios (celular, computador, llave USB, clave),
// se reporta si se pierde y el administrador autoriza uno nuevo. Cada firma guarda la prueba criptográfica del dispositivo
// sobre el hash del documento, así que no depende de la contraseña ni de la sesión.

const CHALLENGE_MINUTES = 5;
const PIN_MAX_FAILURES = 5;
const PIN_LOCK_MINUTES = 15;

export const b64u = (b: Uint8Array | Buffer) => Buffer.from(b).toString("base64url");

function canon(v: unknown): string {
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${JSON.stringify(k)}:${canon(x)}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

// Hash del contenido que el profesional firma. Se recalcula igual al verificar.
export const contentHash = (kind: string, material: unknown) => createHash("sha256").update(`${kind}\n${canon(material)}`).digest("hex");

// El reto que firma el dispositivo mezcla un valor aleatorio con el hash del documento: firmar es firmar ESE contenido.
const challengeFor = (nonce: string, hash: string) => createHash("sha256").update(`sello\n${nonce}\n${hash}`).digest();

async function rp() {
  const origin = await appOrigin();
  return { rpID: new URL(origin).hostname, origin, rpName: "Software odontológico" };
}

export async function requestEvidence() {
  const h = await headers();
  const ip = await clientIp();
  return { ip, agent: h.get("user-agent")?.slice(0, 300) ?? null };
}

export async function activeCredentials(userId: string) {
  return db.signingCredential.findMany({ where: { userId, revokedAt: null }, orderBy: { serial: "asc" } });
}

export type SelloState = {
  hasActive: boolean;
  hadAny: boolean;
  passkeys: number;
  hasPin: boolean;
  grant: boolean; // el administrador autorizó un sello nuevo
  required: boolean;
};

export async function selloState(userId: string, clinicId: string): Promise<SelloState> {
  const [creds, grant, clinic] = await Promise.all([
    db.signingCredential.findMany({ where: { userId }, select: { kind: true, revokedAt: true } }),
    db.signingGrant.findFirst({ where: { userId, usedAt: null, startsAt: { lte: new Date() }, expiresAt: { gt: new Date() } } }),
    db.clinic.findUnique({ where: { id: clinicId }, select: { requireSello: true } }),
  ]);
  const act = creds.filter((c) => !c.revokedAt);
  return { hasActive: act.length > 0, hadAny: creds.length > 0, passkeys: act.filter((c) => c.kind === "PASSKEY").length, hasPin: act.some((c) => c.kind === "PIN"), grant: !!grant, required: !!clinic?.requireSello };
}

// ¿Puede esta persona agregar un dispositivo nuevo ahora? Primera vez: sí. Ya tiene sello activo: debe firmar con él (lo exige la acción).
// Perdió todos: necesita la autorización del administrador.
export const addProofHash = (userId: string) => contentHash("AddDevice", { userId });

export async function enrollmentGate(userId: string): Promise<{ ok: true; mode: "FIRST" | "ADD" | "REISSUE"; grantId?: string } | { ok: false; error: string }> {
  const creds = await db.signingCredential.findMany({ where: { userId }, select: { revokedAt: true } });
  if (creds.length === 0) return { ok: true, mode: "FIRST" };
  if (creds.some((c) => !c.revokedAt)) return { ok: true, mode: "ADD" };
  const grant = await db.signingGrant.findFirst({ where: { userId, usedAt: null, startsAt: { lte: new Date() }, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!grant) return { ok: false, error: "Perdiste todos tus dispositivos. Pídele al administrador del consultorio que autorice un sello nuevo (Equipo → Autorizar sello nuevo)." };
  return { ok: true, mode: "REISSUE", grantId: grant.id };
}

async function nextSerial(userId: string) {
  const last = await db.signingCredential.findFirst({ where: { userId }, orderBy: { serial: "desc" }, select: { serial: true } });
  return (last?.serial ?? 0) + 1;
}

// Cierra la autorización y sube la generación del sello cuando se reexpide tras una pérdida total.
async function consumeGate(userId: string, mode: "FIRST" | "ADD" | "REISSUE", grantId?: string) {
  if (mode !== "REISSUE" || !grantId) return (await db.user.findUniqueOrThrow({ where: { id: userId }, select: { sealGeneration: true } })).sealGeneration;
  return db.$transaction(async (tx) => {
    const used = await tx.signingGrant.updateMany({ where: { id: grantId, usedAt: null }, data: { usedAt: new Date() } });
    if (used.count !== 1) throw new Error("La autorización ya se usó");
    return (await tx.user.update({ where: { id: userId }, data: { sealGeneration: { increment: 1 } }, select: { sealGeneration: true } })).sealGeneration;
  });
}

// ---------- Registro de un dispositivo ----------

export async function registrationOptions(user: { id: string; email: string; name: string }) {
  const { rpID, rpName } = await rp();
  const existing = await db.signingCredential.findMany({ where: { userId: user.id, kind: "PASSKEY", revokedAt: null, credentialId: { not: null } }, select: { credentialId: true, transports: true } });
  const nonce = b64u(randomBytes(32));
  const opts = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    challenge: Buffer.from(nonce, "base64url"),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.credentialId!, transports: (c.transports?.split(",").filter(Boolean) ?? []) as never })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "required" },
  });
  const ch = await db.signingChallenge.create({ data: { userId: user.id, purpose: "REGISTER", challenge: opts.challenge, expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60_000) } });
  return { options: opts, challengeId: ch.id };
}

export async function finishRegistration(userId: string, challengeId: string, response: RegistrationResponseJSON, label: string) {
  const gate = await enrollmentGate(userId);
  if (!gate.ok) return { error: gate.error };
  const ch = await db.signingChallenge.findFirst({ where: { id: challengeId, userId, purpose: "REGISTER", usedAt: null, expiresAt: { gt: new Date() } } });
  if (!ch) return { error: "La solicitud venció. Inténtalo de nuevo." };
  const claimed = await db.signingChallenge.updateMany({ where: { id: ch.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return { error: "La solicitud ya se usó. Inténtalo de nuevo." };
  const { rpID, origin } = await rp();
  let info;
  try {
    info = await verifyRegistrationResponse({ response, expectedChallenge: ch.challenge, expectedOrigin: origin, expectedRPID: rpID, requireUserVerification: true });
  } catch {
    return { error: "No se pudo verificar el dispositivo." };
  }
  if (!info.verified || !info.registrationInfo) return { error: "No se pudo verificar el dispositivo." };
  const { credential, credentialDeviceType, credentialBackedUp } = info.registrationInfo;
  const generation = await consumeGate(userId, gate.mode, gate.grantId);
  const ev = await requestEvidence();
  const cred = await db.signingCredential.create({
    data: {
      userId,
      serial: await nextSerial(userId),
      generation,
      kind: "PASSKEY",
      label: label.trim().slice(0, 60) || deviceLabel(ev.agent),
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: (credential.transports ?? []).join(","),
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    },
  });
  await db.auditLog.create({ data: { userId, action: "SELLO_ADD", entity: "SigningCredential", entityId: cred.id, detail: `agregó el dispositivo «${cred.label}» a su sello (${gate.mode === "REISSUE" ? "sello reexpedido" : gate.mode === "FIRST" ? "primer dispositivo" : "dispositivo adicional"})` } });
  return { ok: true as const, id: cred.id, firstOne: gate.mode !== "ADD" };
}

export async function addPin(userId: string, pin: string, label = "Clave de firma") {
  if (!/^\d{6}$/.test(pin)) return { error: "La clave de firma son 6 números." };
  if (/^(\d)\1{5}$/.test(pin) || "0123456789012345".includes(pin) || "9876543210987654".includes(pin)) return { error: "Elige una clave menos obvia (no 123456, 111111…)." };
  const gate = await enrollmentGate(userId);
  if (!gate.ok) return { error: gate.error };
  if (await db.signingCredential.findFirst({ where: { userId, kind: "PIN", revokedAt: null } })) return { error: "Ya tienes una clave de firma. Quítala primero para crear otra." };
  const generation = await consumeGate(userId, gate.mode, gate.grantId);
  const cred = await db.signingCredential.create({ data: { userId, serial: await nextSerial(userId), generation, kind: "PIN", label, pinHash: await bcrypt.hash(pin, 12) } });
  await db.auditLog.create({ data: { userId, action: "SELLO_ADD", entity: "SigningCredential", entityId: cred.id, detail: "creó su clave de firma" } });
  return { ok: true as const, id: cred.id, firstOne: gate.mode !== "ADD" };
}

// ---------- Firmar ----------

export type SignProof =
  | { kind: "PASSKEY"; challengeId: string; response: AuthenticationResponseJSON }
  | { kind: "PIN"; pin: string };

// Paso 1: el servidor prepara lo que va a firmar el dispositivo (ligado al hash del documento).
export async function signOptions(userId: string, hash: string) {
  const creds = await db.signingCredential.findMany({ where: { userId, kind: "PASSKEY", revokedAt: null, credentialId: { not: null } }, select: { credentialId: true, transports: true } });
  if (creds.length === 0) return null;
  const { rpID } = await rp();
  const nonce = b64u(randomBytes(32));
  const opts = await generateAuthenticationOptions({
    rpID,
    challenge: challengeFor(nonce, hash),
    userVerification: "required",
    allowCredentials: creds.map((c) => ({ id: c.credentialId!, transports: (c.transports?.split(",").filter(Boolean) ?? []) as never })),
  });
  const ch = await db.signingChallenge.create({ data: { userId, purpose: "SIGN", challenge: nonce, contentHash: hash, expiresAt: new Date(Date.now() + CHALLENGE_MINUTES * 60_000) } });
  return { options: opts, challengeId: ch.id };
}

export type SignResult = { ok: true; credentialId: string | null; method: "PASSKEY" | "PIN"; assertion: unknown; generation: number } | { ok: false; error: string };

// Paso 2: valida la prueba. No guarda nada del documento; quien llama crea ProSignature con este resultado.
export async function checkProof(userId: string, hash: string, proof: SignProof): Promise<SignResult> {
  if (proof.kind === "PIN") {
    const cred = await db.signingCredential.findFirst({ where: { userId, kind: "PIN", revokedAt: null } });
    if (!cred?.pinHash) return { ok: false, error: "No tienes clave de firma." };
    if (cred.pinLockedUntil && cred.pinLockedUntil > new Date()) return { ok: false, error: "Clave de firma bloqueada por intentos fallidos. Espera unos minutos." };
    if (!(await bcrypt.compare(proof.pin, cred.pinHash))) {
      // Conteo atómico: varias peticiones en paralelo no pueden saltarse el límite.
      const upd = await db.signingCredential.update({ where: { id: cred.id }, data: { pinFailures: { increment: 1 } }, select: { pinFailures: true } });
      if (upd.pinFailures >= PIN_MAX_FAILURES) {
        await db.signingCredential.update({ where: { id: cred.id }, data: { pinFailures: 0, pinLockedUntil: new Date(Date.now() + PIN_LOCK_MINUTES * 60_000) } });
        return { ok: false, error: "Clave incorrecta. Se bloqueó por unos minutos." };
      }
      return { ok: false, error: "Clave de firma incorrecta." };
    }
    await db.signingCredential.update({ where: { id: cred.id }, data: { pinFailures: 0, pinLockedUntil: null, lastUsedAt: new Date() } });
    return { ok: true, credentialId: cred.id, method: "PIN", assertion: null, generation: cred.generation };
  }

  const ch = await db.signingChallenge.findFirst({ where: { id: proof.challengeId, userId, purpose: "SIGN", usedAt: null, expiresAt: { gt: new Date() } } });
  if (!ch || ch.contentHash !== hash) return { ok: false, error: "La firma venció o el contenido cambió. Inténtalo de nuevo." };
  const claimed = await db.signingChallenge.updateMany({ where: { id: ch.id, usedAt: null }, data: { usedAt: new Date() } });
  if (claimed.count !== 1) return { ok: false, error: "La firma ya se usó. Inténtalo de nuevo." };
  const cred = await db.signingCredential.findFirst({ where: { userId, kind: "PASSKEY", credentialId: proof.response.id, revokedAt: null } });
  if (!cred?.credentialId || !cred.publicKey) return { ok: false, error: "Ese dispositivo no está registrado o fue retirado de tu sello." };
  const { rpID, origin } = await rp();
  try {
    const v = await verifyAuthenticationResponse({
      response: proof.response,
      expectedChallenge: b64u(challengeFor(ch.challenge, hash)),
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: true,
      credential: { id: cred.credentialId, publicKey: new Uint8Array(cred.publicKey), counter: cred.counter, transports: (cred.transports?.split(",").filter(Boolean) ?? []) as never },
    });
    if (!v.verified) return { ok: false, error: "No se pudo verificar tu dispositivo." };
    await db.signingCredential.update({ where: { id: cred.id }, data: { counter: v.authenticationInfo.newCounter, lastUsedAt: new Date() } });
  } catch {
    return { ok: false, error: "No se pudo verificar tu dispositivo." };
  }
  const r = proof.response.response;
  return { ok: true, credentialId: cred.id, method: "PASSKEY", generation: cred.generation, assertion: { nonce: ch.challenge, clientDataJSON: r.clientDataJSON, authenticatorData: r.authenticatorData, signature: r.signature } };
}

// Identidad del profesional tal como estaba al firmar (si después cambia su nombre o registro, la firma conserva lo que firmó).
export async function recordSignature(args: { userId: string; docKind: "Evolution" | "Prescription"; docId: string; hash: string; result: Extract<SignResult, { ok: true }> }, client: Pick<typeof db, "user" | "proSignature"> = db) {
  const u = await client.user.findUniqueOrThrow({ where: { id: args.userId }, select: { name: true, licenseNumber: true } });
  const ev = await requestEvidence();
  const assertion = { ...(args.result.assertion as object | null), signer: { name: u.name, license: u.licenseNumber } };
  return client.proSignature.create({
    data: { userId: args.userId, credentialId: args.result.credentialId, docKind: args.docKind, docId: args.docId, method: args.result.method, contentHash: args.hash, assertion, generation: args.result.generation, ip: ev.ip, agent: ev.agent },
  });
}

// ¿Esta persona debe firmar con sello? Si el consultorio lo exige y no tiene, se bloquea con un mensaje claro.
export async function mustSignWithSello(userId: string, clinicId: string) {
  const s = await selloState(userId, clinicId);
  return { ...s, blocked: s.required && !s.hasActive };
}

// ---------- Pérdida y revocación ----------

export async function revokeCredential(args: { credentialId: string; byUserId: string; reason: "LOST" | "CHANGED" | "ADMIN"; since?: Date | null }) {
  const cred = await db.signingCredential.findUnique({ where: { id: args.credentialId } });
  if (!cred || cred.revokedAt) return { error: "Ese dispositivo ya no está activo." };
  const compromised = args.reason === "LOST" || args.reason === "ADMIN";
  // «Desde cuándo» no puede ser futuro ni anterior a la creación del dispositivo.
  let since: Date | null = null;
  if (compromised) {
    const s = args.since && args.since < new Date() ? args.since : new Date();
    since = s < cred.createdAt ? cred.createdAt : s;
  }
  await db.signingCredential.update({ where: { id: cred.id }, data: { revokedAt: new Date(), revokedReason: args.reason, revokedById: args.byUserId, compromisedSince: since } });
  await db.auditLog.create({ data: { userId: args.byUserId, action: "SELLO_REVOKE", entity: "SigningCredential", entityId: cred.id, detail: `retiró el dispositivo «${cred.label}» del sello (${args.reason === "LOST" ? "pérdida o robo" : args.reason === "CHANGED" ? "cambio de dispositivo" : "decisión del administrador"})${since ? `; posible uso indebido desde ${since.toISOString()}` : ""}` } });
  return { ok: true as const };
}

// ---------- Verificación pública ----------

export type SignatureCheck = { present: boolean; valid: boolean | null; method?: string; deviceLabel?: string; serial?: number; generation?: number; signedAt?: Date; signer?: { name: string; license: string | null }; compromised?: boolean; revoked?: boolean };

export async function checkSignature(docKind: "Evolution" | "Prescription", docId: string, hashNow: string): Promise<SignatureCheck> {
  const s = await db.proSignature.findUnique({ where: { docKind_docId: { docKind, docId } }, include: { credential: true } });
  if (!s) return { present: false, valid: null };
  const a = (s.assertion ?? {}) as { nonce?: string; clientDataJSON?: string; authenticatorData?: string; signature?: string; signer?: { name: string; license: string | null } };
  const base = { present: true, method: s.method, serial: s.credential?.serial, generation: s.generation, signedAt: s.signedAt, signer: a.signer, deviceLabel: s.credential?.label, revoked: !!s.credential?.revokedAt, compromised: !!(s.credential?.compromisedSince && s.signedAt >= s.credential.compromisedSince) };
  if (s.contentHash !== hashNow) return { ...base, valid: false };
  if (s.method !== "PASSKEY") return { ...base, valid: true };
  if (!s.credential?.publicKey || !s.credential.credentialId || !a.nonce || !a.clientDataJSON || !a.authenticatorData || !a.signature) return { ...base, valid: false };
  try {
    const client = JSON.parse(Buffer.from(a.clientDataJSON, "base64url").toString());
    const v = await verifyAuthenticationResponse({
      response: { id: s.credential.credentialId, rawId: s.credential.credentialId, type: "public-key", clientExtensionResults: {}, response: { clientDataJSON: a.clientDataJSON, authenticatorData: a.authenticatorData, signature: a.signature } },
      expectedChallenge: b64u(challengeFor(a.nonce, s.contentHash)),
      expectedOrigin: client.origin,
      expectedRPID: new URL(client.origin).hostname,
      requireUserVerification: true,
      credential: { id: s.credential.credentialId, publicKey: new Uint8Array(s.credential.publicKey), counter: 0 },
    });
    return { ...base, valid: v.verified };
  } catch {
    return { ...base, valid: false };
  }
}

// ---------- Preparar una firma desde la pantalla ----------

export type SignPrep =
  | { mode: "SESSION" } // sin sello y el consultorio no lo exige: se firma como antes (queda registrado como firma con sesión)
  | { mode: "BLOCKED"; error: string }
  | { mode: "SELLO"; hash: string; passkey: { options: unknown; challengeId: string } | null; pin: boolean };

export async function prepareSign(user: { id: string; clinicId: string }, hash: string): Promise<SignPrep> {
  const st = await selloState(user.id, user.clinicId);
  if (!st.hasActive) {
    if (st.required || st.hadAny) return { mode: "BLOCKED", error: st.hadAny ? "Tu sello no tiene dispositivos activos. Pide al administrador que autorice uno nuevo." : "El consultorio exige firmar con el sello digital. Crea el tuyo en Mi cuenta → Mi sello digital." };
    return { mode: "SESSION" };
  }
  const pk = await signOptions(user.id, hash);
  return { mode: "SELLO", hash, passkey: pk ? { options: pk.options, challengeId: pk.challengeId } : null, pin: st.hasPin };
}

// Verifica la prueba que mandó la pantalla. Sin sello activo (y no exigido) devuelve SESSION.
export async function resolveProof(user: { id: string; clinicId: string }, hash: string, raw: string | null | undefined): Promise<{ ok: true; result: Extract<SignResult, { ok: true }> | null } | { ok: false; error: string }> {
  const st = await selloState(user.id, user.clinicId);
  if (!st.hasActive) {
    if (st.required || st.hadAny) return { ok: false, error: "No tienes un sello activo. Pide al administrador que autorice uno nuevo." };
    return { ok: true, result: null };
  }
  let proof: SignProof | null = null;
  try { proof = raw ? (JSON.parse(raw) as SignProof) : null; } catch { proof = null; }
  if (!proof || (proof.kind !== "PASSKEY" && proof.kind !== "PIN")) return { ok: false, error: "Falta confirmar con tu sello (huella, rostro o clave de firma)." };
  const r = await checkProof(user.id, hash, proof);
  return r.ok ? { ok: true, result: r } : { ok: false, error: r.error };
}
