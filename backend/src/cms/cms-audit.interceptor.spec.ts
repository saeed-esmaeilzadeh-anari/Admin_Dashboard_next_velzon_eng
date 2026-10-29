import { CallHandler, ExecutionContext } from "@nestjs/common";
import { firstValueFrom, of } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";
import { CmsAuditInterceptor } from "./cms-audit.interceptor";

describe("CmsAuditInterceptor", () => {
  const create = jest.fn();
  const prisma = { auditLog: { create } } as unknown as PrismaService;
  const interceptor = new CmsAuditInterceptor(prisma);

  const call = (user?: { id: string; role: string }) => {
    const request = {
      method: "POST",
      route: { path: "/cms/contents/:id/publish" },
      originalUrl: "/api/v1/cms/contents/123/publish?trace=1",
      params: { id: "content-123" },
      user,
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ ok: true }) } as CallHandler;
    return interceptor.intercept(context, next);
  };

  beforeEach(() => {
    create.mockReset();
    create.mockResolvedValue({ id: "audit-1" });
  });

  it("awaits and records a successful authenticated CMS request", async () => {
    const result = await firstValueFrom(call({ id: "user-1", role: "MANAGER" }));
    expect(result).toEqual({ ok: true });
    expect(create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        action: "cms.http.post",
        entity: "CmsRequest",
        entityId: "content-123",
        metadata: { route: "/cms/contents/:id/publish", role: "MANAGER" },
      },
    });
  });

  it("does not create a user-scoped audit row for unauthenticated public requests", async () => {
    await expect(firstValueFrom(call())).resolves.toEqual({ ok: true });
    expect(create).not.toHaveBeenCalled();
  });

  it("does not fail a successful CMS request if the audit store is unavailable", async () => {
    create.mockRejectedValue(new Error("database temporarily unavailable"));
    await expect(firstValueFrom(call({ id: "user-1", role: "ADMIN" }))).resolves.toEqual({ ok: true });
    expect(create).toHaveBeenCalledTimes(1);
  });
});
