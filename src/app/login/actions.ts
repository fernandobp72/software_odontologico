"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession } from "@/lib/session";
import { clearFailures, isBlocked, recordFailure } from "@/lib/rate-limit";

const schema = z.object({
  email: z.string().email("Correo inválido"),
  password: z.string().min(1, "Ingresa tu contraseña"),
});

export type LoginState = { error?: string } | undefined;

export async function login(_: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const email = parsed.data.email.toLowerCase();
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const keys = [`email:${email}`, `ip:${ip}`];
  if (keys.some(isBlocked)) return { error: "Demasiados intentos. Espera 15 minutos e inténtalo de nuevo." };

  const user = await db.user.findUnique({ where: { email } });
  // Mismo mensaje y mismo costo de bcrypt exista o no el usuario.
  const hash = user?.passwordHash ?? "$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi";
  const ok = await bcrypt.compare(parsed.data.password, hash);
  if (!user || !user.active || !ok) {
    keys.forEach(recordFailure);
    return { error: "Correo o contraseña incorrectos" };
  }
  keys.forEach(clearFailures);

  await createSession({ userId: user.id, clinicId: user.clinicId, role: user.role });
  redirect("/agenda");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
