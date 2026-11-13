"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClinician } from "@/lib/dal";

// Frases frecuentes propias del profesional (no son parte de la historia clínica: solo ayudan a escribir).
export async function addPhrase(label: string, text: string): Promise<{ error?: string }> {
  const user = await requireClinician();
  const l = label.trim().slice(0, 40);
  const t = text.trim().slice(0, 1000);
  if (l.length < 2) return { error: "Ponle un nombre corto a la frase" };
  if (t.length < 3) return { error: "Escribe la frase en la nota primero" };
  if ((await db.notePhrase.count({ where: { userId: user.id } })) >= 40) return { error: "Tienes 40 frases. Quita alguna para guardar otra." };
  await db.notePhrase.create({ data: { userId: user.id, label: l, text: t } });
  revalidatePath("/pacientes/[id]", "page");
  return {};
}

export async function removePhrase(id: string): Promise<void> {
  const user = await requireClinician();
  await db.notePhrase.deleteMany({ where: { id, userId: user.id } });
  revalidatePath("/pacientes/[id]", "page");
}
