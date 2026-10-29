import {
  BadRequestException, ConflictException, Injectable, Logger, NotFoundException,
} from "@nestjs/common";
import { CmsFieldType, CmsMediaKind, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";
import { CmsMediaStorageService } from "./cms-media-storage.service";
import { Express } from "express";
import { PrismaService } from "../prisma/prisma.service";
import { ListMediaQueryDto, UpdateMediaAssetDto } from "./cms-management.dto";

const MIME_EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif", "image/avif": ".avif",
  "application/pdf": ".pdf", "text/plain": ".txt", "text/csv": ".csv",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  "audio/mpeg": ".mp3", "audio/wav": ".wav", "audio/ogg": ".ogg", "audio/mp4": ".m4a",
  "video/mp4": ".mp4", "video/webm": ".webm",
};
function hasSignature(mime: string, data: Buffer): boolean {
  const ascii = (start: number, end: number) => data.toString("ascii", start, end);
  if (mime === "image/jpeg") return data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (mime === "image/png") return data.length >= 8 && data.subarray(0, 8).equals(Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]));
  if (mime === "image/webp") return data.length >= 12 && ascii(0,4) === "RIFF" && ascii(8,12) === "WEBP";
  if (mime === "image/gif") return data.length >= 6 && (ascii(0,6) === "GIF87a" || ascii(0,6) === "GIF89a");
  if (mime === "image/avif") return data.length >= 12 && ascii(4,8) === "ftyp" && /^(avif|avis)$/.test(ascii(8,12));
  if (mime === "application/pdf") return ascii(0,5) === "%PDF-";
  if (mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mime === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") {
    return data.length >= 4 && data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04;
  }
  if (mime === "audio/mpeg") return ascii(0,3) === "ID3" || (data.length >= 2 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
  if (mime === "audio/wav") return data.length >= 12 && ascii(0,4) === "RIFF" && ascii(8,12) === "WAVE";
  if (mime === "audio/ogg") return ascii(0,4) === "OggS";
  if (mime === "audio/mp4" || mime === "video/mp4") return data.length >= 12 && ascii(4,8) === "ftyp";
  if (mime === "video/webm") return data.length >= 4 && data.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]));
  if (mime === "text/plain" || mime === "text/csv") return !data.subarray(0, Math.min(data.length, 8192)).includes(0);
  return false;
}
function mediaKind(mime: string): CmsMediaKind {
  if (mime.startsWith("image/")) return CmsMediaKind.IMAGE;
  if (mime.startsWith("video/")) return CmsMediaKind.VIDEO;
  if (mime.startsWith("audio/")) return CmsMediaKind.AUDIO;
  if (mime.startsWith("application/") || mime.startsWith("text/")) return CmsMediaKind.DOCUMENT;
  return CmsMediaKind.OTHER;
}

@Injectable()
export class CmsMediaService {
  private readonly logger = new Logger(CmsMediaService.name);
  constructor(private readonly prisma: PrismaService, private readonly storage: CmsMediaStorageService) {}

