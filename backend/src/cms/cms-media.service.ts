import {
  BadRequestException, Injectable, Logger, NotFoundException,
} from "@nestjs/common";
import { CmsMediaKind, Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { basename, extname, resolve } from "node:path";
import { mkdir, unlink, writeFile } from "node:fs/promises";
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
  constructor(private readonly prisma: PrismaService) {}

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
    const [data,total] = await Promise.all([
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
    const maxBytes = Number(process.env.CMS_MAX_UPLOAD_BYTES ?? 25 * 1024 * 1024);
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 1024) throw new BadRequestException("CMS_MAX_UPLOAD_BYTES configuration is invalid.");
    if (file.size > maxBytes || file.buffer.length > maxBytes) throw new BadRequestException("File exceeds the configured upload limit.");
    const safeOriginalName = basename(file.originalname || "upload").replace(/[\r\n\u0000-\u001f]/g, "").slice(0, 255) || "upload";
    const extension = MIME_EXTENSIONS[file.mimetype];
    const storageKey = randomUUID() + extension;
    const root = resolve(process.env.UPLOAD_DIR ?? "uploads", "media");
    await mkdir(root, { recursive: true });
    const fullPath = resolve(root, storageKey);
    if (resolve(fullPath) !== fullPath || basename(fullPath) !== storageKey || extname(fullPath) !== extension) {
      throw new BadRequestException("Unable to create a safe storage path.");
    }
    await writeFile(fullPath, file.buffer, { flag: "wx", mode: 0o640 });
    try {
      return await this.prisma.mediaAsset.create({
        data: {
          storageKey, originalName: safeOriginalName, mimeType: file.mimetype,
          kind: mediaKind(file.mimetype), sizeBytes: file.buffer.length,
          url: "/uploads/media/" + storageKey, altText: altText?.slice(0, 500), caption: caption?.slice(0, 1000),
          uploadedById: userId,
        },
        include: { uploadedBy: { select: { id: true, name: true, email: true } } },
      });
    } catch (error) {
      await unlink(fullPath).catch(unlinkError => this.logger.warn("Failed to clean up orphan media upload: " + String(unlinkError)));
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
    await this.prisma.mediaAsset.delete({ where: { id } });
    const root = resolve(process.env.UPLOAD_DIR ?? "uploads", "media");
    const safeKey = basename(asset.storageKey);
    if (safeKey !== asset.storageKey || !/^[a-f0-9-]{36}\.[a-z0-9]{1,8}$/i.test(safeKey)) {
      this.logger.error("Refusing to remove a path that is outside the media key format: " + asset.storageKey);
      return { id, deleted: true, fileRemoved: false };
    }
    try { await unlink(resolve(root, safeKey)); return { id, deleted: true, fileRemoved: true }; }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return { id, deleted: true, fileRemoved: true };
      this.logger.error("Media metadata was deleted but the physical file could not be removed: " + String(error));
      return { id, deleted: true, fileRemoved: false };
    }
  }
}
