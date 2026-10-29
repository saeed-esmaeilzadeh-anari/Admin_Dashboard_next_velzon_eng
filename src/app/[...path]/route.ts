import { NextRequest, NextResponse } from "next/server";
import { cmsApi } from "@/helpers/cmsApi";

// Catch-all fallback only runs for URLs not matched by a more specific Next route.
// Redirect destinations are validated as local paths by the CMS backend.
export async function GET(request: NextRequest) {
  const currentUrl = new URL(request.url);
  const sourcePath = currentUrl.pathname;
  const explicitLocale = currentUrl.searchParams.get("localeCode")?.trim();
  const acceptLanguage = request.headers.get("accept-language")?.split(",")[0]?.split(";")[0]?.trim();
  const localeCode = explicitLocale || acceptLanguage || undefined;

  try {
    const redirectRule = await cmsApi.resolveRedirect(sourcePath, localeCode);
    const destination = new URL(redirectRule.destinationPath, currentUrl.origin);

    // Enforce same-origin destinations on the frontend too, even though the API validates them.
    if (destination.origin !== currentUrl.origin ||
        (destination.pathname === sourcePath && destination.search === currentUrl.search)) {
      return new Response("Invalid CMS redirect destination.", {
        status: 508,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }

    return NextResponse.redirect(destination, {
      status: redirectRule.statusCode,
      headers: { "cache-control": "no-store" },
    });
  } catch (error) {
    const value = error as { response?: { status?: number } };
    if (value?.response?.status === 404) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return new Response("Redirect service is temporarily unavailable.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
}

export async function HEAD(request: NextRequest) {
  const response = await GET(request);
  return new Response(null, { status: response.status, headers: response.headers });
}
