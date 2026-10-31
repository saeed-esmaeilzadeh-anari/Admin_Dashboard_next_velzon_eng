import { BadRequestException, ConflictException } from "@nestjs/common";
import { CmsContentStatus, CmsFieldType, CmsMediaKind } from "@prisma/client";
import { CmsService } from "./cms.service";
import { PrismaService } from "../prisma/prisma.service";

describe("CmsService dynamic field validation", () => {
  const service = new CmsService({} as PrismaService);
  const validate = (service as unknown as {
    validateAndSplitFields: (input: Record<string, unknown>, fields: Array<Record<string, unknown>>, complete: boolean) =>
      { localizedData: Record<string, unknown>; sharedData: Record<string, unknown> };
  }).validateAndSplitFields.bind(service);
  const fields = [
    { key: "body", type: CmsFieldType.TEXTAREA, isRequired: true, isLocalized: true, isActive: true, config: null },
    { key: "featured", type: CmsFieldType.BOOLEAN, isRequired: false, isLocalized: false, isActive: true, config: null },
    { key: "status", type: CmsFieldType.SELECT, isRequired: true, isLocalized: true, isActive: true, config: { options: ["draft", "ready"] } },
  ];
  it("separates shared and localized values", () => {
    expect(validate({ body: "Hello", featured: false, status: "ready" }, fields, true)).toEqual({
      localizedData: { body: "Hello", status: "ready" },
      sharedData: { featured: false },
    });
  });
  it("rejects fields that are not present in the content schema", () => {
    expect(() => validate({ unexpected: "value" }, fields, false)).toThrow(BadRequestException);
  });
  it("enforces required fields when creating content", () => {
    expect(() => validate({ body: "Hello" }, fields, true)).toThrow("Required field is missing: status");
  });
  it("rejects the wrong value type", () => {
    expect(() => validate({ body: "Hello", featured: "yes", status: "ready" }, fields, true)).toThrow(BadRequestException);
  });
  it("enforces configured select choices", () => {
    expect(() => validate({ body: "Hello", status: "other" }, fields, true)).toThrow(BadRequestException);
  });
});


describe("CmsService public sitemap", () => {
  const findMany = jest.fn();
  const prisma = { contentTranslation: { findMany } } as unknown as PrismaService;
  const service = new CmsService(prisma);
  const originalSiteUrl = process.env.PUBLIC_SITE_URL;

  beforeEach(() => {
    findMany.mockReset();
    findMany.mockResolvedValue([{
      publishedSlug: "welcome",
      updatedAt: new Date("2026-10-29T08:00:00.000Z"),
      locale: { code: "en-US" },
      content: {
        contentType: { key: "article" },
        translations: [
          { publishedSlug: "welcome", locale: { code: "en-US" } },
          { publishedSlug: "khosh-amadid", locale: { code: "fa-IR" } },
        ],
      },
    }]);
    process.env.PUBLIC_SITE_URL = "https://example.test/";
  });

  afterAll(() => {
    if (originalSiteUrl === undefined) delete process.env.PUBLIC_SITE_URL;
    else process.env.PUBLIC_SITE_URL = originalSiteUrl;
  });

  it("includes published URLs and locale alternates in a valid XML document", async () => {
    const xml = await service.publicSitemapXml();
    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<loc>https://example.test/content/article/en-US/welcome</loc>");
    expect(xml).toContain('hreflang="fa-IR" href="https://example.test/content/article/fa-IR/khosh-amadid"');
    expect(xml).toContain("<lastmod>2026-10-29T08:00:00.000Z</lastmod>");
  });

  it("rejects a non-HTTP site origin instead of producing bad canonical URLs", async () => {
    process.env.PUBLIC_SITE_URL = "file:///tmp/cms";
    await expect(service.publicSitemapXml()).rejects.toThrow("PUBLIC_SITE_URL must be an HTTP(S) URL");
    expect(findMany).not.toHaveBeenCalled();
  });
});


