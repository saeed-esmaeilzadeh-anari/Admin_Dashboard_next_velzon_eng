import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PagePreview from "@/components/Cms/PagePreview";

type RouteParams = { typeKey: string; localeCode: string; slug: string };
type PublishedCmsPage = {
  id: string;
  type: { key: string; name: string };
  locale: { code: string; name: string; direction: "LTR" | "RTL" };
  title: string;
  slug: string;
  excerpt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  fields: Record<string, unknown>;
  alternates?: Array<{ localeCode: string; slug: string | null }>;
  publishedAt?: string | null;
  terms?: Array<{ id: string; taxonomy: { key: string; name: string }; name: string; slug: string; description?: string | null }>;
};

function apiBase(): string {
  return (process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:3001/api/v1").replace(/\/$/, "");
}
function absoluteMedia(value: unknown, origin: string): unknown {
  if (Array.isArray(value)) return value.map(item => absoluteMedia(item, origin));
  if (typeof value !== "object" || value === null) return value;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === "url" && typeof child === "string" && /^\/uploads\/media\/[a-f0-9-]+\.[a-z0-9]{1,8}$/i.test(child)) result[key] = origin + child;
    else result[key] = absoluteMedia(child, origin);
  }
  return result;
}
async function getPublished(typeKey: string, localeCode: string, slug: string): Promise<PublishedCmsPage | null> {
  try {
    const base = apiBase();
    const response = await fetch(`${base}/public/cms/${encodeURIComponent(typeKey)}/${encodeURIComponent(localeCode)}/${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (!response.ok) return null;
    const value = await response.json() as PublishedCmsPage;
    const origin = new URL(base).origin;
    return { ...value, fields: absoluteMedia(value.fields, origin) as Record<string, unknown> };
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { typeKey, localeCode, slug } = await params;
  const page = await getPublished(typeKey, localeCode, slug);
  if (!page) return { title: "Content not found" };
  const canonical = `/content/${encodeURIComponent(typeKey)}/${encodeURIComponent(localeCode)}/${encodeURIComponent(page.slug)}`;
  const languages: Record<string, string> = {};
  for (const alternate of page.alternates ?? []) {
    if (alternate.slug) languages[alternate.localeCode] = `/content/${encodeURIComponent(typeKey)}/${encodeURIComponent(alternate.localeCode)}/${encodeURIComponent(alternate.slug)}`;
  }
  return {
    title: page.seoTitle?.trim() || page.title,
    description: page.seoDescription?.trim() || page.excerpt || undefined,
    alternates: { canonical, languages: Object.keys(languages).length ? languages : undefined },
    openGraph: {
      title: page.seoTitle?.trim() || page.title,
      description: page.seoDescription?.trim() || page.excerpt || undefined,
      type: "article",
      locale: page.locale.code,
    },
  };
}

export default async function PublishedCmsPage({ params }: { params: Promise<RouteParams> }) {
  const { typeKey, localeCode, slug } = await params;
  const page = await getPublished(typeKey, localeCode, slug);
  if (!page) notFound();
  return <main lang={page.locale.code} dir={page.locale.direction === "RTL" ? "rtl" : "ltr"} style={{ minHeight: "100vh", padding: "clamp(12px, 3vw, 40px)", background: "var(--vz-body-bg, #f4f6f9)" }}>
    <PagePreview title={page.title} excerpt={page.excerpt} fields={page.fields} direction={page.locale.direction} />
  </main>;
}
