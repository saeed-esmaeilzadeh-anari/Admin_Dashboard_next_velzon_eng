import { PrismaService } from "./prisma/prisma.service";
import { HealthController } from "./health.controller";

describe("HealthController", () => {
  const queryRaw = jest.fn().mockResolvedValue([{ result: 1 }]);
  const controller = new HealthController({
    $queryRaw: queryRaw,
  } as unknown as PrismaService);

  beforeEach(() => queryRaw.mockClear());

  it("reports liveness without depending on PostgreSQL", () => {
    expect(controller.liveness()).toMatchObject({ status: "ok" });
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it("checks PostgreSQL readiness", async () => {
    const result = await controller.readiness();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "ok", database: "connected" });
  });

  it("preserves the legacy health endpoint as a database readiness check", async () => {
    const result = await controller.check();

    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ status: "ok", database: "connected" });
  });
});
