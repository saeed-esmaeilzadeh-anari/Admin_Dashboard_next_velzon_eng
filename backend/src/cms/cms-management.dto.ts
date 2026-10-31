import { CmsFormSubmissionStatus, CmsMediaKind, Role } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsEnum, IsIn, IsInt, IsObject,
  IsOptional, IsString, IsUUID, IsUrl, Length, Matches, Max, MaxLength, Min,
  MinLength,
} from "class-validator";

const machineKeyPattern = /^[a-z][a-z0-9_-]{0,63}$/;
const slugPattern = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
const localeCodePattern = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;
const localPathPattern = /^\/(?!\/)[^\s]*$/;

export class ListMediaQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 30;
  @IsOptional() @IsEnum(CmsMediaKind) kind?: CmsMediaKind;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
export class UpdateMediaAssetDto {
  @IsOptional() @IsString() @MaxLength(500) altText?: string | null;
  @IsOptional() @IsString() @MaxLength(1000) caption?: string | null;
}

export class CreateTaxonomyDto {
  @IsString() @Matches(machineKeyPattern) key!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsBoolean() isHierarchical?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateTaxonomyDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsBoolean() isHierarchical?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class CreateTaxonomyTermDto {
  @IsString() @Length(1, 160) name!: string;
  @IsString() @Length(1, 180) @Matches(slugPattern) slug!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateTaxonomyTermDto {
  @IsOptional() @IsString() @Length(1, 160) name?: string;
  @IsOptional() @IsString() @Length(1, 180) @Matches(slugPattern) slug?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string | null;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class CreateTermTranslationDto {
  @IsString() @Matches(localeCodePattern) localeCode!: string;
  @IsString() @Length(1, 160) name!: string;
  @IsString() @Length(1, 180) @Matches(slugPattern) slug!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
}
export class AssignTermsDto {
  @IsArray() @ArrayMaxSize(200) @IsUUID("all", { each: true }) termIds!: string[];
}

export class CreateMenuDto {
  @IsString() @Matches(machineKeyPattern) key!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsString() @Matches(localeCodePattern) localeCode!: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateMenuDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class CreateMenuItemDto {
  @IsString() @Length(1, 160) label!: string;
  @IsOptional() @IsString() @MaxLength(2048) url?: string | null;
  @IsOptional() @IsUUID() contentId?: string | null;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsBoolean() targetBlank?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateMenuItemDto {
  @IsOptional() @IsString() @Length(1, 160) label?: string;
  @IsOptional() @IsString() @MaxLength(2048) url?: string | null;
  @IsOptional() @IsUUID() contentId?: string | null;
  @IsOptional() @IsUUID() parentId?: string | null;
  @IsOptional() @IsBoolean() targetBlank?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) sortOrder?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateRedirectDto {
  @IsString() @Matches(localPathPattern) @MaxLength(2048) sourcePath!: string;
  @IsString() @MaxLength(2048) destinationPath!: string;
  @IsOptional() @IsIn([301, 302, 307, 308]) statusCode?: number;
  @IsOptional() @IsString() @Matches(localeCodePattern) localeCode?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateRedirectDto {
  @IsOptional() @IsString() @Matches(localPathPattern) @MaxLength(2048) sourcePath?: string;
  @IsOptional() @IsString() @MaxLength(2048) destinationPath?: string;
  @IsOptional() @IsIn([301, 302, 307, 308]) statusCode?: number;
  @IsOptional() @IsString() @Matches(localeCodePattern) localeCode?: string | null;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateCmsFormDto {
  @IsString() @Matches(machineKeyPattern) key!: string;
  @IsString() @Length(2, 120) name!: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsObject() schema!: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(1000) successMessage?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateCmsFormDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsString() @MaxLength(2000) description?: string;
  @IsOptional() @IsObject() schema?: Record<string, unknown>;
  @IsOptional() @IsString() @MaxLength(1000) successMessage?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class SubmitCmsFormDto {
  @IsObject() data!: Record<string, unknown>;
}
export class UpdateFormSubmissionDto {
  @IsEnum(CmsFormSubmissionStatus) status!: CmsFormSubmissionStatus;
  @IsOptional() @IsString() @MaxLength(4000) internalNote?: string | null;
}

export class CreateCmsWebhookDto {
  @IsString() @Length(2, 120) name!: string;
  @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(2048) endpointUrl!: string;
  @IsString() @MinLength(32) @MaxLength(256) secret!: string;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @IsString({ each: true }) events!: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateCmsWebhookDto {
  @IsOptional() @IsString() @Length(2, 120) name?: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true }) @MaxLength(2048) endpointUrl?: string;
  @IsOptional() @IsString() @MinLength(32) @MaxLength(256) secret?: string;
  @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(30) @IsString({ each: true }) events?: string[];
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class UpdateRolePermissionsDto {
  @IsEnum(Role) role!: Role;
  @IsArray() @ArrayMaxSize(100) @IsString({ each: true }) permissionCodes!: string[];
}
