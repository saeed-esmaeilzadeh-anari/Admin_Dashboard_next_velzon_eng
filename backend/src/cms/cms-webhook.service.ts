import { Injectable, Logger } from "@nestjs/common";
import { CmsWebhookDeliveryStatus, Prisma } from "@prisma/client";
import { createHmac, randomUUID } from "node:crypto";
import { lookup as dnsLookup } from "node:dns/promises";
import type { LookupAddress } from "node:dns";
import type { LookupFunction } from "node:net";
import { isIP } from "node:net";
import { request as httpsRequest } from "node:https";
import { URL } from "node:url";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../prisma/prisma.service";

function isPublicIpv4(value: string): boolean {
  const parts = value.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a,b,c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 168 || b === 0 || (b === 0 && c === 2))) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}
function expandIpv6(address: string): number[] | null {
  const value = address.toLowerCase();
  if (value.includes("%") || value.includes(".")) return null;
  const halves = value.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;
  const parts = [...left, ...Array(missing).fill("0"), ...right];
  if (parts.length !== 8 || parts.some(part => !/^[0-9a-f]{1,4}$/.test(part))) return null;
  return parts.map(part => Number.parseInt(part, 16));
}

/**
 * Webhooks are allowed to dial only addresses within IPv6 global-unicast space.
 * Treat transition/documentation ranges conservatively: DNS rebinding is mitigated
 * separately by pinning the validated DNS result into the HTTPS socket.
 */
function isPublicIpv6(address: string): boolean {
  const words = expandIpv6(address);
  if (!words) return false;
  const first = words[0];
  const second = words[1];
  // Only the 2000::/3 global-unicast allocation range is eligible.
  if (first < 0x2000 || first > 0x3fff) return false;
  // 2001:0000::/23 (special-purpose), 2001:db8::/32 (documentation) and 2002::/16 (6to4).
  if (first === 0x2001 && (second <= 0x01ff || second === 0x0db8)) return false;
  if (first === 0x2002) return false;
  return true;
}

export function isPublicAddress(address: string): boolean {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}
function jsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? {})) as Prisma.InputJsonValue;
}

@Injectable()
export class CmsWebhookService {
  private readonly logger = new Logger(CmsWebhookService.name);
  constructor(private readonly prisma: PrismaService) {}

  async queueEvent(eventKey: string, data: Record<string, unknown>) {
    try {
      const hooks = await this.prisma.cmsWebhook.findMany({
        where: { isActive: true, events: { hasSome: [eventKey, "*"] } },
        select: { id: true },
      });
      if (!hooks.length) return;
      const payload = jsonValue({ id: randomUUID(), event: eventKey, occurredAt: new Date().toISOString(), data });
      await this.prisma.cmsWebhookDelivery.createMany({
        data: hooks.map(hook => ({ webhookId: hook.id, eventKey, payload, status: CmsWebhookDeliveryStatus.PENDING, nextAttemptAt: new Date() })),
      });
    } catch (error) {
      this.logger.error("Failed to queue CMS webhook event " + eventKey, error instanceof Error ? error.stack : String(error));
    }
  }

