import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error("Define SEED_PASSWORD en .env");

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
  if (process.env.SEED_PLATFORM_ADMIN === "1") await db.user.update({ where: { email }, data: { isPlatformAdmin: true } });
  console.log(`Usuario listo: ${email} (contraseña tomada de SEED_PASSWORD)`);
}

main().finally(() => db.$disconnect());
