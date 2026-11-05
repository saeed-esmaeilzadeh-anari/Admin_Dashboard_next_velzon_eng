import { expect, test } from "@playwright/test";

test.describe("Velzon portfolio browser journeys", () => {
  test("registers an account without creating an authenticated session", async ({
    page,
    context,
  }) => {
    await page.goto("/auth/register");

    await page.getByPlaceholder("Enter email address").fill("ci-browser-user@example.test");
    await page.getByPlaceholder("Enter username").fill("Browser User");
    await page.getByPlaceholder("Enter Password").fill("browser-password-123");
    await page.getByPlaceholder("Confirm Password").fill("browser-password-123");
    await page.getByRole("button", { name: "Sign Up" }).click();

    await expect(
      page.getByText(/Register User Successfully/i)
    ).toBeVisible();

    await page.waitForURL("**/auth/login", { timeout: 7_000 });

    const sessionCookies = (await context.cookies()).filter(
      cookie => cookie.name === "velzon_session"
    );
    expect(sessionCookies).toHaveLength(0);
    expect(await page.evaluate(() => document.cookie)).not.toContain(
      "velzon_session"
    );
  });

  test("authenticates through the BFF, keeps the JWT HttpOnly, and logs out", async ({
    page,
    context,
  }) => {
    await page.goto("/auth/login");
    await page.getByPlaceholder("Enter email").fill("ci-admin@example.test");
    await page.getByPlaceholder("Enter Password").fill("valid-password");
    await page.getByRole("button", { name: "Sign In" }).click();

    await page.waitForURL("**/dashboard", { timeout: 10_000 });

    const sessionCookie = (await context.cookies()).find(
      cookie => cookie.name === "velzon_session"
    );
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie?.httpOnly).toBe(true);
    expect(sessionCookie?.sameSite).toBe("Lax");

    const browserVisibleState = await page.evaluate(() => ({
      cookie: document.cookie,
      localStorage: Object.keys(window.localStorage),
      sessionStorage: Object.keys(window.sessionStorage),
    }));
    expect(browserVisibleState.cookie).not.toContain("velzon_session");
    expect(JSON.stringify(browserVisibleState)).not.toContain(
      "ci-bff-test-access-token"
    );

    const meResponse = await page.evaluate(async () => {
      const response = await fetch("/backend-api/auth/me", {
        credentials: "same-origin",
        cache: "no-store",
      });
      return {
        status: response.status,
        body: await response.json(),
      };
    });
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.email).toBe("ci-admin@example.test");

    const logoutResponse = await page.evaluate(async () => {
      const response = await fetch("/backend-api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
      });
      return {
        status: response.status,
        body: await response.json(),
      };
    });
    expect(logoutResponse.status).toBe(200);
    expect(logoutResponse.body).toMatchObject({
      success: true,
      sessionRevoked: true,
    });

    expect(
      (await context.cookies()).some(
        cookie => cookie.name === "velzon_session"
      )
    ).toBe(false);

    const protectedResponse = await page.evaluate(async () => {
      const response = await fetch("/backend-api/auth/me", {
        credentials: "same-origin",
        cache: "no-store",
      });
      return response.status;
    });
    expect(protectedResponse).toBe(401);
  });

  test("shows the backend authentication error without creating a session", async ({
    page,
    context,
  }) => {
    await page.goto("/auth/login");
    await page.getByPlaceholder("Enter email").fill("wrong@example.test");
    await page.getByPlaceholder("Enter Password").fill("wrong-password");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByText("Invalid email or password.")).toBeVisible();
    expect(
      (await context.cookies()).some(
        cookie => cookie.name === "velzon_session"
      )
    ).toBe(false);
  });

  test("renders a published CMS page in the browser", async ({ page }) => {
    await page.goto("/content/article/en-US/hello-world");
    await expect(
      page.getByRole("heading", { name: "CI Public Article" }).first()
    ).toBeVisible();
  });
});
