import { cache } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cmsApi, CmsPage, CmsPublicContent, CmsPublicMenu } from "@/helpers/cmsApi";
import PublicCmsHeader from "@/components/Cms/PublicCmsHeader";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteParams = { typeKey: string; localeCode: string };
type PageQuery = { page?: string | string[] };
type ListingData = { result: CmsPage<CmsPublicContent> | null; menu: CmsPublicMenu | null };

const listPublishedContent = cache(async (typeKey: string, localeCode: string, page: number): Promise<ListingData> => {
  const menuPromise = cmsApi.publicMenu("main", localeCode).catch(() => null);
  try {
    const result = await cmsApi.publicContents(typeKey, localeCode, { page, limit: 12 });
    return { result, menu: await menuPromise };
  } catch (error) {
    const value = error as { response?: { status?: number } };
    if (value?.response?.status === 404) return { result: null, menu: await menuPromise };
    throw error;
  }
});

function directionFor(localeCode: string): "LTR" | "RTL" {
  return /^(fa|ar|he|ur)(-|$)/i.test(localeCode) ? "RTL" : "LTR";
}
function labelsFor(localeCode: string) {
  const base = localeCode.toLowerCase().split("-")[0];
  if (base === "fa") return {
    title: "محتوا",
    empty: "هنوز محتوای منتشرشده‌ای وجود ندارد.",
    previous: "صفحه قبل",
    next: "صفحه بعد",
    page: "صفحه",
    of: "از",
    read: "مشاهده محتوا",
  };
  if (base === "ar") return {
    title: "المحتوى",
    empty: "لا يوجد محتوى منشور بعد.",
    previous: "الصفحة السابقة",
    next: "الصفحة التالية",
    page: "صفحة",
    of: "من",
    read: "عرض المحتوى",
  };
  return {
    title: "Content",
    empty: "No published content yet.",
    previous: "Previous page",
    next: "Next page",
    page: "Page",
    of: "of",
    read: "Read content",
  };
}

export async function generateMetadata({ params }: { params: Promise<RouteParams> }): Promise<Metadata> {
  const { typeKey, localeCode } = await params;
  const data = await listPublishedContent(typeKey, localeCode, 1);
  if (!data.result) return { title: "Content not found" };
  const typeName = data.result.data[0]?.type.name ?? typeKey;
  return {
    title: `${typeName} | ${localeCode}`,
    description: `Published ${typeName.toLowerCase()} content`,
    alternates: { canonical: `/content/${encodeURIComponent(typeKey)}/${encodeURIComponent(localeCode)}` },
  };
}

export default async function PublishedContentListing({
  params, searchParams,
}: {
  params: Promise<RouteParams>;
  searchParams?: Promise<PageQuery>;
}) {
  const { typeKey, localeCode } = await params;
  const query = (await searchParams) ?? {};
  const rawPage = Array.isArray(query.page) ? query.page[0] : query.page;
  const parsedPage = rawPage ? Number(rawPage) : 1;
  const pageNumber = Number.isSafeInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const data = await listPublishedContent(typeKey, localeCode, pageNumber);
  if (!data.result) notFound();

  const result = data.result;
  const first = result.data[0];
  const direction = first?.locale.direction ?? directionFor(localeCode);
  const labels = labelsFor(localeCode);
  const typeName = first?.type.name ?? typeKey;
  const basePath = `/content/${encodeURIComponent(typeKey)}/${encodeURIComponent(localeCode)}`;

  return <main lang={localeCode} dir={direction === "RTL" ? "rtl" : "ltr"} style={{ minHeight: "100vh", padding: "clamp(16px,4vw,48px)", background: "var(--vz-body-bg, #f3f3f9)" }}>
    <PublicCmsHeader menu={data.menu} localeCode={localeCode} />
    <div style={{ maxWidth: 1120, margin: "0 auto" }}>
      <header className="mb-4"><h1 className="display-6 fw-bold">{typeName}</h1><p className="text-muted">{labels.title}</p></header>
      {result.data.length === 0
        ? <div className="border rounded-4 p-5 text-center text-muted" style={{ background: "var(--vz-card-bg, #fff)" }}>{labels.empty}</div>
        : <div className="row g-3">
          {result.data.map(item => <div className="col-md-6 col-xl-4" key={item.id}>
            <article className="card card-body h-100 border-0 shadow-sm">
              <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
                <span className="badge bg-light text-dark">{item.locale.name}</span>
                {item.publishedAt ? <time className="small text-muted" dateTime={item.publishedAt}>{new Date(item.publishedAt).toLocaleDateString(localeCode)}</time> : null}
              </div>
              <h2 className="h4 fw-bold"><Link href={`${basePath}/${encodeURIComponent(item.slug)}`} className="text-reset text-decoration-none">{item.title}</Link></h2>
              {item.excerpt ? <p className="text-muted flex-grow-1">{item.excerpt}</p> : <div className="flex-grow-1" />}
              {item.terms?.length ? <div className="d-flex flex-wrap gap-2 mb-3">{item.terms.map(term => <span className="badge bg-primary-subtle text-primary" key={term.id}>{term.name}</span>)}</div> : null}
              <Link href={`${basePath}/${encodeURIComponent(item.slug)}`} className="btn btn-soft-primary align-self-start">{labels.read}</Link>
            </article>
          </div>)}
        </div>}
      {result.pagination.pages > 1 ? <nav className="d-flex align-items-center justify-content-between mt-4" aria-label={localeCode.toLowerCase().startsWith("fa") ? "صفحه‌بندی" : "Pagination"}>
        {pageNumber > 1
          ? <Link className="btn btn-light" href={pageNumber === 2 ? basePath : `${basePath}?page=${pageNumber - 1}`}>{labels.previous}</Link>
          : <span />}
        <span className="text-muted small">{labels.page} {pageNumber} {labels.of} {result.pagination.pages}</span>
        {pageNumber < result.pagination.pages
          ? <Link className="btn btn-light" href={`${basePath}?page=${pageNumber + 1}`}>{labels.next}</Link>
          : <span />}
      </nav> : null}
    </div>
  </main>;
}
