import "reflect-metadata";
import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { resolve } from "node:path";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";
import { PrismaExceptionFilter } from "./prisma-exception.filter";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    cors: false,
  });
  app.enableShutdownHooks();
  app.useStaticAssets(resolve(process.env.UPLOAD_DIR ?? "uploads"), {
    prefix: "/uploads/",
  });
  const allowedOrigins = (process.env.CORS_ORIGINS || "")
    .split(",")
    .map(item => item.trim().replace(/\/$/, ""))
    .filter(Boolean);

  app.use(helmet());
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.enableCors({
    origin: (origin, callback) => {
      // Requests without Origin (for example Postman) are supported.
      if (!origin) {
        return callback(null, true);
      }

      // Allow localhost on arbitrary ports only outside production.
      const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(
        origin
      );

      if (
        allowedOrigins.includes(origin.replace(/\/$/, "")) ||
        (process.env.NODE_ENV !== "production" && isLocalhost)
      ) {
        return callback(null, true);
      }

      console.error("Blocked CORS Origin:", origin);
      return callback(new Error(`Origin is not allowed: ${origin}`));
    },
    credentials: true,
  });
  app.setGlobalPrefix("api/v1");
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Velzon Admin API")
    .setDescription("REST API for the Velzon admin dashboard")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();
  SwaggerModule.setup(
    "docs",
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
    {
      jsonDocumentUrl: "docs-json",
      swaggerOptions: { persistAuthorization: true },
    }
  );

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  console.info("Velzon Admin API listening on port " + port);
}
void bootstrap();