  async list(query: ListMediaQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 30));
    const where: Prisma.MediaAssetWhereInput = {};
    if (query.kind) where.kind = query.kind;
    if (query.search?.trim()) {
      where.OR = [
        { originalName: { contains: query.search.trim(), mode: "insensitive" } },
        { altText: { contains: query.search.trim(), mode: "insensitive" } },
        { caption: { contains: query.search.trim(), mode: "insensitive" } },
      ];
    }
    const [data, total] = await Promise.all([
      this.prisma.mediaAsset.findMany({
        where, skip: (page - 1) * limit, take: limit, orderBy: { createdAt: "desc" },
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      }),
      this.prisma.mediaAsset.count({ where }),
    ]);
    return { data, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  async upload(file: Express.Multer.File, userId: string, altText?: string, caption?: string) {
    if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) throw new BadRequestException("A non-empty file is required.");
    if (!MIME_EXTENSIONS[file.mimetype]) throw new BadRequestException("This file type is not allowed.");
    if (!hasSignature(file.mimetype, file.buffer)) throw new BadRequestException("File content does not match its declared media type.");
    const maxBytes = Number(process.env.CMS_MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024);
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024) throw new BadRequestException("CMS_MAX_UPLOAD_BYTES configuration is invalid.");
    if (file.size > maxBytes || file.buffer.length > maxBytes) throw new BadRequestException("File exceeds the configured upload limit.");
    const safeOriginalName = basename(file.originalname || "upload").replace(/[\r\n\u0000-\u001f]/g, "").slice(0, 255) || "upload";
    const extension = MIME_EXTENSIONS[file.mimetype];
    const storageKey = randomUUID() + extension;
    const url = this.storage.publicUrl(storageKey);
    await this.storage.put(storageKey, file.mimetype, file.buffer);
    try {
      return await this.prisma.mediaAsset.create({
        data: {
          storageKey, originalName: safeOriginalName, mimeType: file.mimetype,
          kind: mediaKind(file.mimetype), sizeBytes: file.buffer.length,
          url, altText: altText?.slice(0, 500), caption: caption?.slice(0, 1000),
          uploadedById: userId,
        },
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      });
    } catch (error) {
      await this.storage.delete(storageKey).catch(cleanupError => this.logger.warn("Failed to clean up orphan media upload: " + String(cleanupError)));
      throw error;
    }
  }

  async update(id: string, dto: UpdateMediaAssetDto) {
    const current = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!current) throw new NotFoundException("Media asset not found.");
    const data: Prisma.MediaAssetUpdateInput = {};
    if (dto.altText !== undefined) data.altText = dto.altText;
    if (dto.caption !== undefined) data.caption = dto.caption;
    return this.prisma.mediaAsset.update({ where: { id }, data, include: { uploadedBy: { select: { id: true, name: true, email: true } } } });
  }

  async delete(id: string) {
    const asset = await this.prisma.mediaAsset.findUnique({ where: { id } });
    if (!asset) throw new NotFoundException("Media asset not found.");
    await this.assertAssetIsNotReferenced(id);
    // Remove the object first. If storage deletion fails, keep its metadata so an administrator can retry.
    await this.storage.delete(asset.storageKey);
    await this.prisma.mediaAsset.delete({ where: { id } });
    return { id, deleted: true, fileRemoved: true };
  }

  private async assertAssetIsNotReferenced(mediaId: string) {
    const definitions = await this.prisma.contentTypeField.findMany({
      where: { isActive: true, type: { in: [CmsFieldType.MEDIA, CmsFieldType.MEDIA_MULTIPLE] } },
      select: { key: true, type: true, isLocalized: true },
    });
    const contentConditions: Prisma.ContentWhereInput[] = [
      // The built-in page builder stores media IDs in blocks JSON rather than individual dynamic fields.
      { data: { path: ["blocks"], array_contains: [{ mediaId }] } },
      { data: { path: ["blocks"], array_contains: [{ mediaIds: [mediaId] }] } },
      ...definitions.filter(field => !field.isLocalized).map(field =>
        field.type === CmsFieldType.MEDIA
          ? { data: { path: [field.key], equals: mediaId } } as Prisma.ContentWhereInput
          : { data: { path: [field.key], array_contains: [mediaId] } } as Prisma.ContentWhereInput,
      ),
    ];
    const translationConditions: Prisma.ContentTranslationWhereInput[] = [
      { data: { path: ["blocks"], array_contains: [{ mediaId }] } },
      { data: { path: ["blocks"], array_contains: [{ mediaIds: [mediaId] }] } },
      ...definitions.filter(field => field.isLocalized).map(field =>
        field.type === CmsFieldType.MEDIA
          ? { data: { path: [field.key], equals: mediaId } } as Prisma.ContentTranslationWhereInput
          : { data: { path: [field.key], array_contains: [mediaId] } } as Prisma.ContentTranslationWhereInput,
      ),
    ];
    // Keep assets used by a live publication or a restorable historical revision too.
    // Otherwise editing a draft and deleting its old media could silently break the public snapshot
    // or make a revision impossible to restore.
    const snapshotConditions = (
      field: { key: string; type: CmsFieldType; isLocalized: boolean },
      snapshotRoot: "data" | "sharedData",
      column: "publishedSnapshot" | "snapshot",
    ): Prisma.ContentTranslationWhereInput | Prisma.ContentRevisionWhereInput => {
      const path = [snapshotRoot, field.key];
      return column === "publishedSnapshot"
        ? field.type === CmsFieldType.MEDIA
          ? { publishedSnapshot: { path, equals: mediaId } }
          : { publishedSnapshot: { path, array_contains: [mediaId] } }
        : field.type === CmsFieldType.MEDIA
          ? { snapshot: { path, equals: mediaId } }
          : { snapshot: { path, array_contains: [mediaId] } };
    };
    const snapshotBlockConditions = (column: "publishedSnapshot" | "snapshot") => {
      const make = (path: string[]) => column === "publishedSnapshot"
        ? { publishedSnapshot: { path, array_contains: [{ mediaId }] } }
        : { snapshot: { path, array_contains: [{ mediaId }] } };
      const makeGallery = (path: string[]) => column === "publishedSnapshot"
        ? { publishedSnapshot: { path, array_contains: [{ mediaIds: [mediaId] }] } }
        : { snapshot: { path, array_contains: [{ mediaIds: [mediaId] }] } };
      return [
        make([column === "publishedSnapshot" ? "data" : "data", "blocks"]),
        make([column === "publishedSnapshot" ? "sharedData" : "sharedData", "blocks"]),
        makeGallery(["data", "blocks"]),
        makeGallery(["sharedData", "blocks"]),
      ];
    };
    const publicationConditions = [
      ...snapshotBlockConditions("publishedSnapshot"),
      ...definitions.map(field => snapshotConditions(field, field.isLocalized ? "data" : "sharedData", "publishedSnapshot")),
    ] as Prisma.ContentTranslationWhereInput[];
    const revisionConditions = [
      ...snapshotBlockConditions("snapshot"),
      ...definitions.map(field => snapshotConditions(field, field.isLocalized ? "data" : "sharedData", "snapshot")),
    ] as Prisma.ContentRevisionWhereInput[];
    const [contentReference, translationReference, publicationReference, revisionReference] = await Promise.all([
      this.prisma.content.findFirst({ where: { OR: contentConditions }, select: { id: true } }),
      this.prisma.contentTranslation.findFirst({ where: { OR: translationConditions }, select: { id: true } }),
      this.prisma.contentTranslation.findFirst({
        where: { publishedSlug: { not: null }, OR: publicationConditions },
        select: { id: true },
      }),
      this.prisma.contentRevision.findFirst({ where: { OR: revisionConditions }, select: { id: true } }),
    ]);
    if (contentReference || translationReference || publicationReference || revisionReference) {
      throw new ConflictException("This media asset is used by current content, a published snapshot, or a saved revision. Remove its references before deleting it.");
    }
  }
}
