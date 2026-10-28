import {
  Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { Role } from "@prisma/client";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { AuthenticatedUser, CurrentUser } from "../common/decorators/current-user.decorator";
import { Roles } from "../common/decorators/roles.decorator";
import { RolesGuard } from "../common/guards/roles.guard";
import { BusinessService } from "./business.service";
import {
  CreateCategoryDto, CreateCustomerDto, CreateLeadDto, CreateOrderDto, CreateProductDto,
  CreateProjectDto, CreateTaskDto, CreateTicketDto, ListQueryDto, UpdateCustomerDto,
  UpdateLeadDto, UpdateOrderStatusDto, UpdateProductDto, UpdateProjectDto, UpdateTaskDto,
  UpdateTicketDto,
} from "./dto/dto";

@ApiTags("business")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller()
export class BusinessController {
  constructor(private readonly business: BusinessService) {}

  @Get("dashboard/summary")
  summary() { return this.business.dashboardSummary(); }

  @Get("categories")
  categories(@Query() query: ListQueryDto) { return this.business.listCategories(query); }
  @Post("categories")
  @Roles(Role.ADMIN, Role.MANAGER)
  createCategory(@Body() dto: CreateCategoryDto) { return this.business.createCategory(dto); }

  @Get("products")
  products(@Query() query: ListQueryDto) { return this.business.listProducts(query); }
  @Get("products/:id")
  product(@Param("id", new ParseUUIDPipe()) id: string) { return this.business.getProduct(id); }
  @Post("products")
  @Roles(Role.ADMIN, Role.MANAGER)
  createProduct(@Body() dto: CreateProductDto) { return this.business.createProduct(dto); }
  @Patch("products/:id")
  @Roles(Role.ADMIN, Role.MANAGER)
  updateProduct(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateProductDto) {
    return this.business.updateProduct(id, dto);
  }
  @Delete("products/:id")
  @Roles(Role.ADMIN, Role.MANAGER)
  archiveProduct(@Param("id", new ParseUUIDPipe()) id: string) { return this.business.archiveProduct(id); }

  @Get("customers")
  customers(@Query() query: ListQueryDto) { return this.business.listCustomers(query); }
  @Get("customers/:id")
  customer(@Param("id", new ParseUUIDPipe()) id: string) { return this.business.getCustomer(id); }
  @Post("customers")
  @Roles(Role.ADMIN, Role.MANAGER)
  createCustomer(@Body() dto: CreateCustomerDto) { return this.business.createCustomer(dto); }
  @Patch("customers/:id")
  @Roles(Role.ADMIN, Role.MANAGER)
  updateCustomer(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateCustomerDto) {
    return this.business.updateCustomer(id, dto);
  }
  @Delete("customers/:id")
  @Roles(Role.ADMIN, Role.MANAGER)
  archiveCustomer(@Param("id", new ParseUUIDPipe()) id: string) { return this.business.archiveCustomer(id); }

  @Get("leads")
  leads(@Query() query: ListQueryDto) { return this.business.listLeads(query); }
  @Post("leads")
  createLead(@Body() dto: CreateLeadDto) { return this.business.createLead(dto); }
  @Patch("leads/:id")
  updateLead(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateLeadDto) {
    return this.business.updateLead(id, dto);
  }
  @Delete("leads/:id")
  @Roles(Role.ADMIN, Role.MANAGER)
  deleteLead(@Param("id", new ParseUUIDPipe()) id: string) { return this.business.deleteLead(id); }

  @Get("projects")
  projects(@Query() query: ListQueryDto) { return this.business.listProjects(query); }
  @Get("projects/:id")
  project(@Param("id", new ParseUUIDPipe()) id: string) { return this.business.getProject(id); }
  @Post("projects")
  createProject(@Body() dto: CreateProjectDto, @CurrentUser() user: AuthenticatedUser) {
    return this.business.createProject(dto, user.id);
  }
  @Patch("projects/:id")
  updateProject(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateProjectDto) {
    return this.business.updateProject(id, dto);
  }
  @Delete("projects/:id")
  @Roles(Role.ADMIN, Role.MANAGER)
  deleteProject(@Param("id", new ParseUUIDPipe()) id: string) { return this.business.deleteProject(id); }

  @Get("tasks")
  tasks(@Query() query: ListQueryDto) { return this.business.listTasks(query); }
  @Get("tasks/:id")
  task(@Param("id", new ParseUUIDPipe()) id: string) { return this.business.getTask(id); }
  @Post("tasks")
  createTask(@Body() dto: CreateTaskDto, @CurrentUser() user: AuthenticatedUser) {
    return this.business.createTask(dto, user.id);
  }
  @Patch("tasks/:id")
  updateTask(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateTaskDto) {
    return this.business.updateTask(id, dto);
  }
  @Delete("tasks/:id")
  @Roles(Role.ADMIN, Role.MANAGER)
  deleteTask(@Param("id", new ParseUUIDPipe()) id: string) { return this.business.deleteTask(id); }

  @Get("tickets")
  tickets(@Query() query: ListQueryDto) { return this.business.listTickets(query); }
  @Get("tickets/:id")
  ticket(@Param("id", new ParseUUIDPipe()) id: string) { return this.business.getTicket(id); }
  @Post("tickets")
  createTicket(@Body() dto: CreateTicketDto, @CurrentUser() user: AuthenticatedUser) {
    return this.business.createTicket(dto, user.id);
  }
  @Patch("tickets/:id")
  updateTicket(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateTicketDto) {
    return this.business.updateTicket(id, dto);
  }
  @Delete("tickets/:id")
  @Roles(Role.ADMIN, Role.MANAGER)
  deleteTicket(@Param("id", new ParseUUIDPipe()) id: string) { return this.business.deleteTicket(id); }

  @Get("orders")
  orders(@Query() query: ListQueryDto) { return this.business.listOrders(query); }
  @Get("orders/:id")
  order(@Param("id", new ParseUUIDPipe()) id: string) { return this.business.getOrder(id); }
  @Post("orders")
  @Roles(Role.ADMIN, Role.MANAGER)
  createOrder(@Body() dto: CreateOrderDto, @CurrentUser() user: AuthenticatedUser) {
    return this.business.createOrder(dto, user.id);
  }
  @Patch("orders/:id/status")
  @Roles(Role.ADMIN, Role.MANAGER)
  updateOrderStatus(@Param("id", new ParseUUIDPipe()) id: string, @Body() dto: UpdateOrderStatusDto) {
    return this.business.updateOrderStatus(id, dto.status);
  }
}
