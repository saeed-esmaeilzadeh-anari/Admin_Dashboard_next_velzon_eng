import { BadRequestException } from "@nestjs/common";
import { CmsFieldType } from "@prisma/client";
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
