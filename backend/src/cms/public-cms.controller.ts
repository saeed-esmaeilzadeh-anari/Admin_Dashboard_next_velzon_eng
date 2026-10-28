import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { CmsService } from "./cms.service";
import { ListPublicContentQuery } from "./dto/cms.dto";
@ApiTags("cms-public")
@Controller("public/cms")
export class PublicCmsController {
  constructor(private readonly cms: CmsService) {}
  @Get(":typeKey/:localeCode")
  @ApiOperation({ summary: "List published content for a content type and locale" })
  list(@Param("typeKey") type: string, @Param("localeCode") locale: string, @Query() q: ListPublicContentQuery) { return this.cms.listPublicContent(type, locale, q); }
  @Get(":typeKey/:localeCode/:slug")
  @ApiOperation({ summary: "Read a published item by its localized published slug" })
  get(@Param("typeKey") type: string, @Param("localeCode") locale: string, @Param("slug") slug: string) { return this.cms.getPublicContent(type, locale, slug); }
}
