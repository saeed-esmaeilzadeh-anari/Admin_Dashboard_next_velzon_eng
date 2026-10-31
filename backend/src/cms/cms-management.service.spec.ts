import { BadRequestException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CmsManagementService } from "./cms-management.service";

describe("CmsManagementService redirect safety", () => {
  const redirectFindFirst = jest.fn();
  const prisma = {
    cmsRedirect: { findFirst: redirectFindFirst },
  } as unknown as PrismaService;
  const service = new CmsManagementService(prisma);
  const assertNoRedirectCycle = (service as unknown as {
    assertNoRedirectCycle: (sourcePath: string, destinationPath: string, localeId: string | null, currentId?: string) => Promise<void>;
  }).assertNoRedirectCycle.bind(service);

  beforeEach(() => redirectFindFirst.mockReset());

  it("rejects a loop that would be created by a new redirect", async () => {
    // Existing /old -> /legacy combined with the proposed /legacy -> /old is a loop.
    redirectFindFirst.mockResolvedValueOnce({ destinationPath: "/legacy" });
    await expect(assertNoRedirectCycle("/legacy", "/old", null))
      .rejects.toThrow("Redirect rules cannot create a redirect loop.");
  });

  it("allows a chain that ends at a path without another active redirect", async () => {
    redirectFindFirst.mockResolvedValueOnce({ destinationPath: "/content/article/en-US/story" })
      .mockResolvedValueOnce(null);
    await expect(assertNoRedirectCycle("/old", "/middle", null)).resolves.toBeUndefined();
    expect(redirectFindFirst).toHaveBeenCalledTimes(2);
  });

  it("does not recursively follow an external HTTPS destination", async () => {
    await expect(assertNoRedirectCycle("/old", "https://example.test/new-page", null)).resolves.toBeUndefined();
    expect(redirectFindFirst).not.toHaveBeenCalled();
  });

  it("excludes the row being updated when checking the remaining redirect graph", async () => {
    redirectFindFirst.mockResolvedValueOnce({ destinationPath: "/content/article/en-US/story" })
      .mockResolvedValueOnce(null);
    await expect(assertNoRedirectCycle("/new-source", "/middle", null, "current-redirect")).resolves.toBeUndefined();
    expect(redirectFindFirst.mock.calls[0][0].where).toEqual({
      sourcePath: "/middle", isActive: true, localeId: null, id: { not: "current-redirect" },
    });
  });
});
