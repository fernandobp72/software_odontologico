import "server-only";
import { createHash, createHmac } from "node:crypto";
import { db } from "./db";

// Sello de integridad de los documentos que se firman (evolución, consentimiento, fórmula).
// Al firmar se calcula un HMAC-SHA256 del contenido con una clave que solo conoce el servidor y se guarda aparte.
// Si alguien cambia el contenido en la base de datos, el sello deja de coincidir y la verificación lo delata.
// Es una prueba de integridad, no una firma digital certificada (Ley 527 de 1999): ver DEPLOY.md.
// Usa SEAL_KEY y, si no existe, SECRETS_KEY o SESSION_SECRET. No la cambies: los sellos anteriores dejarían de verificar.
const key = () => {
  const base = process.env.SEAL_KEY ?? process.env.SECRETS_KEY ?? process.env.SESSION_SECRET;
  if (!base) throw new Error("Falta SEAL_KEY, SECRETS_KEY o SESSION_SECRET");
  return createHash("sha256").update(`seal:${base}`).digest();
};

// JSON con llaves ordenadas: el mismo contenido siempre produce los mismos bytes.
function canon(v: unknown): string {
  if (v instanceof Date) return JSON.stringify(v.toISOString());
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.entries(v as Record<string, unknown>).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, x]) => `${JSON.stringify(k)}:${canon(x)}`).join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

export type SealKind = "Evolution" | "Consent" | "Prescription";
export const SEAL_LABEL: Record<SealKind, string> = { Evolution: "Evolución clínica", Consent: "Consentimiento informado", Prescription: "Fórmula médica" };

const compute = (kind: SealKind, material: unknown) => createHmac("sha256", key()).update(`${kind}\n${canon(material)}`).digest("hex");

const evolutionMaterial = (e: { id: string; patientId: string; dentistId: string; reason: string | null; diagnosisCode: string | null; procedureCode: string | null; note: string; signedAt: Date; correctsId: string | null }) =>
  ({ id: e.id, patientId: e.patientId, dentistId: e.dentistId, reason: e.reason, diagnosisCode: e.diagnosisCode, procedureCode: e.procedureCode, note: e.note, signedAt: e.signedAt, correctsId: e.correctsId });

const consentMaterial = (c: { id: string; patientId: string; dentistId: string; templateId: string; templateVersion: string; title: string; body: string; procedureNote: string | null; signerName: string; signerDocument: string | null; signerRelation: string; witnessName: string | null; signature: string; signedAt: Date; signMethod?: string | null; signIp?: string | null; signAgent?: string | null; signDevice?: string | null; signReadSec?: number | null }) =>
  ({ id: c.id, patientId: c.patientId, dentistId: c.dentistId, templateId: c.templateId, templateVersion: c.templateVersion, title: c.title, body: c.body, procedureNote: c.procedureNote, signerName: c.signerName, signerDocument: c.signerDocument, signerRelation: c.signerRelation, witnessName: c.witnessName, signature: createHash("sha256").update(c.signature).digest("hex"), signedAt: c.signedAt, ...(c.signMethod ? { signMethod: c.signMethod, signIp: c.signIp ?? null, signAgent: c.signAgent ?? null, ...(c.signDevice ? { signDevice: c.signDevice, signReadSec: c.signReadSec ?? null } : {}) } : {}) });

type RxRow = Awaited<ReturnType<typeof loadRx>>;
const loadRx = (where: { id: string } | { seal: string }) =>
  db.prescription.findUnique({ where, include: { items: { orderBy: { position: "asc" } }, dentist: { select: { name: true, licenseNumber: true } }, clinic: { select: { name: true } } } });
// La anulación (voidedAt…) no entra en el sello: anular es un cambio legítimo y queda en su propio registro.
const rxMaterial = (r: NonNullable<RxRow>) => ({
  id: r.id, clinicId: r.clinicId, number: r.number, patientId: r.patientId, dentistId: r.dentistId, issuedAt: r.issuedAt, diagnosisCode: r.diagnosisCode, diagnosisText: r.diagnosisText,
  weightKg: r.weightKg, notes: r.notes, vademecum: r.vademecum,
  items: r.items.map((i) => ({ position: i.position, drugId: i.drugId, name: i.name, concentration: i.concentration, form: i.form, route: i.route, dose: i.dose, frequency: i.frequency, duration: i.duration, quantity: i.quantity, quantityText: i.quantityText, instructions: i.instructions, alerts: i.alerts, override: i.override })),
});

// Se llaman justo después de crear el documento firmado.
export async function sealEvolution(id: string) {
  const e = await db.evolution.findUniqueOrThrow({ where: { id } });
  await db.evolution.update({ where: { id }, data: { seal: compute("Evolution", evolutionMaterial(e)) } });
}
export async function sealConsent(id: string) {
  const c = await db.consent.findUniqueOrThrow({ where: { id } });
  await db.consent.update({ where: { id }, data: { seal: compute("Consent", consentMaterial(c)) } });
}
export async function sealPrescription(id: string) {
  const r = await loadRx({ id });
  if (!r) throw new Error("Fórmula no encontrada");
  await db.prescription.update({ where: { id }, data: { seal: compute("Prescription", rxMaterial(r)) } });
}

export type SealCheck = {
  kind: SealKind;
  intact: boolean; // el contenido actual coincide con el sello
  signedAt: Date;
  number: number | null;
  signer: string;
  license: string | null;
  clinic: string;
  voided: boolean;
};

// Verificación pública: no devuelve datos del paciente, solo quién firmó, cuándo y si el contenido sigue intacto.
export async function verifySeal(seal: string): Promise<SealCheck | null> {
  if (!/^[0-9a-f]{64}$/.test(seal)) return null;
  const who = { select: { name: true, licenseNumber: true } } as const;
  const [ev, co, rx] = await Promise.all([
    db.evolution.findUnique({ where: { seal }, include: { dentist: who, patient: { select: { clinic: { select: { name: true } } } } } }),
    db.consent.findUnique({ where: { seal }, include: { dentist: who, patient: { select: { clinic: { select: { name: true } } } } } }),
    loadRx({ seal }),
  ]);
  if (ev) return { kind: "Evolution", intact: compute("Evolution", evolutionMaterial(ev)) === seal, signedAt: ev.signedAt, number: null, signer: ev.dentist.name, license: ev.dentist.licenseNumber, clinic: ev.patient.clinic.name, voided: false };
  if (co) return { kind: "Consent", intact: compute("Consent", consentMaterial(co)) === seal, signedAt: co.signedAt, number: null, signer: co.dentist.name, license: co.dentist.licenseNumber, clinic: co.patient.clinic.name, voided: false };
  if (rx) return { kind: "Prescription", intact: compute("Prescription", rxMaterial(rx)) === seal, signedAt: rx.issuedAt, number: rx.number, signer: rx.dentist.name, license: rx.dentist.licenseNumber, clinic: rx.clinic.name, voided: !!rx.voidedAt };
  return null;
}
