import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_COOKIE = "velzon_session";
const LEGACY_COOKIE = "authUser";
const SESSION_TTL_SECONDS = 15 * 60;

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

type AuthPayload = {
  accessToken?: unknown;
  expiresIn?: unknown;
  user?: unknown;
};

function getBackendBaseUrl(): URL {
  const configured =
    process.env.BACKEND_API_URL?.trim() ||
    process.env.NEXT_PUBLIC_BACKEND_API_URL?.trim() ||
    "http://localhost:3001/api/v1";

  const base = new URL(configured);
  if (!["http:", "https:"].includes(base.protocol)) {
    throw new Error("BACKEND_API_URL must use HTTP or HTTPS.");
  }
  if (base.username || base.password || base.search || base.hash) {
    throw new Error(
      "BACKEND_API_URL must not contain credentials, query parameters or a hash."
    );
  }

  const isLoopback = ["localhost", "127.0.0.1", "::1"].includes(base.hostname);
  if (
    process.env.NODE_ENV === "production" &&
    base.protocol !== "https:" &&
    !isLoopback
  ) {
    throw new Error("Production BACKEND_API_URL must use HTTPS.");
  }

  base.pathname = base.pathname.replace(/\/+$/, "") + "/";
  return base;
}

function validatePath(segments: string[]): boolean {
  return (
    Array.isArray(segments) &&
    segments.length > 0 &&
    segments.every(
      segment =>
        Boolean(segment) &&
        segment !== "." &&
        segment !== ".." &&
        !segment.includes("/") &&
        !segment.includes("\\") &&
        !segment.includes("\0")
    )
  );
}