describe("CmsService dashboard summary", () => {
  it("returns real counts, fills missing workflow statuses with zero and maps recent content", async () => {
    const prisma = {
      content: { count: jest.fn().mockResolvedValue(3) },
      contentTranslation: {
        count: jest.fn().mockResolvedValue(5),
        groupBy: jest.fn().mockResolvedValue([
          { status: CmsContentStatus.DRAFT, _count: { _all: 2 } },
          { status: CmsContentStatus.PUBLISHED, _count: { _all: 3 } },
        ]),
        findMany: jest.fn().mockResolvedValue([{
          id: "translation-1", contentId: "content-1", title: "Hello", slug: "hello",
          status: CmsContentStatus.PUBLISHED, version: 4, updatedAt: new Date("2026-10-29T09:00:00.000Z"),
          locale: { code: "en-US", nativeName: "English", direction: "LTR" },
          content: { contentType: { key: "article", name: "Article" } },
        }]),
      },
      locale: { count: jest.fn().mockResolvedValue(2) },
      contentType: { count: jest.fn().mockResolvedValue(4) },
    } as unknown as PrismaService;
    const summary = await new CmsService(prisma).dashboardSummary();

    expect(summary.contentCount).toBe(3);
    expect(summary.translationCount).toBe(5);
    expect(summary.activeLocaleCount).toBe(2);
    expect(summary.activeContentTypeCount).toBe(4);
    expect(summary.statusCounts).toEqual({
      [CmsContentStatus.DRAFT]: 2,
      [CmsContentStatus.IN_REVIEW]: 0,
      [CmsContentStatus.SCHEDULED]: 0,
      [CmsContentStatus.PUBLISHED]: 3,
      [CmsContentStatus.ARCHIVED]: 0,
    });
    expect(summary.recentlyUpdated[0]).toMatchObject({
      id: "translation-1", contentId: "content-1", title: "Hello", status: CmsContentStatus.PUBLISHED,
      contentType: { key: "article", name: "Article" }, locale: { code: "en-US", nativeName: "English" },
    });
  });
});


describe("CmsService page builder validation", () => {
  const service = new CmsService({} as PrismaService);
  const validateFieldValue = (service as unknown as {
    validateFieldValue: (field: Record<string, unknown>, value: unknown) => void;
  }).validateFieldValue.bind(service);
  const blocksField = {
    key: "blocks", type: CmsFieldType.JSON, isRequired: false,
    isLocalized: true, isActive: true, config: null,
  };

  it("accepts supported block types and safe internal/HTTPS links", () => {
    expect(() => validateFieldValue(blocksField, [
      { id: "a", type: "hero", title: "Welcome", buttonUrl: "/about" },
      { id: "b", type: "cardGrid", cards: [{ title: "Docs", url: "https://example.test/docs" }] },
    ])).not.toThrow();
  });

  it("rejects unsupported blocks and script URL schemes", () => {
    expect(() => validateFieldValue(blocksField, [{ type: "customHtml", html: "<script>alert(1)</script>" }]))
      .toThrow(BadRequestException);
    expect(() => validateFieldValue(blocksField, [{ type: "hero", buttonUrl: "javascript:alert(1)" }]))
      .toThrow(BadRequestException);
    expect(() => validateFieldValue(blocksField, [{ type: "hero", buttonUrl: "//evil.example/path" }]))
      .toThrow(BadRequestException);
  });

  it("limits the number of blocks and gallery assets", () => {
    expect(() => validateFieldValue(blocksField, Array.from({ length: 101 }, () => ({ type: "hero" }))))
      .toThrow(BadRequestException);
    const ids = Array.from({ length: 101 }, (_, index) => `00000000-0000-4000-8000-${String(index).padStart(12,"0")}`);
    expect(() => validateFieldValue(blocksField, [{ type: "gallery", mediaIds: ids }]))
      .toThrow(BadRequestException);
  });
});

describe("CmsService page builder media references", () => {
  const findMany = jest.fn();
  const service = new CmsService({ mediaAsset: { findMany } } as unknown as PrismaService);
  const assertMediaReferences = (service as unknown as {
    assertMediaReferences: (values: Record<string, unknown>, definitions: Array<Record<string, unknown>>) => Promise<void>;
  }).assertMediaReferences.bind(service);
  const definitions = [{
    key: "blocks", type: CmsFieldType.JSON, isRequired: false,
    isLocalized: true, isActive: true, config: null,
  }];
  const imageId = "6f4f1e5c-a4b2-4cb9-85b3-5dd52c7a0a11";

  beforeEach(() => findMany.mockReset());

  it("rejects missing media IDs referenced from image blocks", async () => {
    findMany.mockResolvedValue([]);
    await expect(assertMediaReferences({ blocks: [{ type: "image", mediaId: imageId }] }, definitions))
      .rejects.toThrow("One or more selected media assets no longer exist.");
  });

  it("rejects non-image media in image or gallery blocks", async () => {
    findMany.mockResolvedValue([{ id: imageId, kind: CmsMediaKind.DOCUMENT }]);
    await expect(assertMediaReferences({ blocks: [{ type: "image", mediaId: imageId }] }, definitions))
      .rejects.toThrow("Image and gallery blocks may reference image assets only.");
  });

  it("accepts existing image assets referenced by page builder blocks", async () => {
    findMany.mockResolvedValue([{ id: imageId, kind: CmsMediaKind.IMAGE }]);
    await expect(assertMediaReferences({ blocks: [{ type: "image", mediaId: imageId }] }, definitions))
      .resolves.toBeUndefined();
  });
});

