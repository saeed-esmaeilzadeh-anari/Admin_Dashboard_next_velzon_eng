import { Type } from "class-transformer";
import {
  ArrayMinSize, IsArray, IsDateString, IsEmail, IsEnum, IsInt, IsNumber, IsOptional,
  IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested,
} from "class-validator";
import {
  CustomerStatus, LeadStatus, OrderStatus, ProductStatus, ProjectStatus,
  TaskPriority, TaskStatus, TicketStatus,
} from "@prisma/client";
import { PartialType } from "@nestjs/swagger";

export class ListQueryDto {
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) page = 1;
  @Type(() => Number) @IsOptional() @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
}
export class CreateCategoryDto {
  @IsString() @MinLength(2) @MaxLength(80) name!: string;
  @IsString() @MinLength(2) @MaxLength(100) slug!: string;
}
export class CreateProductDto {
  @IsString() @MinLength(2) @MaxLength(180) name!: string;
  @IsString() @MinLength(1) @MaxLength(80) sku!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @Type(() => Number) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) price!: number;
  @Type(() => Number) @IsOptional() @IsInt() @Min(0) stock = 0;
  @IsOptional() @IsEnum(ProductStatus) status?: ProductStatus;
  @IsOptional() @IsUUID() categoryId?: string;
}
export class UpdateProductDto extends PartialType(CreateProductDto) {}
export class CreateCustomerDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
  @IsOptional() @IsEnum(CustomerStatus) status?: CustomerStatus;
}
export class UpdateCustomerDto extends PartialType(CreateCustomerDto) {}
export class CreateLeadDto {
  @IsString() @MinLength(2) @MaxLength(160) name!: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @MaxLength(40) phone?: string;
  @IsOptional() @IsString() @MaxLength(160) company?: string;
  @IsOptional() @IsString() @MaxLength(100) source?: string;
  @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @IsOptional() @IsString() @MaxLength(4000) notes?: string;
}
export class UpdateLeadDto extends PartialType(CreateLeadDto) {}
export class CreateProjectDto {
  @IsString() @MinLength(2) @MaxLength(180) name!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsEnum(ProjectStatus) status?: ProjectStatus;
  @IsOptional() @IsDateString() startDate?: string;
  @IsOptional() @IsDateString() dueDate?: string;
}
export class UpdateProjectDto extends PartialType(CreateProjectDto) {}
export class CreateTaskDto {
  @IsString() @MinLength(2) @MaxLength(180) title!: string;
  @IsOptional() @IsString() @MaxLength(4000) description?: string;
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsDateString() dueDate?: string;
  @IsOptional() @IsUUID() projectId?: string;
  @IsOptional() @IsUUID() assigneeId?: string;
}
export class UpdateTaskDto extends PartialType(CreateTaskDto) {}
export class CreateTicketDto {
  @IsString() @MinLength(2) @MaxLength(180) title!: string;
  @IsString() @MinLength(2) @MaxLength(6000) description!: string;
  @IsOptional() @IsEnum(TicketStatus) status?: TicketStatus;
  @IsOptional() @IsEnum(TaskPriority) priority?: TaskPriority;
  @IsOptional() @IsUUID() customerId?: string;
  @IsOptional() @IsUUID() assignedToId?: string;
}
export class UpdateTicketDto extends PartialType(CreateTicketDto) {}
export class CreateOrderItemDto {
  @IsUUID() productId!: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(100000) quantity!: number;
}
export class CreateOrderDto {
  @IsUUID() customerId!: string;
  @IsArray() @ArrayMinSize(1) @ValidateNested({ each: true }) @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
  @Type(() => Number) @IsOptional() @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) tax = 0;
}
export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus) status!: OrderStatus;
}
