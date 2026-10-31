import { Injectable, Logger } from "@nestjs/common";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

type StorageMode = "local" | "s3";

@Injectable()
export class CmsMediaStorageService {
  private readonly logger = new Logger(CmsMediaStorageService.name);
  private readonly mode: StorageMode;
  private readonly localRoot: string;
  private readonly bucket: string | undefined;
  private readonly publicBaseUrl: string | undefined;
  private readonly client: S3Client | undefined;

  constructor() {
    const configuredMode = (process.env.CMS_MEDIA_STORAGE ?? "local").trim().toLowerCase();
    if (configuredMode !== "local" && configuredMode !== "s3") {
      throw new Error("CMS_MEDIA_STORAGE must be either 'local' or 's3'.");
    }
    this.mode = configuredMode;
    this.localRoot = resolve(process.env.UPLOAD_DIR ?? "uploads", "media");

    if (this.mode === "s3") {
      this.bucket = process.env.S3_BUCKET?.trim();
      const region = process.env.S3_REGION?.trim() || "us-east-1";
      const endpoint = process.env.S3_ENDPOINT?.trim() || undefined;
      const accessKeyId = process.env.S3_ACCESS_KEY_ID?.trim();
      const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY?.trim();
      const publicBase = process.env.S3_PUBLIC_BASE_URL?.trim();
      if (!this.bucket) throw new Error("S3_BUCKET is required when CMS_MEDIA_STORAGE=s3.");
      if (!publicBase) throw new Error("S3_PUBLIC_BASE_URL is required when CMS_MEDIA_STORAGE=s3.");
      let parsedPublicBase: URL;
      try { parsedPublicBase = new URL(publicBase); }
      catch { throw new Error("S3_PUBLIC_BASE_URL must be a valid HTTP(S) URL."); }
      if (parsedPublicBase.protocol !== "https:" && parsedPublicBase.protocol !== "http:") {
        throw new Error("S3_PUBLIC_BASE_URL must use HTTP or HTTPS.");
      }
      if (Boolean(accessKeyId) !== Boolean(secretAccessKey)) {
        throw new Error("S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY must be configured together.");
      }
      this.publicBaseUrl = parsedPublicBase.toString().replace(/\/+$/, "");
      this.client = new S3Client({
        region,
        ...(endpoint ? { endpoint } : {}),
        forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
        ...(accessKeyId && secretAccessKey ? { credentials: { accessKeyId, secretAccessKey } } : {}),
      });
    }
  }

  publicUrl(storageKey: string): string {
    this.assertSafeKey(storageKey);
    if (this.mode === "local") return "/uploads/media/" + storageKey;
    return this.publicBaseUrl + "/media/" + encodeURIComponent(storageKey);
  }

  async put(storageKey: string, mimeType: string, data: Buffer): Promise<void> {
    this.assertSafeKey(storageKey);
    if (this.mode === "local") {
      await mkdir(this.localRoot, { recursive: true });
      await writeFile(resolve(this.localRoot, storageKey), data, { flag: "wx", mode: 0o640 });
      return;
    }
    await this.client!.send(new PutObjectCommand({
      Bucket: this.bucket!,
      Key: "media/" + storageKey,
      Body: data,
      ContentLength: data.length,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000, immutable",
    }));
  }

  async delete(storageKey: string): Promise<void> {
    this.assertSafeKey(storageKey);
    if (this.mode === "local") {
      try { await unlink(resolve(this.localRoot, storageKey)); }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
        throw error;
      }
      return;
    }
    await this.client!.send(new DeleteObjectCommand({ Bucket: this.bucket!, Key: "media/" + storageKey }));
  }

  private assertSafeKey(storageKey: string) {
    if (basename(storageKey) !== storageKey || !/^[a-f0-9-]{36}\.[a-z0-9]{1,8}$/i.test(storageKey)) {
      throw new Error("Invalid generated CMS media storage key.");
    }
  }
}
