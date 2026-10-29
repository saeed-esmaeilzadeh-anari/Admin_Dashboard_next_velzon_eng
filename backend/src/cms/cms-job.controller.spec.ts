import { ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { CmsJobController } from "./cms-job.controller";
import { CmsService } from "./cms.service";
import { CmsWebhookService } from "./cms-webhook.service";

describe("CmsJobController", () => {
  const cms = { publishDueContents: jest.fn() } as unknown as CmsService;
  const webhooks = { dispatchPending: jest.fn() } as unknown as CmsWebhookService;
  const controller = new CmsJobController(cms, webhooks);
  const priorToken = process.env.CMS_JOB_TOKEN;
  const token = "job-secret-that-is-long-enough-for-tests-123456";

  beforeEach(() => {
    process.env.CMS_JOB_TOKEN = token;
    jest.clearAllMocks();
  });
  afterAll(() => {
    if (priorToken === undefined) delete process.env.CMS_JOB_TOKEN;
    else process.env.CMS_JOB_TOKEN = priorToken;
  });

  it("refuses to run jobs when no token is configured", async () => {
    delete process.env.CMS_JOB_TOKEN;
    await expect(controller.publishScheduled("Bearer " + token)).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(cms.publishDueContents).not.toHaveBeenCalled();
  });
  it("rejects a missing or incorrect bearer token", async () => {
    await expect(controller.publishScheduled(undefined)).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(controller.dispatchWebhooks("Bearer wrong")).rejects.toBeInstanceOf(UnauthorizedException);
    expect(cms.publishDueContents).not.toHaveBeenCalled();
    expect(webhooks.dispatchPending).not.toHaveBeenCalled();
  });
  it("runs the scheduled publisher only for the configured bearer token", async () => {
    (cms.publishDueContents as jest.Mock).mockResolvedValue(3);
    await expect(controller.publishScheduled("Bearer " + token)).resolves.toMatchObject({ ok: true, published: 3 });
    expect(cms.publishDueContents).toHaveBeenCalledTimes(1);
  });
  it("runs webhook dispatch only for the configured bearer token", async () => {
    (webhooks.dispatchPending as jest.Mock).mockResolvedValue(2);
    await expect(controller.dispatchWebhooks("Bearer " + token)).resolves.toMatchObject({ ok: true, delivered: 2 });
    expect(webhooks.dispatchPending).toHaveBeenCalledTimes(1);
  });
});
