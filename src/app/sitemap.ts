import type { MetadataRoute } from "next";
import { cmsApi } from "@/helpers/cmsApi";

// Sitemap entries change whenever content is published/unpublished. Resolve them at
// request time instead of accidentally baking an empty sitemap during the frontend build.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.PUBLIC_SITE_URL;
  if (!siteUrl) return [];
  let base: URL;
  try {
    base = new URL(siteUrl);
    if (!["http:", "https:"].includes(base.protocol) || base.username || base.password) return [];
  } catch {
    return [];
  }

  try {
    const records = await cmsApi.publicSitemap();
    return records.map(record => ({
      url: new URL(record.href, base).toString(),
      lastModified: record.lastModified,
      alternates: {
        languages: Object.fromEntries(
          record.alternates
            .filter(item => item.slug)
            .map(item => [item.localeCode, new URL(item.href, base).toString()]),
        ),
      },
    }));
  } catch {
    return [];
  }
}
