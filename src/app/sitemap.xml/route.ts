export async function GET() {
  const base = (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:3001/api/v1").replace(/\/$/, "");
  try {
    const response = await fetch(`${base}/public/cms/sitemap.xml`, { cache: "no-store" });
    if (!response.ok) {
      return new Response("CMS sitemap is temporarily unavailable.", {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    const xml = await response.text();
    if (!xml.trimStart().startsWith("<?xml") || !xml.includes("<urlset")) {
      return new Response("The CMS returned an invalid sitemap document.", {
        status: 502,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
    return new Response(xml, {
      status: 200,
      headers: {
        "content-type": "application/xml; charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch {
    return new Response("CMS sitemap is temporarily unavailable.", {
      status: 502,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
    });
  }
}
