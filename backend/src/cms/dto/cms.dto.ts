import { CmsContentStatus, CmsFieldType, LocaleDirection } from "@prisma/client";
import { Type } from "class-transformer";
import {
  ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDateString, IsEnum, IsInt,
  IsObject, IsOptional, IsString, IsUUID, Length, Matches, Max, MaxLength,
  Min, MinLength, ValidateNested,
} from "class-validator";

const localeCodePattern = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})*$/;
const keyPattern = /^[a-z][a-z0-9_-]{0,63}$/;
const slugPattern = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

export class CreateLocaleDto {
  @IsString() @Matches(localeCodePattern) code!: string;
  @IsString() @Length(2, 100) name!: string;
  @IsString() @Length(2, 100) nativeName!: string;
  @IsOptional() @IsEnum(LocaleDirection) direction: LocaleDirection = LocaleDirection.LTR;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsUUID() fallbackLocaleId?: string;
}
export class UpdateLocaleDto {
  @IsOptional() @IsString() @Length(2, 100) name?: string;
  @IsOptional() @IsString() @Length(2, 100) nativeName?: string;
  @IsOptional() @IsEnum(LocaleDirection) direction?: LocaleDirection;
  @IsOptional() @IsBoolean() isDefault?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsUUID() fallbackLocaleId?: string | null;
}
export class CreateContentTypeFieldDto {
  @IsString() @Matches(keyPattern) key!: string;
  @IsString() @Length(1, 100) label!: string;
  @IsEnum(CmsFieldType) type!: CmsFieldType;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsBoolean() isLocalized?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) sortOrder?: number;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}
export class UpdateContentTypeFieldDto {
  @IsOptional() @IsString() @Length(1, 100) label?: string;
  @IsOptional() @IsBoolean() isRequired?: boolean;
  @IsOptional() @IsBoolean() isLocalized?: boolean;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsInt() @Min(0) @Max(10000) sortOrder?: number;
  @IsOptional() @IsObject() config?: Record<string, unknown>;
}
export class CreateContentTypeDto {
  @IsString() @Matches(keyPattern) key!: string;
  @IsString() @Length(2, 100) name!: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100)
  @ValidateNested({ each: true }) @Type(() => CreateContentTypeFieldDto)
  fields!: CreateContentTypeFieldDto[];
}
export class UpdateContentTypeDto {
  @IsOptional() @IsString() @Length(2, 100) name?: string;
  @IsOptional() @IsString() @MaxLength(1000) description?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
export class CreateContentDto {
  @IsString() @Matches(keyPattern) typeKey!: string;
  @IsString() @Matches(localeCodePattern) localeCode!: string;
  @IsString() @Length(1, 300) title!: string;
  @IsString() @Length(1, 180) @Matches(slugPattern) slug!: string;
  @IsOptional() @IsString() @MaxLength(2000) excerpt?: string;
  @IsOptional() @IsString() @MaxLength(300) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(1000) seoDescription?: string;
  @IsOptional() @IsObject() fields?: Record<string, unknown>;
}
export class CreateTranslationDto {
  @IsString() @Matches(localeCodePattern) localeCode!: string;
  @IsString() @Length(1, 300) title!: string;
  @IsString() @Length(1, 180) @Matches(slugPattern) slug!: string;
  @IsOptional() @IsString() @MaxLength(2000) excerpt?: string;
  @IsOptional() @IsString() @MaxLength(300) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(1000) seoDescription?: string;
  @IsOptional() @IsObject() fields?: Record<string, unknown>;
}
export class UpdateContentTranslationDto {
  @IsOptional() @IsString() @Length(1, 300) title?: string;
  @IsOptional() @IsString() @Length(1, 180) @Matches(slugPattern) slug?: string;
  @IsOptional() @IsString() @MaxLength(2000) excerpt?: string;
  @IsOptional() @IsString() @MaxLength(300) seoTitle?: string;
  @IsOptional() @IsString() @MaxLength(1000) seoDescription?: string;
  @IsOptional() @IsObject() fields?: Record<string, unknown>;
}
export class UpdateSharedFieldsDto { @IsObject() fields!: Record<string, unknown>; }
export class RejectContentDto { @IsString() @MinLength(2) @MaxLength(1000) reason!: string; }
export class ScheduleContentDto { @IsDateString() scheduledAt!: string; }
export class ListCmsContentsQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(100) typeKey?: string;
  @IsOptional() @IsString() @Matches(localeCodePattern) localeCode?: string;
  @IsOptional() @IsEnum(CmsContentStatus) status?: CmsContentStatus;
  @IsOptional() @IsString() @MaxLength(200) search?: string;
}
export class ListPublicContentQuery {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
}
