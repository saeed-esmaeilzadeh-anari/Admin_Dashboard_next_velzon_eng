import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Response } from "express";

@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    let status = HttpStatus.BAD_REQUEST;
    let message = "The database rejected this request.";

    if (exception.code === "P2002") {
      status = HttpStatus.CONFLICT;
      message = "A record with one of these unique values already exists.";
    } else if (exception.code === "P2025") {
      status = HttpStatus.NOT_FOUND;
      message = "The requested record was not found.";
    } else if (exception.code === "P2003") {
      status = HttpStatus.CONFLICT;
      message = "This operation conflicts with related records.";
    } else if (exception.code === "P2034") {
      status = HttpStatus.CONFLICT;
      message = "A concurrent update conflict occurred. Please retry the operation.";
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