  async dispatchPending(): Promise<number> {
    const now = new Date();
    await this.prisma.cmsWebhookDelivery.updateMany({
      where: { status: CmsWebhookDeliveryStatus.PROCESSING, nextAttemptAt: { lte: now } },
      data: { status: CmsWebhookDeliveryStatus.PENDING },
    });
    const pending = await this.prisma.cmsWebhookDelivery.findMany({
      where: { status: CmsWebhookDeliveryStatus.PENDING, nextAttemptAt: { lte: now } },
      orderBy: { createdAt: "asc" }, take: 20, include: { webhook: true },
    });
    let delivered = 0;
    for (const item of pending) {
      const claimUntil = new Date(Date.now() + 120_000);
      const claim = await this.prisma.cmsWebhookDelivery.updateMany({
        where: { id: item.id, status: CmsWebhookDeliveryStatus.PENDING, nextAttemptAt: { lte: now } },
        data: { status: CmsWebhookDeliveryStatus.PROCESSING, attempts: { increment: 1 }, nextAttemptAt: claimUntil },
      });
      if (claim.count !== 1) continue;
      const attemptNumber = item.attempts + 1;
      try {
        if (!item.webhook.isActive) throw new Error("Webhook has been disabled.");
        const statusCode = await this.sendSignedRequest(item.webhook.endpointUrl, item.webhook.secret, item.eventKey, item.id, item.payload);
        if (statusCode < 200 || statusCode >= 300) throw new Error("Webhook endpoint returned HTTP " + statusCode + ".");
        await this.prisma.cmsWebhookDelivery.update({
          where: { id: item.id },
          data: { status: CmsWebhookDeliveryStatus.SUCCESS, responseStatus: statusCode, lastError: null, deliveredAt: new Date(), nextAttemptAt: new Date() },
        });
        delivered++;
      } catch (error) {
        const detail = error instanceof Error ? error.message.slice(0, 1000) : String(error).slice(0, 1000);
        const exhausted = attemptNumber >= 8 || !item.webhook.isActive;
        const delayMs = Math.min(6 * 60 * 60 * 1000, 60_000 * Math.pow(2, Math.min(attemptNumber, 8)));
        await this.prisma.cmsWebhookDelivery.update({
          where: { id: item.id },
          data: {
            status: exhausted ? CmsWebhookDeliveryStatus.FAILED : CmsWebhookDeliveryStatus.PENDING,
            lastError: detail,
            nextAttemptAt: exhausted ? new Date() : new Date(Date.now() + delayMs),
          },
        });
        this.logger.warn("Webhook delivery " + item.id + " failed (attempt " + attemptNumber + "): " + detail);
      }
    }
    return delivered;
  }

  private async sendSignedRequest(endpoint: string, secret: string, eventKey: string, deliveryId: string, payload: Prisma.JsonValue): Promise<number> {
    const url = this.validateEndpoint(endpoint);
    const addresses = await dnsLookup(url.hostname, { all: true, verbatim: true });
    if (!addresses.length || addresses.some(address => !isPublicAddress(address.address))) {
      throw new Error("Webhook hostname resolves to a private or reserved IP address.");
    }
    const body = JSON.stringify(payload);
    const signature = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
    const primary = addresses[0];
    const pinnedLookup: LookupFunction = (hostname, options, callback) => {
      const wantsAll = typeof options === "object" && options !== null && "all" in options && options.all === true;
      if (wantsAll) callback(null, addresses as LookupAddress[]);
      else callback(null, primary.address, primary.family);
    };
    return new Promise<number>((resolve, reject) => {
      const request = httpsRequest({
        hostname: url.hostname,
        port: url.port ? Number(url.port) : 443,
        path: url.pathname + url.search,
        method: "POST",
        servername: url.hostname,
        lookup: pinnedLookup,
        timeout: 10_000,
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
          "x-cms-event": eventKey,
          "x-cms-delivery": deliveryId,
          "x-cms-signature": signature,
          "user-agent": "VelzonCMS-Webhook/1.0",
        },
      }, response => {
        response.resume();
        response.on("end", () => resolve(response.statusCode ?? 0));
        response.on("error", reject);
      });
      request.on("timeout", () => request.destroy(new Error("Webhook request timed out.")));
      request.on("error", reject);
      request.end(body);
    });
  }

  private validateEndpoint(endpoint: string): URL {
    let url: URL;
    try { url = new URL(endpoint); } catch { throw new Error("Webhook URL is invalid."); }
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || !hostname || isIP(hostname) !== 0 ||
      hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") ||
      hostname.endsWith(".internal") || hostname.endsWith(".test") || !hostname.includes(".")) {
      throw new Error("Webhook endpoint must be a public HTTPS DNS hostname without credentials.");
    }
    return url;
  }
}

@Injectable()
export class CmsWebhookWorker {
  private readonly logger = new Logger(CmsWebhookWorker.name);
  constructor(private readonly webhooks: CmsWebhookService) {}
  @Cron(CronExpression.EVERY_MINUTE)
  async processDeliveries() {
    try {
      const count = await this.webhooks.dispatchPending();
      if (count) this.logger.log("Delivered " + count + " CMS webhook(s).");
    } catch (error) {
      this.logger.error("CMS webhook worker failed.", error instanceof Error ? error.stack : String(error));
    }
  }
}