describe("CmsService optimistic concurrency", () => {
  it("does not overwrite a translation that changed after the editor loaded it", async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const tx = {
      contentTranslation: { updateMany, findUniqueOrThrow: jest.fn() },
      contentRevision: { create: jest.fn() },
      auditLog: { create: jest.fn() },
    };
    const prisma = {
      $transaction: (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx),
      mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const service = new CmsService(prisma);
    const translation = {
      id: "translation-1", contentId: "content-1", localeId: "locale-1",
      title: "Old", slug: "old", excerpt: null, seoTitle: null, seoDescription: null,
      data: {}, status: CmsContentStatus.DRAFT, version: 7,
      publishedAt: null, scheduledAt: null, publishedSlug: null, publishedSnapshot: null,
      content: { id: "content-1", data: {}, contentType: { key: "page", name: "Page", isActive: true, fields: [] } },
    };
    jest.spyOn(service as unknown as { findTranslation: (...args: unknown[]) => Promise<unknown> }, "findTranslation")
      .mockResolvedValue(translation);
    await expect(service.updateTranslation("content-1", "en-US", { title: "New" }, { id: "editor-1" } as never))
      .rejects.toBeInstanceOf(ConflictException);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "translation-1", version: 7, status: CmsContentStatus.DRAFT },
    }));
    expect(tx.contentRevision.create).not.toHaveBeenCalled();
  });
});