function rejectCrossOriginMutation(request: NextRequest): NextResponse | null {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;

  const origin = request.headers.get("origin");
  if (!origin) return null;

  try {
    if (new URL(origin).origin === new URL(request.url).origin) return null;
  } catch {
    // Invalid Origin values are rejected below.
  }

  return NextResponse.json(
    { message: "Cross-origin requests are not allowed." },
    { status: 403, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}

function buildBackendUrl(base: URL, segments: string[], search: string): URL {
  const relativePath = segments
    .map(segment => encodeURIComponent(segment))
    .join("/");
  return new URL(relativePath + search, base);
}

function copyResponseHeaders(source: Headers): Headers {
  const headers = new Headers();
  for (const name of [
    "content-type",
    "content-disposition",
    "etag",
    "last-modified",
    "accept-ranges",
    "content-range",
  ]) {
    const value = source.get(name);
    if (value) headers.set(name, value);
  }

  // API responses may contain identity, permission or CMS data; never cache
  // them in a browser, CDN or shared intermediary by default.
  headers.set("cache-control", "private, no-store, max-age=0");
  return headers;
}

function clearSession(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

async function sanitizeAuthenticationResponse(
  upstream: Response,
  setSessionCookie: boolean
): Promise<NextResponse> {
  const responseText = await upstream.text();
  let payload: unknown = null;

  if (responseText) {
    try {
      payload = JSON.parse(responseText) as unknown;
    } catch {
      payload = {
        message: "The authentication service returned an invalid response.",
      };
    }
  }

  if (!upstream.ok) {
    return NextResponse.json(payload ?? { message: "Authentication failed." }, {
      status: upstream.status,
    });
  }

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json(
      { message: "The authentication service returned an invalid response." },
      { status: 502 }
    );
  }

  const { accessToken, expiresIn, ...publicPayload } = payload as AuthPayload;
  if (
    !publicPayload.user ||
    typeof publicPayload.user !== "object" ||
    (setSessionCookie &&
      (typeof accessToken !== "string" || accessToken.length < 20))
  ) {
    return NextResponse.json(
      {
        message: "The authentication service returned an incomplete response.",
      },
      { status: 502 }
    );
  }

  // Never return backend access tokens to browser JavaScript or Redux.
  // Registration returns a profile only and requires a separate sign-in.
  const response = NextResponse.json(
    setSessionCookie ? publicPayload : { user: publicPayload.user },
    {
      status: upstream.status,
      headers: { "Cache-Control": "no-store, max-age=0" },
    }
  );

  if (setSessionCookie) {
    const requestedTtl =
      typeof expiresIn === "number" && Number.isFinite(expiresIn)
        ? Math.floor(expiresIn)
        : SESSION_TTL_SECONDS;
    const maxAge = Math.max(1, Math.min(SESSION_TTL_SECONDS, requestedTtl));

    response.cookies.set(SESSION_COOKIE, accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge,
    });

    // Expire the legacy JavaScript-readable marker during migration.
    response.cookies.set(LEGACY_COOKIE, "", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
  }

  return response;
}

async function handle(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  const { path } = await context.params;
  if (!validatePath(path)) {
    return NextResponse.json({ message: "Invalid API path." }, { status: 400 });
  }

  const csrfResponse = rejectCrossOriginMutation(request);
  if (csrfResponse) return csrfResponse;

  const pathKey = path.join("/").toLowerCase();

  if (pathKey === "auth/logout") {
    if (request.method !== "POST") {
      return NextResponse.json(
        { message: "Method not allowed." },
        { status: 405 }
      );
    }

    const token = request.cookies.get(SESSION_COOKIE)?.value;
    let sessionRevoked = !token;

    if (token) {
      try {
        const upstream = await fetch(
          buildBackendUrl(getBackendBaseUrl(), ["auth", "logout"], ""),
          {
            method: "POST",
            headers: {
              Accept: "application/json",
              Authorization: "Bearer " + token,
            },
            cache: "no-store",
            redirect: "manual",
            signal: AbortSignal.timeout(10_000),
          }
        );
        // A rejected/expired token is already unusable.
        sessionRevoked = upstream.ok || upstream.status === 401;
      } catch {
        // Always clear the browser cookie. The JWT remains short-lived.
        sessionRevoked = false;
      }
    }

    const response = NextResponse.json(
      { success: true, sessionRevoked },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
    clearSession(response);
    response.cookies.set(LEGACY_COOKIE, "", {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  if (
    (pathKey === "auth/login" || pathKey === "auth/register") &&
    request.method !== "POST"
  ) {
    return NextResponse.json(
      { message: "Method not allowed." },
      { status: 405 }
    );
  }

  try {
    const target = buildBackendUrl(
      getBackendBaseUrl(),
      path,
      request.nextUrl.search
    );
    const headers = new Headers();
    const accept = request.headers.get("accept");
    const contentType = request.headers.get("content-type");
    const requestId = request.headers.get("x-request-id");
    const range = request.headers.get("range");

    if (accept) headers.set("accept", accept);
    if (contentType) headers.set("content-type", contentType);
    if (requestId) headers.set("x-request-id", requestId);
    if (range) headers.set("range", range);

    // Ignore browser-supplied Authorization. Only this HttpOnly cookie is trusted.
    const token = request.cookies.get(SESSION_COOKIE)?.value;
    if (token && pathKey !== "auth/login" && pathKey !== "auth/register") {
      headers.set("authorization", "Bearer " + token);
    }

    const init: RequestInit & { duplex?: "half" } = {
      method: request.method,
      headers,
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(120_000),
    };

    if (!["GET", "HEAD"].includes(request.method)) {
      init.body = request.body;
      init.duplex = "half";
    }

    const upstream = await fetch(target, init);

    if (pathKey === "auth/login" && request.method === "POST") {
      return sanitizeAuthenticationResponse(upstream, true);
    }

    if (pathKey === "auth/register" && request.method === "POST") {
      // Registration creates the account but does not silently establish a session.
      return sanitizeAuthenticationResponse(upstream, false);
    }

    const response = new NextResponse(
      request.method === "HEAD" ? null : upstream.body,
      {
        status: upstream.status,
        headers: copyResponseHeaders(upstream.headers),
      }
    );

    if (upstream.status === 401 && token) clearSession(response);
    return response;
  } catch (error) {
    const message =
      error instanceof Error && error.message.includes("BACKEND_API_URL")
        ? error.message
        : "The backend API is unavailable. Please try again.";

    return NextResponse.json({ message }, { status: 502 });
  }
}

export const GET = handle;
export const HEAD = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
