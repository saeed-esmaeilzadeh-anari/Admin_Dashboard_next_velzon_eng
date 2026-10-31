import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import { Throttle, ThrottlerGuard } from "@nestjs/throttler";
import { CmsManagementService } from "./cms-management.service";
import { SubmitCmsFormDto } from "./cms-management.dto";
@ApiTags("cms-public-management")
@Controller("public/cms")
export class CmsPublicManagementController {
  constructor(private readonly cms: CmsManagementService) {}
  @Get("menus/:key/:localeCode")
  @ApiOperation({ summary: "Read an active localized menu as a tree" })
  getMenu(@Param("key") key: string, @Param("localeCode") localeCode: string) { return this.cms.getPublicMenu(key, localeCode); }
  @Get("forms/:key")
  @ApiOperation({ summary: "Get the public schema for an active form" })
  getForm(@Param("key") key: string) { return this.cms.publicForm(key); }
  @Post("forms/:key/submissions")
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @ApiOperation({ summary: "Validate and store a public form submission" })
  submitForm(@Param("key") key: string, @Body() dto: SubmitCmsFormDto) { return this.cms.submitForm(key, dto); }
  @Get("redirects/resolve")
  @ApiOperation({ summary: "Resolve a configured locale-aware redirect" })
  resolveRedirect(@Query("path") path: string, @Query("localeCode") localeCode?: string) { return this.cms.resolveRedirect(path, localeCode); }
}
