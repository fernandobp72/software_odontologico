"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { isBlocked, recordFailure } from "@/lib/rate-limit";
import { TERMS_VERSION, password } from "@/lib/tokens";

// Devuelve lo escrito (menos la contraseña) para que un error no borre el formulario.
export type SignupState = { error?: string; values?: Record<string, string> } | undefined;

const schema = z.object({
  clinicName: z.string().trim().min(2, "Escribe el nombre").max(120),
  noun: z.enum(["consultorio", "clinica", "centro"]).default("consultorio"),
  nit: z.string().trim().max(30).optional(),
  name: z.string().trim().min(3, "Escribe tu nombre").max(120),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password,
  terms: z.literal("on", { message: "Debes aceptar los términos y la política de datos" }),
});

export async function signup(_: SignupState, fd: FormData): Promise<SignupState> {
  const values = Object.fromEntries(["noun", "clinicName", "nit", "name", "email"].map((k) => [k, String(fd.get(k) ?? "")]));
  if (process.env.ALLOW_SIGNUP === "false") return { error: "El registro está cerrado por ahora", values };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const key = `signup:${ip}`;
  if (isBlocked(key)) return { error: "Demasiados intentos. Espera unos minutos.", values };
  recordFailure(key); // cuenta cada intento para frenar registros masivos

  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message, values };
  const d = parsed.data;
  if (await db.user.findUnique({ where: { email: d.email } })) return { error: "Ese correo ya tiene una cuenta. Inicia sesión.", values };

  const now = new Date();
  const user = await db.$transaction(async (tx) => {
    const clinic = await tx.clinic.create({
      data: { name: d.clinicName, noun: d.noun, nit: d.nit || null, status: "TRIAL", trialEndsAt: new Date(now.getTime() + 30 * 86_400_000), termsAcceptedAt: now, termsVersion: TERMS_VERSION },
    });
    const branch = await tx.branch.create({ data: { clinicId: clinic.id, name: "Sede principal" } });
    const admin = await tx.user.create({ data: { clinicId: clinic.id, email: d.email, name: d.name, role: "ADMIN", passwordHash: await bcrypt.hash(d.password, 12) } });
    await tx.userBranch.create({ data: { userId: admin.id, branchId: branch.id } });
    return admin;
  });
  await db.auditLog.create({ data: { userId: user.id, action: "SIGNUP", entity: "Clinic", entityId: user.clinicId } });
  await createSession({ userId: user.id, clinicId: user.clinicId, role: user.role });
  redirect("/inicio");
}
