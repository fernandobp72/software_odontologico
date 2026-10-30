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
  await db.user.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(password, 12) },
    create: {
      clinicId: clinic.id,
      email,
      name: process.env.SEED_NAME ?? "Administrador",
      role: "ADMIN",
      passwordHash: await bcrypt.hash(password, 12),
    },
  });
  console.log(`Usuario listo: ${email} (contraseña tomada de SEED_PASSWORD)`);
}

main().finally(() => db.$disconnect());
