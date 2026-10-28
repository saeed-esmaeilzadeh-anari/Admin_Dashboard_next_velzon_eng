import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import {
  CustomerStatus, LeadStatus, OrderStatus, Prisma, ProductStatus, ProjectStatus,
  TaskStatus, TicketStatus,
} from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import {
  CreateCategoryDto, CreateCustomerDto, CreateLeadDto, CreateOrderDto, CreateProductDto,
  CreateProjectDto, CreateTaskDto, CreateTicketDto, ListQueryDto, UpdateCustomerDto,
  UpdateLeadDto, UpdateProductDto, UpdateProjectDto, UpdateTaskDto, UpdateTicketDto,
} from "./dto/dto";

@Injectable()
export class BusinessService {
  constructor(private readonly prisma: PrismaService) {}

  private page(query: ListQueryDto) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
    return { page, limit, skip: (page - 1) * limit };
  }
  private term(query: ListQueryDto) { return query.search?.trim() || undefined; }
  private async paged<T>(dataPromise: Promise<T[]>, countPromise: Promise<number>, page: number, limit: number) {
    const [data, total] = await Promise.all([dataPromise, countPromise]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async dashboardSummary() {
    const [users, products, activeCustomers, openLeads, activeProjects, openTasks, openTickets, orders, revenue] = await Promise.all([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
      this.prisma.customer.count({ where: { status: CustomerStatus.ACTIVE } }),
      this.prisma.lead.count({ where: { status: { notIn: [LeadStatus.WON, LeadStatus.LOST] } } }),
      this.prisma.project.count({ where: { status: ProjectStatus.ACTIVE } }),
      this.prisma.task.count({ where: { status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.BLOCKED] } } }),
      this.prisma.ticket.count({ where: { status: { in: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING] } } }),
      this.prisma.order.count(),
      this.prisma.order.aggregate({ _sum: { total: true }, where: { status: { notIn: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] } } }),
    ]);
    return {
      users, products, activeCustomers, openLeads, activeProjects, openTasks, openTickets, orders,
      orderRevenue: revenue._sum.total?.toString() ?? "0.00",
      generatedAt: new Date().toISOString(),
    };
  }

  listCategories(query: ListQueryDto) {
    const { page, limit, skip } = this.page(query); const term = this.term(query);
    const where: Prisma.CategoryWhereInput = term ? { OR: [
      { name: { contains: term, mode: "insensitive" } }, { slug: { contains: term, mode: "insensitive" } },
    ] } : {};
    return this.paged(
      this.prisma.category.findMany({ where, include: { _count: { select: { products: true } } }, orderBy: { name: "asc" }, skip, take: limit }),
      this.prisma.category.count({ where }), page, limit,
    );
  }
  createCategory(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: { name: dto.name.trim(), slug: dto.slug.trim().toLowerCase() } });
  }

  listProducts(query: ListQueryDto) {
    const { page, limit, skip } = this.page(query); const term = this.term(query);
    const where: Prisma.ProductWhereInput = term ? { OR: [
      { name: { contains: term, mode: "insensitive" } }, { sku: { contains: term, mode: "insensitive" } },
      { description: { contains: term, mode: "insensitive" } },
    ] } : {};
    return this.paged(
      this.prisma.product.findMany({ where, include: { category: true }, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.product.count({ where }), page, limit,
    );
  }
  async getProduct(id: string) {
    const row = await this.prisma.product.findUnique({ where: { id }, include: { category: true } });
    if (!row) throw new NotFoundException("Product not found.");
    return row;
  }
  createProduct(dto: CreateProductDto) {
    return this.prisma.product.create({ data: {
      name: dto.name.trim(), sku: dto.sku.trim(), description: dto.description,
      price: new Prisma.Decimal(dto.price), stock: dto.stock ?? 0,
      status: dto.status ?? ProductStatus.ACTIVE, categoryId: dto.categoryId ?? null,
    }, include: { category: true } });
  }
  updateProduct(id: string, dto: UpdateProductDto) {
    const data: Prisma.ProductUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.sku !== undefined) data.sku = dto.sku.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.price !== undefined) data.price = new Prisma.Decimal(dto.price);
    if (dto.stock !== undefined) data.stock = dto.stock;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.categoryId !== undefined) data.category = dto.categoryId ? { connect: { id: dto.categoryId } } : { disconnect: true };
    return this.prisma.product.update({ where: { id }, data, include: { category: true } });
  }
  archiveProduct(id: string) {
    return this.prisma.product.update({ where: { id }, data: { status: ProductStatus.ARCHIVED } });
  }

  listCustomers(query: ListQueryDto) {
    const { page, limit, skip } = this.page(query); const term = this.term(query);
    const where: Prisma.CustomerWhereInput = term ? { OR: [
      { name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } },
      { company: { contains: term, mode: "insensitive" } }, { phone: { contains: term } },
    ] } : {};
    return this.paged(
      this.prisma.customer.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.customer.count({ where }), page, limit,
    );
  }
  async getCustomer(id: string) {
    const row = await this.prisma.customer.findUnique({ where: { id }, include: { _count: { select: { orders: true, tickets: true } } } });
    if (!row) throw new NotFoundException("Customer not found.");
    return row;
  }
  createCustomer(dto: CreateCustomerDto) {
    return this.prisma.customer.create({ data: {
      name: dto.name.trim(), email: dto.email?.trim().toLowerCase() ?? null,
      phone: dto.phone, company: dto.company, notes: dto.notes, status: dto.status,
    } });
  }
  updateCustomer(id: string, dto: UpdateCustomerDto) {
    const data: Prisma.CustomerUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.email !== undefined) data.email = dto.email.trim().toLowerCase();
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.company !== undefined) data.company = dto.company;
    if (dto.notes !== undefined) data.notes = dto.notes;
    if (dto.status !== undefined) data.status = dto.status;
    return this.prisma.customer.update({ where: { id }, data });
  }
  archiveCustomer(id: string) {
    return this.prisma.customer.update({ where: { id }, data: { status: CustomerStatus.ARCHIVED } });
  }

  listLeads(query: ListQueryDto) {
    const { page, limit, skip } = this.page(query); const term = this.term(query);
    const where: Prisma.LeadWhereInput = term ? { OR: [
      { name: { contains: term, mode: "insensitive" } }, { email: { contains: term, mode: "insensitive" } },
      { company: { contains: term, mode: "insensitive" } }, { phone: { contains: term } },
    ] } : {};
    return this.paged(
      this.prisma.lead.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.lead.count({ where }), page, limit,
    );
  }
  createLead(dto: CreateLeadDto) {
    return this.prisma.lead.create({ data: {
      ...dto, name: dto.name.trim(), email: dto.email?.trim().toLowerCase(),
    } });
  }
  updateLead(id: string, dto: UpdateLeadDto) {
    return this.prisma.lead.update({ where: { id }, data: {
      ...dto, ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.email !== undefined ? { email: dto.email.trim().toLowerCase() } : {}),
    } });
  }
  deleteLead(id: string) { return this.prisma.lead.delete({ where: { id } }); }

  listProjects(query: ListQueryDto) {
    const { page, limit, skip } = this.page(query); const term = this.term(query);
    const where: Prisma.ProjectWhereInput = term ? { OR: [
      { name: { contains: term, mode: "insensitive" } }, { description: { contains: term, mode: "insensitive" } },
    ] } : {};
    return this.paged(
      this.prisma.project.findMany({ where, include: { owner: { select: { id: true, name: true, email: true } }, _count: { select: { tasks: true } } }, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.project.count({ where }), page, limit,
    );
  }
  async getProject(id: string) {
    const row = await this.prisma.project.findUnique({ where: { id }, include: { owner: { select: { id: true, name: true, email: true } }, tasks: true } });
    if (!row) throw new NotFoundException("Project not found.");
    return row;
  }
  createProject(dto: CreateProjectDto, ownerId: string) {
    return this.prisma.project.create({ data: {
      name: dto.name.trim(), description: dto.description, status: dto.status,
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null, ownerId,
    } });
  }
  updateProject(id: string, dto: UpdateProjectDto) {
    const data: Prisma.ProjectUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.startDate !== undefined) data.startDate = dto.startDate ? new Date(dto.startDate) : null;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    return this.prisma.project.update({ where: { id }, data });
  }
  deleteProject(id: string) { return this.prisma.project.delete({ where: { id } }); }

  listTasks(query: ListQueryDto) {
    const { page, limit, skip } = this.page(query); const term = this.term(query);
    const where: Prisma.TaskWhereInput = term ? { OR: [
      { title: { contains: term, mode: "insensitive" } }, { description: { contains: term, mode: "insensitive" } },
    ] } : {};
    return this.paged(
      this.prisma.task.findMany({ where, include: { project: { select: { id: true, name: true } }, assignee: { select: { id: true, name: true, email: true } } }, orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }], skip, take: limit }),
      this.prisma.task.count({ where }), page, limit,
    );
  }
  async getTask(id: string) {
    const row = await this.prisma.task.findUnique({ where: { id }, include: { project: true, assignee: { select: { id: true, name: true, email: true } } } });
    if (!row) throw new NotFoundException("Task not found.");
    return row;
  }
  createTask(dto: CreateTaskDto, createdById: string) {
    return this.prisma.task.create({ data: {
      title: dto.title.trim(), description: dto.description, status: dto.status, priority: dto.priority,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
      projectId: dto.projectId ?? null, assigneeId: dto.assigneeId ?? null, createdById,
    } });
  }
  updateTask(id: string, dto: UpdateTaskDto) {
    const data: Prisma.TaskUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.dueDate !== undefined) data.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
    if (dto.projectId !== undefined) data.project = dto.projectId ? { connect: { id: dto.projectId } } : { disconnect: true };
    if (dto.assigneeId !== undefined) data.assignee = dto.assigneeId ? { connect: { id: dto.assigneeId } } : { disconnect: true };
    return this.prisma.task.update({ where: { id }, data });
  }
  deleteTask(id: string) { return this.prisma.task.delete({ where: { id } }); }

  listTickets(query: ListQueryDto) {
    const { page, limit, skip } = this.page(query); const term = this.term(query);
    const where: Prisma.TicketWhereInput = term ? { OR: [
      { title: { contains: term, mode: "insensitive" } }, { description: { contains: term, mode: "insensitive" } },
    ] } : {};
    return this.paged(
      this.prisma.ticket.findMany({ where, include: {
        customer: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
      }, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.ticket.count({ where }), page, limit,
    );
  }
  async getTicket(id: string) {
    const row = await this.prisma.ticket.findUnique({ where: { id }, include: { customer: true, assignedTo: { select: { id: true, name: true, email: true } } } });
    if (!row) throw new NotFoundException("Ticket not found.");
    return row;
  }
  createTicket(dto: CreateTicketDto, createdById: string) {
    return this.prisma.ticket.create({ data: {
      title: dto.title.trim(), description: dto.description, status: dto.status, priority: dto.priority,
      customerId: dto.customerId ?? null, assignedToId: dto.assignedToId ?? null, createdById,
    } });
  }
  updateTicket(id: string, dto: UpdateTicketDto) {
    const data: Prisma.TicketUpdateInput = {};
    if (dto.title !== undefined) data.title = dto.title.trim();
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.status !== undefined) data.status = dto.status;
    if (dto.priority !== undefined) data.priority = dto.priority;
    if (dto.customerId !== undefined) data.customer = dto.customerId ? { connect: { id: dto.customerId } } : { disconnect: true };
    if (dto.assignedToId !== undefined) data.assignedTo = dto.assignedToId ? { connect: { id: dto.assignedToId } } : { disconnect: true };
    return this.prisma.ticket.update({ where: { id }, data });
  }
  deleteTicket(id: string) { return this.prisma.ticket.delete({ where: { id } }); }

  listOrders(query: ListQueryDto) {
    const { page, limit, skip } = this.page(query); const term = this.term(query);
    const where: Prisma.OrderWhereInput = term ? { OR: [
      { orderNumber: { contains: term, mode: "insensitive" } },
      { customer: { name: { contains: term, mode: "insensitive" } } },
    ] } : {};
    return this.paged(
      this.prisma.order.findMany({ where, include: {
        customer: { select: { id: true, name: true, email: true } },
        items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      }, orderBy: { createdAt: "desc" }, skip, take: limit }),
      this.prisma.order.count({ where }), page, limit,
    );
  }
  async getOrder(id: string) {
    const row = await this.prisma.order.findUnique({ where: { id }, include: {
      customer: true, items: { include: { product: { select: { id: true, name: true, sku: true } } } },
      createdBy: { select: { id: true, name: true, email: true } },
    } });
    if (!row) throw new NotFoundException("Order not found.");
    return row;
  }
  async createOrder(dto: CreateOrderDto, createdById: string) {
    if (dto.items.length === 0) throw new BadRequestException("An order must contain at least one item.");
    const quantities = new Map<string, number>();
    for (const item of dto.items) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
    const mergedItems = [...quantities.entries()].map(([productId, quantity]) => ({ productId, quantity }));

    return this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.findUnique({ where: { id: dto.customerId } });
      if (!customer || customer.status === CustomerStatus.ARCHIVED) {
        throw new BadRequestException("Customer does not exist or is archived.");
      }
      const products = await tx.product.findMany({
        where: { id: { in: mergedItems.map((item) => item.productId) }, status: ProductStatus.ACTIVE },
      });
      if (products.length !== mergedItems.length) throw new BadRequestException("One or more products do not exist or are inactive.");

      let subtotal = new Prisma.Decimal(0);
      const items = mergedItems.map((item) => {
        const product = products.find((candidate) => candidate.id === item.productId);
        if (!product) throw new BadRequestException("Product not found.");
        if (product.stock < item.quantity) throw new BadRequestException("Insufficient stock for product " + product.sku + ".");
        const lineTotal = product.price.mul(item.quantity);
        subtotal = subtotal.add(lineTotal);
        return { ...item, unitPrice: product.price, lineTotal };
      });

      for (const item of items) {
        const updated = await tx.product.updateMany({
          where: { id: item.productId, stock: { gte: item.quantity }, status: ProductStatus.ACTIVE },
          data: { stock: { decrement: item.quantity } },
        });
        if (updated.count !== 1) throw new BadRequestException("Stock changed during checkout; please retry.");
      }

      const tax = new Prisma.Decimal(dto.tax ?? 0);
      return tx.order.create({
        data: {
          orderNumber: "ORD-" + Date.now() + "-" + randomUUID().slice(0, 6).toUpperCase(),
          customerId: dto.customerId, createdById, subtotal, tax, total: subtotal.add(tax),
          items: { create: items },
        },
        include: {
          customer: { select: { id: true, name: true, email: true } },
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
        },
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  async updateOrderStatus(id: string, status: OrderStatus) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id }, include: { items: true } });
      if (!current) throw new NotFoundException("Order not found.");
      if (current.status === status) return current;
      if (current.status === OrderStatus.CANCELLED || current.status === OrderStatus.REFUNDED) {
        throw new BadRequestException("A cancelled or refunded order cannot be changed.");
      }
      if (status === OrderStatus.CANCELLED) {
        for (const item of current.items) {
          await tx.product.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
        }
      }
      return tx.order.update({ where: { id }, data: { status } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }
}
