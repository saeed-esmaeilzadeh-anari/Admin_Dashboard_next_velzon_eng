import { CallHandler, ExecutionContext } from "@nestjs/common";
import { firstValueFrom, of, throwError } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import { CmsAuditInterceptor } from "./cms-audit.interceptor";

describe("CmsAuditInterceptor", () => {
  const create = jest.fn();
  const prisma = { auditLog: { create } } as unknown as PrismaService;
  const interceptor = new CmsAuditInterceptor(prisma);

  const call = (
    user?: { id: string; role: string },
    options: { statusCode?: number; failure?: Error } = {}
  ) => {
    const request = {
      method: "POST",
      route: { path: "/cms/contents/:id/publish" },
      originalUrl: "/api/v1/cms/contents/123/publish?trace=1",
      params: { id: "content-123" },
      ip: "203.0.113.10",
      user,
    };
    const response = {
      statusCode: options.statusCode ?? (options.failure ? 403 : 201),
      setHeader: jest.fn(),
    };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;
    const next = {
      handle: () =>
        options.failure ? throwError(() => options.failure) : of({ ok: true }),
    } as CallHandler;

    return {
      stream: interceptor.intercept(context, next),
      response,
    };
  };

  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ id: "audit-1" });
  });

  it("awaits and records a successful authenticated CMS request", async () => {
    const { stream, response } = call({ id: "user-1", role: "MANAGER" });
    const result = await firstValueFrom(stream);
    const requestId = response.setHeader.mock.calls[0][1];

    expect(result).toEqual({ ok: true });
    expect(requestId).toEqual(expect.any(String));
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        action: "cms.http.post",
        entity: "CmsRequest",
        entityId: "content-123",
        metadata: {
          route: "/cms/contents/:id/publish",
          role: "MANAGER",
          outcome: "success",
          statusCode: 201,
          requestId,
          ip: "203.0.113.10",
        },
      },
    });
  });

  it("records failed authenticated CMS requests and preserves the original exception", async () => {
    const failure = new Error("Forbidden");
    const { stream, response } = call(
      { id: "user-1", role: "MANAGER" },
      { statusCode: 403, failure }
    );
    const requestId = response.setHeader.mock.calls[0][1];

    await expect(firstValueFrom(stream)).rejects.toBe(failure);
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        action: "cms.http.post",
        entity: "CmsRequest",
        entityId: "content-123",
        metadata: {
          route: "/cms/contents/:id/publish",
          role: "MANAGER",
          outcome: "failure",
          statusCode: 403,
          requestId,
          ip: "203.0.113.10",
        },
      },
    });
  });

  it("does not create a user-scoped audit row for unauthenticated public requests", async () => {
    const { stream } = call();
    await expect(firstValueFrom(stream)).resolves.toEqual({ ok: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("does not fail a successful CMS request if the audit store is unavailable", async () => {
    create.mockRejectedValue(new Error("database temporarily unavailable"));
    const { stream } = call({ id: "user-1", role: "ADMIN" });
    await expect(firstValueFrom(stream)).resolves.toEqual({ ok: true });
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("does not replace the original request exception if audit persistence also fails", async () => {
    const failure = new Error("Original request failure");
    create.mockRejectedValue(new Error("database temporarily unavailable"));
    const { stream } = call(
      { id: "user-1", role: "ADMIN" },
      { statusCode: 500, failure }
    );

    await expect(firstValueFrom(stream)).rejects.toBe(failure);
    expect(create).toHaveBeenCalledTimes(1);
  });
});
