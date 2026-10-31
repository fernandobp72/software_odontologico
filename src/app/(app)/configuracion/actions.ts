"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/dal";
import { encryptSecret, decryptSecret } from "@/lib/secrets";
import { checkCloud } from "@/lib/whatsapp";

export type ClinicState = { error?: string; ok?: boolean } | undefined;

const schema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre").max(120),
  noun: z.enum(["consultorio", "clinica", "centro"]),
  nit: z.string().trim().max(30).optional(),
  address: z.string().trim().max(160).optional(),
  phone: z.string().trim().max(40).optional(),
});

export async function saveClinic(_: ClinicState, fd: FormData): Promise<ClinicState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Solo administración puede cambiar estos datos" };
  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  await db.clinic.update({ where: { id: user.clinicId }, data: { name: d.name, noun: d.noun, nit: d.nit || null, address: d.address || null, phone: d.phone || null } });
  await db.auditLog.create({ data: { userId: user.id, action: "CLINIC_UPDATE", entity: "Clinic", entityId: user.clinicId } });
  revalidatePath("/configuracion");
  return { ok: true };
}

export type WaState = { error?: string; ok?: boolean; info?: string } | undefined;

const waSchema = z.object({
  phoneId: z.string().trim().regex(/^\d{5,25}$/, "El identificador del número son solo dígitos"),
  token: z.string().trim().max(1000).optional(),
  template: z.string().trim().regex(/^[a-z0-9_]{1,512}$/, "El nombre de la plantilla va en minúsculas, números y guiones bajos").optional().or(z.literal("")),
  lang: z.string().trim().regex(/^[a-z]{2}(_[A-Z]{2})?$/, "Idioma inválido (ej. es o es_CO)").optional().or(z.literal("")),
});

// WhatsApp Business propio del consultorio. El token se guarda cifrado y no se vuelve a mostrar.
export async function saveWhatsapp(_: WaState, fd: FormData): Promise<WaState> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return { error: "Solo administración puede configurar WhatsApp" };
  const parsed = waSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const current = await db.clinic.findUniqueOrThrow({ where: { id: user.clinicId }, select: { whatsappToken: true } });
  const auto = fd.get("auto") === "on";
  if (!d.token && !current.whatsappToken) return { error: "Pega el token de acceso de WhatsApp Business" };

  // Antes de guardar se comprueba con Meta que el número y el token funcionan.
  const token = d.token || decryptSecret(current.whatsappToken!);
  if (!token) return { error: "No se pudo leer el token guardado: pega el token de nuevo" };
  const check = await checkCloud(d.phoneId, token);
  if (!check.ok) return { error: `Meta rechazó la conexión: ${check.error}` };

  await db.clinic.update({
    where: { id: user.clinicId },
    data: { whatsappPhoneId: d.phoneId, whatsappTemplate: d.template || null, whatsappLang: d.lang || null, whatsappAuto: auto, ...(d.token ? { whatsappToken: encryptSecret(d.token) } : {}) },
  });
  await db.auditLog.create({ data: { userId: user.id, action: "WHATSAPP_CONFIG", entity: "Clinic", entityId: user.clinicId } });
  revalidatePath("/configuracion");
  revalidatePath("/recordatorios");
  return { ok: true, info: `Conectado a ${check.number ?? "WhatsApp Business"}${check.name ? ` (${check.name})` : ""}${auto ? ". Envío automático activado." : ". Envío automático desactivado."}` };
}

export async function clearWhatsapp(): Promise<void> {
  const user = await requireUser();
  if (user.role !== "ADMIN") return;
  await db.clinic.update({ where: { id: user.clinicId }, data: { whatsappPhoneId: null, whatsappToken: null, whatsappTemplate: null, whatsappLang: null, whatsappAuto: false } });
  await db.auditLog.create({ data: { userId: user.id, action: "WHATSAPP_REMOVE", entity: "Clinic", entityId: user.clinicId } });
  revalidatePath("/configuracion");
  revalidatePath("/recordatorios");
}
