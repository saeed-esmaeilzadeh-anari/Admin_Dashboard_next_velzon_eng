import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, mergeMap } from "rxjs";
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
    const role = request.user?.role ?? null;

    // Await the write so serverless instances cannot return the response before the audit record
    // reaches PostgreSQL. Audit failures are reported but do not turn an otherwise successful CMS
    // operation into a 500 response.
    return next.handle().pipe(mergeMap(async response => {
      if (!userId) return response;
      try {
        await this.prisma.auditLog.create({
          data: {
            userId,
            action: "cms.http." + method.toLowerCase(),
            entity: "CmsRequest",
            entityId,
            metadata: { route: String(route).slice(0, 300), role },
          },
        });
      } catch (error) {
        this.logger.error("Failed to write CMS audit entry.", error instanceof Error ? error.stack : String(error));
      }
      return response;
    }));
  }
}
