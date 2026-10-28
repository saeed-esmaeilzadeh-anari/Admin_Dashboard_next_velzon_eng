import "dotenv/config";
import { CmsFieldType, LocaleDirection, PrismaClient, Role } from "@prisma/client";
import * as bcrypt from "bcrypt";
const prisma = new PrismaClient();
async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!name || !email || !password) throw new Error("Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD before running the seed command.");
  if (password.length < 12) throw new Error("ADMIN_PASSWORD must contain at least 12 characters.");
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({ where: { email }, update: { name, role: Role.ADMIN, isActive: true }, create: { name, email, passwordHash, role: Role.ADMIN, isActive: true } });
  await prisma.locale.upsert({ where: { code: "fa-IR" },
    update: { name: "Persian", nativeName: "فارسی", direction: LocaleDirection.RTL, isDefault: true, isActive: true },
    create: { code: "fa-IR", name: "Persian", nativeName: "فارسی", direction: LocaleDirection.RTL, isDefault: true } });
  await prisma.locale.upsert({ where: { code: "en-US" },
    update: { name: "English (United States)", nativeName: "English", direction: LocaleDirection.LTR, isDefault: false, isActive: true },
    create: { code: "en-US", name: "English (United States)", nativeName: "English", direction: LocaleDirection.LTR, isDefault: false } });
  await prisma.contentType.upsert({ where: { key: "page" }, update: { name: "Page", isActive: true },
    create: { key: "page", name: "Page", description: "Multilingual website page.", fields: { create: [
      { key: "body", label: "Body", type: CmsFieldType.RICH_TEXT, isRequired: true, isLocalized: true, sortOrder: 10 },
      { key: "summary", label: "Summary", type: CmsFieldType.TEXTAREA, isLocalized: true, sortOrder: 20 },
      { key: "themeKey", label: "Theme key", type: CmsFieldType.TEXT, isLocalized: false, sortOrder: 30 },
    ] } } });
  await prisma.contentType.upsert({ where: { key: "article" }, update: { name: "Article", isActive: true },
    create: { key: "article", name: "Article", description: "Multilingual editorial article.", fields: { create: [
      { key: "body", label: "Body", type: CmsFieldType.RICH_TEXT, isRequired: true, isLocalized: true, sortOrder: 10 },
      { key: "summary", label: "Summary", type: CmsFieldType.TEXTAREA, isLocalized: true, sortOrder: 20 },
      { key: "featured", label: "Featured", type: CmsFieldType.BOOLEAN, isLocalized: false, sortOrder: 30 },
    ] } } });
  await prisma.category.upsert({ where: { slug: "general" }, update: {}, create: { name: "General", slug: "general" } });
  console.info("Administrator, locales and starter content types seeded.");
}
main().catch(error => { console.error("Seed failed:", error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
