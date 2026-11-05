import {
  CallHandler,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Observable, catchError, from, mergeMap, throwError } from "rxjs";
import { PrismaService } from "../prisma/prisma.service";

type RequestShape = {
  method?: string;
  user?: { id?: string; email?: string; role?: string };
  params?: Record<string, string>;
  route?: { path?: string };
  originalUrl?: string;
  url?: string;
  ip?: string;
};

type ResponseShape = {
  statusCode?: number;
  setHeader(name: string, value: string): void;
};

@Injectable()
export class CmsAuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(CmsAuditInterceptor.name);

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestShape>();
    const response = http.getResponse<ResponseShape>();
    const method = String(request.method ?? "UNKNOWN").toUpperCase();
    const route =
      request.route?.path ??
      (request.originalUrl ?? request.url ?? "").split("?")[0];
    const entityId =
      request.params?.id ??
      request.params?.contentId ??
      request.params?.termId ??
      request.params?.menuId ??
      null;
    const userId = request.user?.id ?? null;
    const role = request.user?.role ?? null;
    const requestId = randomUUID();

    response.setHeader("X-Request-Id", requestId);

    const writeAudit = async (
      outcome: "success" | "failure",
      statusCodeOverride?: number
    ) => {
      if (!userId) return;
      try {
        await this.prisma.auditLog.create({
          data: {
            userId,
            action: "cms.http." + method.toLowerCase(),
            entity: "CmsRequest",
            entityId,
            metadata: {
              route: String(route).slice(0, 300),
              role,
              outcome,
              statusCode: Number(
                statusCodeOverride ??
                  response.statusCode ??
                  (outcome === "failure" ? 500 : 200)
              ),
              requestId,
              ip: String(request.ip ?? "").slice(0, 64) || null,
            },
          },
        });
      } catch (error) {
        this.logger.error(
          "Failed to write CMS audit entry.",
          error instanceof Error ? error.stack : String(error)
        );
      }
    };

    return next.handle().pipe(
      mergeMap(async result => {
        await writeAudit("success");
        return result;
      }),
      catchError(error =>
        from(
          writeAudit(
            "failure",
            error instanceof HttpException ? error.getStatus() : 500
          )
        ).pipe(mergeMap(() => throwError(() => error)))
      )
    );
  }
}
