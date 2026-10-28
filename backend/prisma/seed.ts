import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!name || !email || !password) {
    throw new Error("Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD before running the seed command.");
  }
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { email },
    update: { name, role: Role.ADMIN, isActive: true },
    create: { name, email, passwordHash, role: Role.ADMIN, isActive: true },
  });
  await prisma.category.upsert({
    where: { slug: "general" },
    update: {},
    create: { name: "General", slug: "general" },
  });
  console.info("Administrator seed completed.");
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
