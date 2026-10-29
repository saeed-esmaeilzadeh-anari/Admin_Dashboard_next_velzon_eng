// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { parse } from "cookie";

const publicPaths = ["/auth", "/auth/login", "/auth/register"];
const protectedPaths = [
  "/dashboard", "/dashboard-analytics", "/dashboard-blog", "/dashboard-crm",
  "/dashboard-job", "/dashboard-nft", "/dashboard-projects", "/apps-cms",
  "/profile", "/profile-settings", "/starter", "/terms-condition", "/privacy-policy",
  "/search-results", "/gallery", "/pricing", "/faqs", "/timeline", "/team",
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

  const backendBase = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:3001/api/v1").replace(/\/$/, "");
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

  // Redirects are resolved before page routing, but never override authentication routes
  // or protected administration screens. Lookup failures fall through to normal routing.
  const isProtected = protectedPaths.some(route => matchesPath(pathname, route));
  const isAuthRoute = publicPaths.some(route => matchesPath(pathname, route));
  if (!isProtected && !isAuthRoute) {
    const cmsRedirect = await resolveCmsRedirect(req);
    if (cmsRedirect) return cmsRedirect;
  }

  const cookies = parse(req.headers.get("cookie") || "");
  const authUser = cookies["authUser"];

  if (isAuthRoute) {
    if (authUser) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  if (isProtected && !authUser) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|woff|woff2|ttf|eot|pdf)$).*)",
  ],
};