describe("CmsService revision restoration", () => {
  const revisionFindFirst = jest.fn();
  const contentFindUnique = jest.fn();
  const contentUpdateMany = jest.fn();
  const translationUpdateMany = jest.fn();
  const translationFindUniqueOrThrow = jest.fn();
  const revisionCreate = jest.fn();
  const auditCreate = jest.fn();
  const tx = {
    content: { updateMany: contentUpdateMany },
    contentTranslation: { updateMany: translationUpdateMany, findUniqueOrThrow: translationFindUniqueOrThrow },
    contentRevision: { create: revisionCreate },
    auditLog: { create: auditCreate },
  };
  const prisma = {
    contentRevision: { findFirst: revisionFindFirst },
    content: { findUnique: contentFindUnique },
    $transaction: jest.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
  } as unknown as PrismaService;
  const service = new CmsService(prisma);
  const findTranslation = jest.spyOn(service as unknown as { findTranslation: (...args: unknown[]) => Promise<unknown> }, "findTranslation");
  const updatedAt = new Date("2026-10-29T08:00:00.000Z");
  const target = {
    id: "translation-fa", contentId: "content-1", localeId: "locale-fa", title: "Current",
    slug: "current", excerpt: null, seoTitle: null, seoDescription: null, data: { body: "current" },
    status: CmsContentStatus.PUBLISHED, version: 3, publishedAt: updatedAt, scheduledAt: null,
    publishedSlug: "current", publishedSnapshot: { title: "Live", data: {}, sharedData: {} },
    locale: { code: "fa-IR" },
  };
  const another = {
    id: "translation-en", contentId: "content-1", localeId: "locale-en", title: "English",
    slug: "english", excerpt: null, seoTitle: null, seoDescription: null, data: { body: "English" },
    status: CmsContentStatus.PUBLISHED, version: 5, publishedAt: updatedAt, scheduledAt: null,
    publishedSlug: "english", publishedSnapshot: { title: "Live English", data: {}, sharedData: {} },
    locale: { code: "en-US" },
  };
  const currentContent = { id: "content-1", data: { theme: "light" }, updatedAt, translations: [target, another] };
  const targetRecord = {
    id: target.id, contentId: target.contentId, localeId: target.localeId, title: "Restored title",
    slug: "restored-title", excerpt: null, seoTitle: null, seoDescription: null, data: { body: "Restored body" },
    status: CmsContentStatus.DRAFT, version: 4,
  };
  const otherRecord = {
    id: another.id, contentId: another.contentId, localeId: another.localeId, title: another.title,
    slug: another.slug, excerpt: null, seoTitle: null, seoDescription: null, data: another.data,
    status: CmsContentStatus.DRAFT, version: 6,
  };
  const snapshot = {
    title: "Restored title", slug: "restored-title", excerpt: null, seoTitle: null,
    seoDescription: null, data: { body: "Restored body" }, sharedData: { theme: "dark" },
  };
  const revision = { id: "revision-2", translationId: target.id, version: 2, snapshot };

  beforeEach(() => {
    jest.clearAllMocks();
    findTranslation.mockResolvedValue({
      ...target,
      content: { id: "content-1", data: currentContent.data, updatedAt, contentType: { key: "page", name: "Page", isActive: true, fields: [] } },
    });
    revisionFindFirst.mockResolvedValue(revision);
    contentFindUnique.mockResolvedValue(currentContent);
    contentUpdateMany.mockResolvedValue({ count: 1 });
    translationUpdateMany.mockResolvedValue({ count: 1 });
    translationFindUniqueOrThrow.mockResolvedValueOnce(targetRecord).mockResolvedValueOnce(otherRecord);
    revisionCreate.mockResolvedValue({});
    auditCreate.mockResolvedValue({});
  });

  it("fails safely if one locale changes while a revision is being restored", async () => {
    translationUpdateMany.mockResolvedValueOnce({ count: 0 });
    await expect(service.restoreRevision("content-1", "fa-IR", revision.id, { id: "editor-1" } as never))
      .rejects.toBeInstanceOf(ConflictException);
    expect(translationUpdateMany).toHaveBeenCalledTimes(1);
    expect(revisionCreate).not.toHaveBeenCalled();
    expect(auditCreate).not.toHaveBeenCalled();
  });

  it("restores the selected translation and advances all language versions when shared fields roll back", async () => {
    await service.restoreRevision("content-1", "fa-IR", revision.id, { id: "editor-1" } as never);
    expect(contentUpdateMany).toHaveBeenCalledWith({
      where: { id: "content-1", updatedAt },
      data: { data: { theme: "dark" } },
    });
    expect(translationUpdateMany).toHaveBeenNthCalledWith(1, {
      where: { id: target.id, version: 3, status: CmsContentStatus.PUBLISHED },
      data: expect.objectContaining({
        title: "Restored title", slug: "restored-title", status: CmsContentStatus.DRAFT,
        scheduledAt: null, version: 4,
      }),
    });
    expect(translationUpdateMany).toHaveBeenNthCalledWith(2, {
      where: { id: another.id, version: 5, status: CmsContentStatus.PUBLISHED },
      data: expect.objectContaining({ status: CmsContentStatus.DRAFT, scheduledAt: null, version: 6 }),
    });
    expect(revisionCreate).toHaveBeenCalledTimes(2);
    expect(revisionCreate.mock.calls[1][0].data.changeNote).toBe("Shared fields restored from revision 2");
    expect(auditCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: "cms.content.revision_restored",
        metadata: { contentId: "content-1", localeCode: "fa-IR", sourceVersion: 2, affectedTranslations: 2 },
      }),
    }));
  });
});


describe("CmsService content list filters", () => {
  const findMany = jest.fn();
  const count = jest.fn();
  const service = new CmsService({
    content: { findMany, count },
  } as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    findMany.mockResolvedValue([]);
    count.mockResolvedValue(0);
  });

  it("applies status, locale and search filters to both parent selection and included translations", async () => {
    await service.listContents({
      page: 2,
      limit: 20,
      typeKey: "article",
      localeCode: "fa-IR",
      status: CmsContentStatus.DRAFT,
      search: "hello",
    } as never);

    const query = findMany.mock.calls[0][0];
    const translationFilter = {
      locale: { is: { code: "fa-IR" } },
      status: CmsContentStatus.DRAFT,
      OR: [
        { title: { contains: "hello", mode: "insensitive" } },
        { slug: { contains: "hello", mode: "insensitive" } },
      ],
    };
    expect(query.where.contentType).toEqual({ is: { key: "article" } });
    expect(query.where.translations).toEqual({ some: translationFilter });
    expect(query.include.translations.where).toEqual(translationFilter);
    expect(query.skip).toBe(20);
    expect(query.take).toBe(20);
  });
});
