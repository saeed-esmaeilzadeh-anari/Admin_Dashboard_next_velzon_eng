import {
  Controller, Headers, HttpCode, Post, ServiceUnavailableException, UnauthorizedException,
} from "@nestjs/common";
import { ApiExcludeController } from "@nestjs/swagger";
import { timingSafeEqual } from "node:crypto";
import { CmsWebhookService } from "./cms-webhook.service";
import { CmsService } from "./cms.service";

@ApiExcludeController()
@Controller("internal/cms/jobs")
export class CmsJobController {
  constructor(
    private readonly cms: CmsService,
    private readonly webhooks: CmsWebhookService,
  ) {}

  @Post("publish-scheduled")
  @HttpCode(200)
  async publishScheduled(@Headers("authorization") authorization?: string) {
    this.assertJobToken(authorization);
    const published = await this.cms.publishDueContents();
    return { ok: true, published, executedAt: new Date().toISOString() };
  }

  @Post("dispatch-webhooks")
  @HttpCode(200)
  async dispatchWebhooks(@Headers("authorization") authorization?: string) {
    this.assertJobToken(authorization);
    const delivered = await this.webhooks.dispatchPending();
    return { ok: true, delivered, executedAt: new Date().toISOString() };
  }

  private assertJobToken(authorization?: string) {
    const expected = process.env.CMS_JOB_TOKEN;
    if (!expected || expected.length < 32) {
      throw new ServiceUnavailableException("Internal job execution is not configured.");
    }
    const candidate = authorization?.startsWith("Bearer ") ? authorization.slice(7) : "";
    const expectedBytes = Buffer.from(expected, "utf8");
    const candidateBytes = Buffer.from(candidate, "utf8");
    if (candidateBytes.length !== expectedBytes.length || !timingSafeEqual(candidateBytes, expectedBytes)) {
      throw new UnauthorizedException("Invalid job token.");
    }
  }
}
