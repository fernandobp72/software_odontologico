import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Cuenta del dueño de la plataforma: vive en un consultorio interno (system) y solo ve clientes.
// Al crearla se retira el permiso de plataforma de cualquier otra cuenta de consultorio.
async function platformAccount() {
  const password = process.env.SEED_PLATFORM_PASSWORD;
  const email = process.env.SEED_PLATFORM_EMAIL?.toLowerCase();
  if (!password || !email) return;
  const clinic = await db.clinic.upsert({ where: { id: "plataforma" }, update: { system: true }, create: { id: "plataforma", name: "Plataforma", system: true } });
  await db.user.upsert({
    where: { email },
    update: { isPlatformAdmin: true, ...(process.env.SEED_RESET === "1" ? { passwordHash: await bcrypt.hash(password, 12) } : {}) },
    create: { clinicId: clinic.id, email, name: process.env.SEED_PLATFORM_NAME ?? "Dueño de la plataforma", role: "ADMIN", isPlatformAdmin: true, passwordHash: await bcrypt.hash(password, 12) },
  });
  await db.user.updateMany({ where: { isPlatformAdmin: true, clinicId: { not: clinic.id } }, data: { isPlatformAdmin: false } });
  console.log(`Cuenta de plataforma lista: ${email}`);
}

async function main() {
  await platformAccount();
  const password = process.env.SEED_PASSWORD;
  if (!password) return;

  const email = (process.env.SEED_EMAIL ?? "admin@demo.co").toLowerCase();
  const clinic = await db.clinic.upsert({
    where: { id: "clinica-demo" },
    update: {},
    create: { id: "clinica-demo", name: "Consultorio Demo" },
  });
  const branch = await db.branch.upsert({
    where: { id: `br_${clinic.id}` },
    update: {},
    create: { id: `br_${clinic.id}`, clinicId: clinic.id, name: "Sede principal" },
  });
  const demo = await db.user.upsert({
    where: { email },
    // Idempotente: no pisa la contraseña de un usuario existente salvo que SEED_RESET=1.
    update: process.env.SEED_RESET === "1" ? { passwordHash: await bcrypt.hash(password, 12) } : {},
    create: {
      clinicId: clinic.id,
      email,
      name: process.env.SEED_NAME ?? "Administrador",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  await db.userBranch.upsert({ where: { userId_branchId: { userId: demo.id, branchId: branch.id } }, update: {}, create: { userId: demo.id, branchId: branch.id } });
  if (process.env.SEED_PLATFORM_ADMIN === "1" && !process.env.SEED_PLATFORM_EMAIL) await db.user.update({ where: { email }, data: { isPlatformAdmin: true } });
  console.log(`Usuario listo: ${email} (contraseña tomada de SEED_PASSWORD)`);
}

main().finally(() => db.$disconnect());
