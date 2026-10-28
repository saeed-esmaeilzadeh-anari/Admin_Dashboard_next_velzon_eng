import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { CmsService } from "./cms.service";
@Injectable()
export class CmsScheduler {
  private readonly logger = new Logger(CmsScheduler.name);
  constructor(private readonly cms: CmsService) {}
  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduledContent() {
    try {
      const count = await this.cms.publishDueContents();
      if (count) this.logger.log("Automatically published " + count + " scheduled CMS translation(s).");
    } catch (error) {
      this.logger.error("Scheduled publishing failed.", error instanceof Error ? error.stack : String(error));
    }
  }
}
