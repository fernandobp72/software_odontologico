"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession } from "@/lib/session";
import { isBlocked, recordFailure } from "@/lib/rate-limit";
import { TERMS_VERSION, password } from "@/lib/tokens";

export type SignupState = { error?: string } | undefined;

const schema = z.object({
  clinicName: z.string().trim().min(2, "Escribe el nombre del consultorio").max(120),
  nit: z.string().trim().max(30).optional(),
  name: z.string().trim().min(3, "Escribe tu nombre").max(120),
  email: z.string().trim().toLowerCase().email("Correo inválido"),
  password,
  terms: z.literal("on", { message: "Debes aceptar los términos y la política de datos" }),
});

export async function signup(_: SignupState, fd: FormData): Promise<SignupState> {
  if (process.env.ALLOW_SIGNUP === "false") return { error: "El registro está cerrado por ahora" };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const key = `signup:${ip}`;
  if (isBlocked(key)) return { error: "Demasiados intentos. Espera unos minutos." };
  recordFailure(key); // cuenta cada intento para frenar registros masivos

  const parsed = schema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  if (await db.user.findUnique({ where: { email: d.email } })) return { error: "Ese correo ya tiene una cuenta. Inicia sesión." };

  const now = new Date();
  const user = await db.$transaction(async (tx) => {
    const clinic = await tx.clinic.create({
      data: { name: d.clinicName, nit: d.nit || null, status: "TRIAL", trialEndsAt: new Date(now.getTime() + 30 * 86_400_000), termsAcceptedAt: now, termsVersion: TERMS_VERSION },
    });
    return tx.user.create({ data: { clinicId: clinic.id, email: d.email, name: d.name, role: "ADMIN", passwordHash: await bcrypt.hash(d.password, 12) } });
  });
  await db.auditLog.create({ data: { userId: user.id, action: "SIGNUP", entity: "Clinic", entityId: user.clinicId } });
  await createSession({ userId: user.id, clinicId: user.clinicId, role: user.role });
  redirect("/inicio");
}
