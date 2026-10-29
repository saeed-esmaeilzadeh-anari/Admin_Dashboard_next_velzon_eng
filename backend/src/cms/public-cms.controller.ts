import { Controller, Get, Header, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CmsService } from "./cms.service";
import { ListPublicContentQuery } from "./dto/cms.dto";
@ApiTags("cms-public")
@Controller("public/cms")
export class PublicCmsController {
  constructor(private readonly cms: CmsService) {}
  @Get("sitemap.xml")
  @Header("Content-Type", "application/xml; charset=utf-8")
  @ApiOperation({ summary: "Generate an XML sitemap for published CMS translations, including language alternates" })
  sitemap() { return this.cms.publicSitemapXml(); }

  @Get("sitemap")
  @ApiOperation({ summary: "List published localized URLs and alternates for sitemap generation" })
  sitemapJson() { return this.cms.publicSitemap(); }

  @Get(":typeKey/:localeCode")
  @ApiOperation({ summary: "List published content for a content type and locale" })
  list(@Param("typeKey") type: string, @Param("localeCode") locale: string, @Query() q: ListPublicContentQuery) { return this.cms.listPublicContent(type, locale, q); }
  @Get(":typeKey/:localeCode/:slug")
  @ApiOperation({ summary: "Read a published item by its localized published slug" })
  get(@Param("typeKey") type: string, @Param("localeCode") locale: string, @Param("slug") slug: string) { return this.cms.getPublicContent(type, locale, slug); }
}
