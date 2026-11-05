import "dotenv/config";
import assert from "node:assert/strict";
import { CmsContentStatus, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const expected = [
  { locale: "fa-IR", slug: "welcome-to-velzon-cms", title: "به Velzon Enterprise CMS خوش آمدید" },
  { locale: "en-US", slug: "welcome-to-velzon-cms", title: "Welcome to Velzon Enterprise CMS" },
  { locale: "fa-IR", slug: "portfolio-full-stack-showcase", title: "معماری یک پروژه Full-Stack" },
  { locale: "en-US", slug: "portfolio-full-stack-showcase", title: "Inside a Full-Stack Project" },
];

async function main() {
  for (const item of expected) {
    const translation = await prisma.contentTranslation.findFirst({
      where: {
        locale: { is: { code: item.locale } },
        slug: item.slug,
        content: { is: { contentType: { is: { key: "article" } } } },
      },
      include: {
        locale: true,
        content: { include: { contentType: true } },
        revisions: true,
      },
    });

    assert.ok(translation, "Missing demo translation: " + item.locale + "/" + item.slug);
    assert.equal(translation.title, item.title);
    assert.equal(translation.status, CmsContentStatus.PUBLISHED);
    assert.equal(translation.publishedSlug, item.slug);
    assert.ok(translation.publishedAt);
    assert.ok(translation.publishedSnapshot);
    assert.equal(translation.content.contentType.key, "article");
    assert.equal(translation.revisions.length, 1);
    assert.equal(translation.revisions[0]?.version, translation.version);

    const snapshot = translation.publishedSnapshot as {
      data?: { body?: unknown; summary?: unknown };
      sharedData?: { featured?: unknown };
    };
    assert.equal(typeof snapshot.data?.body, "string");
    assert.equal(typeof snapshot.data?.summary, "string");
    assert.equal(typeof snapshot.sharedData?.featured, "boolean");
  }

  console.info("Portfolio demo content verification passed for fa-IR/en-US and revision snapshots.");
}

main()
  .catch(error => {
    console.error("Portfolio demo content verification failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
