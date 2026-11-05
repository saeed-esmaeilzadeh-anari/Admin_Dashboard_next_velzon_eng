import {
  CallHandler,
  ExecutionContext,
  ForbiddenException,
} from "@nestjs/common";
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
      statusCode: options.statusCode ?? 200,
      setHeader: jest.fn(),
    };
    const next = {
      handle: () =>
        options.failure ? throwError(() => options.failure) : of({ ok: true }),
    } as CallHandler;
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    } as unknown as ExecutionContext;

    return { stream: interceptor.intercept(context, next), response };
  };

  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ id: "audit-1" });
  });

  it("records successful authenticated requests with a correlation ID", async () => {
    const { stream, response } = call(
      { id: "user-1", role: "MANAGER" },
      { statusCode: 201 }
    );
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

  it("records the actual HTTP status for failed authenticated requests", async () => {
    const failure = new ForbiddenException("Forbidden");
    const { stream } = call({ id: "user-1", role: "MANAGER" }, { failure });

    await expect(firstValueFrom(stream)).rejects.toBe(failure);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          outcome: "failure",
          statusCode: 403,
        }),
      }),
    });
  });

  it("records unexpected errors as HTTP 500 rather than the default response code", async () => {
    const failure = new Error("Unexpected failure");
    const { stream } = call({ id: "user-1", role: "MANAGER" }, { failure });

    await expect(firstValueFrom(stream)).rejects.toBe(failure);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          outcome: "failure",
          statusCode: 500,
        }),
      }),
    });
  });

  it("does not create a user audit record before authentication", async () => {
    const { stream } = call(undefined);
    await expect(firstValueFrom(stream)).resolves.toEqual({ ok: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("preserves the application result if audit persistence fails", async () => {
    create.mockRejectedValueOnce(new Error("Database unavailable"));
    const { stream } = call({ id: "user-1", role: "MANAGER" });
    await expect(firstValueFrom(stream)).resolves.toEqual({ ok: true });
  });
});
