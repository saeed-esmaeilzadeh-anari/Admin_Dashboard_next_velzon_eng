import "dotenv/config";
import {
  CmsContentStatus,
  PrismaClient,
  Role,
  type Prisma,
} from "@prisma/client";

const prisma = new PrismaClient();

type DemoArticle = {
  localeCode: "fa-IR" | "en-US";
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  summary: string;
  seoTitle: string;
  seoDescription: string;
  featured: boolean;
};

const demoArticles: DemoArticle[] = [
  {
    localeCode: "fa-IR",
    title: "به Velzon Enterprise CMS خوش آمدید",
    slug: "welcome-to-velzon-cms",
    excerpt: "آشنایی با یک سامانه مدیریت محتوای دوزبانه و ماژولار.",
    summary: "معرفی کوتاه امکانات هسته مدیریت محتوا.",
    body:
      "این محتوای نمونه برای نمایش چرخه واقعی مدیریت محتوا ایجاد شده است. می‌توانید آن را در پنل ویرایش کنید، نسخه جدید بسازید و پس از بازبینی دوباره منتشر کنید.",
    seoTitle: "معرفی Velzon Enterprise CMS",
    seoDescription: "نمونه محتوای فارسی برای نمایش قابلیت‌های CMS.",
    featured: true,
  },
  {
    localeCode: "en-US",
    title: "Welcome to Velzon Enterprise CMS",
    slug: "welcome-to-velzon-cms",
    excerpt: "An introduction to a modular bilingual content management system.",
    summary: "A short introduction to the CMS foundation.",
    body:
      "This sample article demonstrates a real database-backed publishing flow. Open it in the admin panel, edit a translation, review a revision and publish the updated snapshot.",
    seoTitle: "Welcome to Velzon Enterprise CMS",
    seoDescription: "English demo content for the Velzon CMS portfolio.",
    featured: true,
  },
  {
    localeCode: "fa-IR",
    title: "معماری یک پروژه Full-Stack",
    slug: "portfolio-full-stack-showcase",
    excerpt: "مروری بر ارتباط رابط کاربری، API و پایگاه داده.",
    summary: "نمونه‌ای برای نمایش ساختار فنی پروژه.",
    body:
      "رابط کاربری Next.js از طریق لایه BFF با API مبتنی بر NestJS ارتباط دارد. اطلاعات محتوایی در PostgreSQL ذخیره می‌شوند و Prisma لایه دسترسی به داده را مدیریت می‌کند.",
    seoTitle: "معماری Full-Stack در Velzon",
    seoDescription: "نمایش معماری Next.js، NestJS و PostgreSQL.",
    featured: false,
  },
  {
    localeCode: "en-US",
    title: "Inside a Full-Stack Project",
    slug: "portfolio-full-stack-showcase",
    excerpt: "A practical overview of the UI, API and database layers.",
    summary: "Sample technical content for the portfolio demo.",
    body:
      "The Next.js interface communicates with a NestJS API through a same-origin BFF. Content is persisted in PostgreSQL and Prisma provides the typed data-access layer.",
    seoTitle: "Full-Stack Architecture in Velzon",
    seoDescription: "A practical overview of Next.js, NestJS and PostgreSQL.",
    featured: false,
  },
];

function createSnapshot(article: DemoArticle): Prisma.InputJsonValue {
  return {
    title: article.title,
    slug: article.slug,
    excerpt: article.excerpt,
    seoTitle: article.seoTitle,
    seoDescription: article.seoDescription,
    data: {
      body: article.body,
      summary: article.summary,
    },
    sharedData: {
      featured: article.featured,
    },
  };
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo content seeding is blocked in production.");
  }
  if (process.env.DEMO_SEED_ENABLED !== "true") {
    throw new Error(
      "Set DEMO_SEED_ENABLED=true explicitly to add portfolio demo content."
    );
  }

  const [admin, articleType, locales] = await Promise.all([
    prisma.user.findFirst({
      where: { role: Role.ADMIN, isActive: true },
      select: { id: true },
    }),
    prisma.contentType.findUnique({
      where: { key: "article" },
      select: {
        id: true,
        isActive: true,
        fields: { select: { key: true, isActive: true } },
      },
    }),
    prisma.locale.findMany({
      where: { code: { in: ["fa-IR", "en-US"] }, isActive: true },
      select: { id: true, code: true },
    }),
  ]);

  if (!admin) throw new Error("Run the administrator seed before demo seeding.");
  if (!articleType?.isActive) throw new Error("The active article content type is missing.");

  const fieldKeys = new Set(articleType.fields.filter(field => field.isActive).map(field => field.key));
  for (const requiredField of ["body", "summary", "featured"]) {
    if (!fieldKeys.has(requiredField)) {
      throw new Error("The article content type is missing the active field: " + requiredField);
    }
  }

  const localeByCode = new Map(locales.map(locale => [locale.code, locale]));
  for (const code of ["fa-IR", "en-US"] as const) {
    if (!localeByCode.has(code)) throw new Error("The active locale is missing: " + code);
  }

  let created = 0;
  let skipped = 0;

  for (const article of demoArticles) {
    const locale = localeByCode.get(article.localeCode);
    if (!locale) throw new Error("No locale record for " + article.localeCode);

    const existing = await prisma.contentTranslation.findUnique({
      where: {
        localeId_slug: {
          localeId: locale.id,
          slug: article.slug,
        },
      },
      select: { id: true },
    });

    // Never overwrite content edited by a portfolio reviewer or customer.
    if (existing) {
      skipped++;
      continue;
    }

    const now = new Date();
    const snapshot = createSnapshot(article);

    await prisma.$transaction(async tx => {
      const content = await tx.content.create({
        data: {
          contentTypeId: articleType.id,
          createdById: admin.id,
          data: { featured: article.featured },
          translations: {
            create: {
              localeId: locale.id,
              title: article.title,
              slug: article.slug,
              excerpt: article.excerpt,
              seoTitle: article.seoTitle,
              seoDescription: article.seoDescription,
              data: {
                body: article.body,
                summary: article.summary,
              },
              status: CmsContentStatus.PUBLISHED,
              version: 1,
              publishedAt: now,
              publishedSlug: article.slug,
              publishedSnapshot: snapshot,
            },
          },
        },
        include: { translations: true },
      });

      const translation = content.translations[0];
      if (!translation) throw new Error("Demo translation creation failed.");

      await tx.contentRevision.create({
        data: {
          translationId: translation.id,
          version: 1,
          createdById: admin.id,
          changeNote: "Initial portfolio demo content",
          snapshot,
        },
      });
    });

    created++;
  }

  console.info(
    `Portfolio demo seed finished. Created: ${created}; already present: ${skipped}.`
  );
}

main()
  .catch(error => {
    console.error("Portfolio demo seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
