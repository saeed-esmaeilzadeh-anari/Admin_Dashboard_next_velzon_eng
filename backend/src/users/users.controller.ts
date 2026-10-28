import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { Role } from "@prisma/client";
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { UsersService } from "./users.service";

class ListUsersQuery {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() search?: string;
}
class UpdateUserDto {
  @IsOptional() @IsEnum(Role) role?: Role;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsString() @Min(2) @MaxLength(100) name?: string;
}

@ApiTags("users")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller("users")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQuery) {
    return this.users.list(Number(query.page) || 1, Math.min(100, Number(query.limit) || 20), query.search?.trim());
  }

  @Patch(":id")
  update(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateUserDto) {
    return this.users.update(id, dto);
  }
}
