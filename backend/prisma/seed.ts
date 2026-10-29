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

  const permissionDefinitions: Array<{ code: string; name: string; description: string }> = [
    { code: "cms.content.read", name: "Read CMS content", description: "Read content and translations." },
    { code: "cms.content.create", name: "Create CMS content", description: "Create content records and language versions." },
    { code: "cms.content.edit", name: "Edit CMS content", description: "Edit draft content and shared fields." },
    { code: "cms.content.submit", name: "Submit for review", description: "Submit content to editorial review." },
    { code: "cms.content.review", name: "Review content", description: "Review, reject or return submitted content." },
    { code: "cms.content.publish", name: "Publish content", description: "Publish and schedule content." },
    { code: "cms.content.archive", name: "Archive content", description: "Archive or restore content." },
    { code: "cms.locales.manage", name: "Manage locales", description: "Create and configure content languages." },
    { code: "cms.content-types.manage", name: "Manage content types", description: "Create content schemas and fields." },
    { code: "cms.media.read", name: "Read media library", description: "View media assets." },
    { code: "cms.media.upload", name: "Upload media", description: "Upload new assets and edit metadata." },
    { code: "cms.media.delete", name: "Delete media", description: "Remove media assets." },
    { code: "cms.taxonomy.manage", name: "Manage taxonomies", description: "Create and organize taxonomies and terms." },
    { code: "cms.menus.manage", name: "Manage menus", description: "Manage localized navigation menus." },
    { code: "cms.redirects.manage", name: "Manage redirects", description: "Manage redirects." },
    { code: "cms.forms.manage", name: "Manage forms", description: "Create and configure public forms." },
    { code: "cms.forms.submissions.read", name: "Read form submissions", description: "Review public form submissions." },
    { code: "cms.forms.submissions.manage", name: "Manage form submissions", description: "Review or mark submissions as spam." },
    { code: "cms.webhooks.manage", name: "Manage webhooks", description: "Configure trusted outbound webhook endpoints." },
    { code: "cms.permissions.manage", name: "Manage CMS permissions", description: "Change role permission grants." }
  ];
  const seededPermissions = [];
  for (const definition of permissionDefinitions) {
    seededPermissions.push(await prisma.cmsPermission.upsert({
      where: { code: definition.code },
      update: { name: definition.name, description: definition.description },
      create: definition,
    }));
  }
  const adminGrantCount = await prisma.cmsRolePermission.count({ where: { role: Role.ADMIN } });
  if (adminGrantCount === 0) {
    await prisma.cmsRolePermission.createMany({ data: seededPermissions.map(permission => ({ role: Role.ADMIN, permissionId: permission.id })) });
  }
  const managerGrantCount = await prisma.cmsRolePermission.count({ where: { role: Role.MANAGER } });
  if (managerGrantCount === 0) {
    const managerCodes = new Set([
      "cms.content.read", "cms.content.create", "cms.content.edit", "cms.content.submit",
      "cms.content.review", "cms.media.read", "cms.media.upload", "cms.taxonomy.manage",
      "cms.menus.manage", "cms.redirects.manage", "cms.forms.manage",
      "cms.forms.submissions.read", "cms.forms.submissions.manage"
    ]);
    await prisma.cmsRolePermission.createMany({
      data: seededPermissions.filter(permission => managerCodes.has(permission.code)).map(permission => ({ role: Role.MANAGER, permissionId: permission.id })),
    });
  }

  await prisma.category.upsert({ where: { slug: "general" }, update: {}, create: { name: "General", slug: "general" } });
  console.info("Administrator, locales and starter content types seeded.");
}
main().catch(error => { console.error("Seed failed:", error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
