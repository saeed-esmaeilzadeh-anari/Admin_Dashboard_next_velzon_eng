import { ConflictException } from "@nestjs/common";
import { CmsFieldType } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { CmsMediaStorageService } from "./cms-media-storage.service";
import { CmsMediaService } from "./cms-media.service";

describe("CmsMediaService media reference protection", () => {
  const definitions = jest.fn();
  const contentFindFirst = jest.fn();
  const translationFindFirst = jest.fn();
  const revisionFindFirst = jest.fn();
  const storageDelete = jest.fn();

  const prisma = {
    contentTypeField: { findMany: definitions },
    content: { findFirst: contentFindFirst },
    contentTranslation: { findFirst: translationFindFirst },
    contentRevision: { findFirst: revisionFindFirst },
  } as unknown as PrismaService;
  const storage = {
    delete: storageDelete,
  } as unknown as CmsMediaStorageService;
  const service = new CmsMediaService(prisma, storage);
  const assertNotReferenced = (service as unknown as {
    assertAssetIsNotReferenced: (id: string) => Promise<void>;
  }).assertAssetIsNotReferenced.bind(service);

  beforeEach(() => {
    jest.clearAllMocks();
    definitions.mockResolvedValue([
      { key: "coverImage", type: CmsFieldType.MEDIA, isLocalized: true },
      { key: "gallery", type: CmsFieldType.MEDIA_MULTIPLE, isLocalized: false },
    ]);
    contentFindFirst.mockResolvedValue(null);
    translationFindFirst.mockResolvedValue(null);
    revisionFindFirst.mockResolvedValue(null);
  });

  it("blocks deletion when a published snapshot still uses the media asset", async () => {
    translationFindFirst.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "published-translation" });

    await expect(assertNotReferenced("media-1")).rejects.toBeInstanceOf(ConflictException);

    expect(translationFindFirst).toHaveBeenCalledTimes(2);
    expect(translationFindFirst.mock.calls[1][0].where.publishedSlug).toEqual({ not: null });
    expect(translationFindFirst.mock.calls[1][0].where.OR).toEqual(expect.arrayContaining([
      { publishedSnapshot: { path: ["data", "coverImage"], equals: "media-1" } },
      { publishedSnapshot: { path: ["sharedData", "gallery"], array_contains: ["media-1"] } },
    ]));
  });

  it("blocks deletion when a historical revision still references the asset", async () => {
    revisionFindFirst.mockResolvedValue({ id: "revision-1" });

    await expect(assertNotReferenced("media-1")).rejects.toBeInstanceOf(ConflictException);

    expect(revisionFindFirst).toHaveBeenCalledWith({
      where: {
        OR: expect.arrayContaining([
          { snapshot: { path: ["data", "coverImage"], equals: "media-1" } },
          { snapshot: { path: ["sharedData", "gallery"], array_contains: ["media-1"] } },
        ]),
      },
      select: { id: true },
    });
  });

  it("allows deletion checks when no current, published or historical references exist", async () => {
    await expect(assertNotReferenced("media-1")).resolves.toBeUndefined();
    expect(contentFindFirst).toHaveBeenCalledTimes(1);
    expect(translationFindFirst).toHaveBeenCalledTimes(2);
    expect(revisionFindFirst).toHaveBeenCalledTimes(1);
  });
});
