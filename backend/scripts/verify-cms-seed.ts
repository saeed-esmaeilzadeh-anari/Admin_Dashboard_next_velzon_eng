import "dotenv/config";
import assert from "node:assert/strict";
import { CmsContentStatus, CmsFieldType, LocaleDirection, PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
if (!adminEmail) throw new Error("ADMIN_EMAIL must be configured for the CMS database smoke check.");

async function main() {
  const [admin, locales, pageType, articleType, permissions, grants] = await Promise.all([
    prisma.user.findUnique({ where: { email: adminEmail } }),
    prisma.locale.findMany({ where: { code: { in: ["fa-IR", "en-US"] } } }),
    prisma.contentType.findUnique({ where: { key: "page" }, include: { fields: true } }),
    prisma.contentType.findUnique({ where: { key: "article" }, include: { fields: true } }),
    prisma.cmsPermission.findMany({ select: { id: true, code: true } }),
    prisma.cmsRolePermission.findMany({
      where: { role: Role.ADMIN },
      include: { permission: { select: { code: true } } },
    }),
  ]);

  assert.ok(admin, "The seed must create the configured administrator.");
  assert.equal(admin.role, Role.ADMIN, "The seeded account must have the administrator role.");
  assert.equal(admin.isActive, true, "The seeded administrator must be active.");

  const fa = locales.find(locale => locale.code === "fa-IR");
  const en = locales.find(locale => locale.code === "en-US");
  assert.ok(fa, "Persian locale should exist.");
  assert.ok(en, "English locale should exist.");
  assert.equal(fa.direction, LocaleDirection.RTL);
  assert.equal(fa.isDefault, true);
  assert.equal(en.direction, LocaleDirection.LTR);
  assert.equal(en.isDefault, false);
  assert.equal(await prisma.locale.count({ where: { isDefault: true, isActive: true } }), 1,
    "Exactly one active default locale is expected after seeding.");

  assert.ok(pageType, "Page content type should exist.");
  assert.ok(articleType, "Article content type should exist.");
  const pageFields = new Map(pageType.fields.map(field => [field.key, field]));
  const articleFields = new Map(articleType.fields.map(field => [field.key, field]));
  assert.equal(pageFields.get("coverImage")?.type, CmsFieldType.MEDIA);
  assert.equal(pageFields.get("gallery")?.type, CmsFieldType.MEDIA_MULTIPLE);
  assert.equal(pageFields.get("blocks")?.type, CmsFieldType.JSON);
  assert.equal(articleFields.get("coverImage")?.type, CmsFieldType.MEDIA);
  assert.equal(pageFields.get("body")?.isRequired, true);

  const expectedPermissions = [
    "cms.content.read", "cms.content.create", "cms.content.edit", "cms.content.submit",
    "cms.content.review", "cms.content.publish", "cms.content.archive",
    "cms.locales.manage", "cms.content-types.manage", "cms.media.read", "cms.media.upload",
    "cms.media.delete", "cms.taxonomy.manage", "cms.menus.manage", "cms.redirects.manage",
    "cms.forms.manage", "cms.forms.submissions.read", "cms.forms.submissions.manage",
    "cms.webhooks.manage", "cms.permissions.manage", "cms.audit.read",
  ];
  const permissionCodes = new Set(permissions.map(permission => permission.code));
  for (const code of expectedPermissions) assert.ok(permissionCodes.has(code), `Missing CMS permission: ${code}`);
  const adminGrantCodes = new Set(grants.map(grant => grant.permission.code));
  for (const code of expectedPermissions) assert.ok(adminGrantCodes.has(code), `ADMIN is missing permission grant: ${code}`);

  const managerGrants = await prisma.cmsRolePermission.findMany({
    where: { role: Role.MANAGER },
    include: { permission: { select: { code: true } } },
  });
  const managerCodes = new Set(managerGrants.map(grant => grant.permission.code));
  assert.equal(managerCodes.has("cms.content.publish"), false, "Managers must not implicitly receive publish permission.");
  assert.equal(managerCodes.has("cms.permissions.manage"), false, "Managers must not manage role grants.");

  // Exercise the CMS's critical FK chain against the migrated database. Throwing inside
  // the transaction intentionally rolls back the smoke records after all reads succeed.
  const rollbackMarker = "CMS_DATABASE_SMOKE_ROLLBACK";
  try {
    await prisma.$transaction(async tx => {
      const content = await tx.content.create({
        data: { contentTypeId: pageType.id, createdById: admin.id, data: { themeKey: "ci-smoke" } },
      });
      const translation = await tx.contentTranslation.create({
        data: {
          contentId: content.id, localeId: en.id, title: "CI smoke content",
          slug: "ci-smoke-" + Date.now().toString(36), data: { summary: "Temporary" },
        },
      });
      await tx.contentRevision.create({
        data: {
          translationId: translation.id, version: 1, createdById: admin.id,
          changeNote: "CI database smoke test",
          snapshot: { title: translation.title, slug: translation.slug, data: translation.data, sharedData: content.data },
        },
      });
      const roundTrip = await tx.content.findUniqueOrThrow({
        where: { id: content.id },
        include: { contentType: true, createdBy: true, translations: { include: { locale: true, revisions: true } } },
      });
      assert.equal(roundTrip.contentType.key, "page");
      assert.equal(roundTrip.createdBy?.id, admin.id);
      assert.equal(roundTrip.translations[0]?.locale.code, "en-US");
      assert.equal(roundTrip.translations[0]?.status, CmsContentStatus.DRAFT);
      assert.equal(roundTrip.translations[0]?.revisions.length, 1);
      throw new Error(rollbackMarker);
    });
  } catch (error) {
    if (!(error instanceof Error) || error.message !== rollbackMarker) throw error;
  }

  console.info("CMS PostgreSQL smoke check passed: admin, locale, dynamic schemas, permissions and revision relationships.");
}

main().catch(error => {
  console.error("CMS database smoke check failed:", error);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
