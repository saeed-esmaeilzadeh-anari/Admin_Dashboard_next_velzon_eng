import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";

type RequestShape = {
  method?: string;
  user?: { id?: string; email?: string; role?: string };
  params?: Record<string,string>;
  route?: { path?: string };
  originalUrl?: string;
  url?: string;
  ip?: string;
};
@Injectable()
export class CmsAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CmsAuditInterceptor.name);
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<RequestShape>();
    const method = String(request.method ?? "UNKNOWN").toUpperCase();
    const route = request.route?.path ?? (request.originalUrl ?? request.url ?? "").split("?")[0];
    const entityId = request.params?.id ?? request.params?.contentId ?? request.params?.termId ?? request.params?.menuId ?? null;
    const userId = request.user?.id ?? null;
    return next.handle().pipe(tap(() => {
      if (!userId) return;
      void this.prisma.auditLog.create({
        data: {
          userId,
          action: "cms.http." + method.toLowerCase(),
          entity: "CmsRequest",
          entityId,
          metadata: { route: String(route).slice(0, 300), role: request.user?.role ?? null },
        },
      }).catch(error => this.logger.error("Failed to write CMS audit entry.", error instanceof Error ? error.stack : String(error)));
    }));
  }
}
