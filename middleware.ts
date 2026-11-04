// middleware.ts
import { NextRequest, NextResponse } from "next/server";

const publicPaths = ["/auth", "/auth/login", "/auth/register"];
const protectedPaths = ["/apps-cms"];

// Template/demo routes are intentionally retained in the repository but excluded
// from the commercial CMS navigation and routed back to the real CMS dashboard.
const legacyTemplatePaths = [
  "/advance-ui", "/apps-api-key", "/apps-calendar", "/apps-calendar-month-grid",
  "/apps-chat", "/apps-crm-companies", "/apps-crm-contacts", "/apps-crm-deals",
  "/apps-crm-leads", "/apps-crypto-buy-sell", "/apps-crypto-ico", "/apps-crypto-kyc",
  "/apps-crypto-orders", "/apps-crypto-transactions", "/apps-crypto-wallet",
  "/apps-ecommerce-add-product", "/apps-ecommerce-cart", "/apps-ecommerce-checkout",
  "/apps-ecommerce-customers", "/apps-ecommerce-order-details", "/apps-ecommerce-orders",
  "/apps-ecommerce-product-details", "/apps-ecommerce-products",
  "/apps-ecommerce-seller-details", "/apps-ecommerce-sellers", "/apps-email-basic",
  "/apps-email-ecommerce", "/apps-file-manager", "/apps-invoices-create",
  "/apps-invoices-details", "/apps-invoices-list", "/apps-job-application",
  "/apps-job-candidate-grid", "/apps-job-candidate-lists", "/apps-job-categories",
  "/apps-job-companies-lists", "/apps-job-details", "/apps-job-grid-lists",
  "/apps-job-lists", "/apps-job-new", "/apps-job-statistics", "/apps-mailbox",
  "/apps-nft-auction", "/apps-nft-collections", "/apps-nft-create",
  "/apps-nft-creators", "/apps-nft-explore", "/apps-nft-item-details",
  "/apps-nft-marketplace", "/apps-nft-ranking", "/apps-nft-wallet",
  "/apps-projects-create", "/apps-projects-list", "/apps-projects-overview",
  "/apps-tasks-details", "/apps-tasks-kanban", "/apps-tasks-list-view",
  "/apps-tickets-details", "/apps-tickets-list", "/apps-todo", "/charts",
  "/dashboard", "/dashboard-analytics", "/dashboard-blog", "/dashboard-crm",
  "/dashboard-crypto", "/dashboard-job", "/dashboard-nft", "/dashboard-projects",
  "/forms", "/icons", "/maps-google", "/pages", "/profile", "/tables", "/ui", "/widgets",
];

function matchesPath(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(route + "/");
}

function safeRedirectTarget(destination: unknown, request: NextRequest): URL | null {
  if (typeof destination !== "string" || !destination.trim()) return null;
  const value = destination.trim();
  if (value.startsWith("/") && !value.startsWith("//") && !/[\\\\\r\n]/.test(value)) {
    try { return new URL(value, request.url); } catch { return null; }
  }
  try {
    const target = new URL(value);
    if (target.protocol !== "https:" || target.username || target.password) return null;
    return target;
  } catch {
    return null;
  }
}

function requestedLocale(request: NextRequest): string | undefined {
  const contentParts = request.nextUrl.pathname.split("/");
  const fromContentPath = contentParts[1] === "content" ? contentParts[3] : undefined;
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  const acceptLanguage = request.headers.get("accept-language")?.split(",")[0]?.split(";")[0]?.trim();
  const candidate = fromContentPath || cookieLocale || acceptLanguage;
  if (!candidate || !/^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/.test(candidate)) return undefined;
  const normalized = candidate.toLowerCase();
  if (normalized === "fa") return "fa-IR";
  if (normalized === "en") return "en-US";
  return candidate;
}

async function resolveCmsRedirect(request: NextRequest): Promise<NextResponse | null> {
  if (request.method !== "GET" && request.method !== "HEAD") return null;

  const backendBase = (process.env.BACKEND_API_URL ?? process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:3001/api/v1").replace(/\/$/, "");
  let resolverUrl: URL;
  try {
    resolverUrl = new URL(backendBase + "/public/cms/redirects/resolve");
    if (!["http:", "https:"].includes(resolverUrl.protocol) || resolverUrl.username || resolverUrl.password) return null;
  } catch {
    return null;
  }
  resolverUrl.searchParams.set("path", request.nextUrl.pathname);
  const localeCode = requestedLocale(request);
  if (localeCode) resolverUrl.searchParams.set("localeCode", localeCode);

  try {
    const response = await fetch(resolverUrl, {
      method: "GET",
      cache: "no-store",
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(1200),
    });
    if (!response.ok) return null;
    const result = await response.json() as { destinationPath?: unknown; statusCode?: unknown };
    const target = safeRedirectTarget(result.destinationPath, request);
    const statusCode = Number(result.statusCode);
    if (!target || ![301, 302, 307, 308].includes(statusCode)) return null;

    if (target.origin === request.nextUrl.origin && target.pathname === request.nextUrl.pathname) {
      // Avoid direct self-redirect loops even if the database is edited outside the UI.
      if (!target.search && request.nextUrl.search) target.search = request.nextUrl.search;
      if (target.toString() === request.url) return null;
    } else if (target.origin === request.nextUrl.origin && !target.search && request.nextUrl.search) {
      target.search = request.nextUrl.search;
    }

    return NextResponse.redirect(target, statusCode);
  } catch {
    // A temporary CMS API outage must not block public pages or the admin sign-in flow.
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Demo/template routes remain in source control for future modules, but the
  // commercial CMS release exposes only the real CMS administration area.
  const isLegacyTemplateRoute = legacyTemplatePaths.some(route =>
    matchesPath(pathname, route)
  );
  if (isLegacyTemplateRoute) {
    const destination = new URL("/apps-cms", req.url);
    destination.search = req.nextUrl.search;
    return NextResponse.redirect(destination, 307);
  }

  const isProtected = protectedPaths.some(route => matchesPath(pathname, route));
  const isAuthRoute = publicPaths.some(route => matchesPath(pathname, route));

  if (!isProtected && !isAuthRoute) {
    const cmsRedirect = await resolveCmsRedirect(req);
    if (cmsRedirect) return cmsRedirect;
  }

  const authProvider = (
    process.env.NEXT_PUBLIC_DEFAULT_AUTH ||
    process.env.NEXT_PUBLIC_DEFAULTAUTH ||
    "backend"
  ).trim().toLowerCase();
  const hasSession =
    authProvider === "backend"
      ? Boolean(req.cookies.get("velzon_session")?.value)
      : Boolean(req.cookies.get("authUser")?.value);

  if (isAuthRoute) {
    if (hasSession) return NextResponse.redirect(new URL("/apps-cms", req.url));
    return NextResponse.next();
  }

  if (isProtected && !hasSession) {
    const loginUrl = new URL("/auth/login", req.url);
    const returnTo = pathname + req.nextUrl.search;
    if (returnTo !== "/auth/login") {
      loginUrl.searchParams.set("returnTo", returnTo);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|backend-api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot|pdf)$).*)",
  ],
};
