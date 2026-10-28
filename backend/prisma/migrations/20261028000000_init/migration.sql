CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'USER');
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL', 'WON', 'LOST');
CREATE TYPE "ProjectStatus" AS ENUM ('PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');
CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'WAITING', 'RESOLVED', 'CLOSED');
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'COMPLETED', 'CANCELLED', 'REFUNDED');

CREATE TABLE "users" ("id" UUID NOT NULL, "name" TEXT NOT NULL, "email" TEXT NOT NULL, "passwordHash" TEXT NOT NULL, "role" "Role" NOT NULL DEFAULT 'USER', "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "users_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "users_role_isActive_idx" ON "users"("role", "isActive");

CREATE TABLE "categories" ("id" UUID NOT NULL, "name" TEXT NOT NULL, "slug" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "categories_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

CREATE TABLE "products" ("id" UUID NOT NULL, "name" TEXT NOT NULL, "sku" TEXT NOT NULL, "description" TEXT, "price" DECIMAL(12,2) NOT NULL, "stock" INTEGER NOT NULL DEFAULT 0, "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE', "categoryId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "products_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
CREATE INDEX "products_status_createdAt_idx" ON "products"("status", "createdAt");
CREATE INDEX "products_categoryId_idx" ON "products"("categoryId");

CREATE TABLE "customers" ("id" UUID NOT NULL, "name" TEXT NOT NULL, "email" TEXT, "phone" TEXT, "company" TEXT, "notes" TEXT, "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "customers_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "customers_email_key" ON "customers"("email");
CREATE INDEX "customers_status_createdAt_idx" ON "customers"("status", "createdAt");

CREATE TABLE "orders" ("id" UUID NOT NULL, "orderNumber" TEXT NOT NULL, "status" "OrderStatus" NOT NULL DEFAULT 'PENDING', "customerId" UUID NOT NULL, "createdById" UUID, "subtotal" DECIMAL(12,2) NOT NULL, "tax" DECIMAL(12,2) NOT NULL DEFAULT 0, "total" DECIMAL(12,2) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "orders_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");
CREATE INDEX "orders_status_createdAt_idx" ON "orders"("status", "createdAt");
CREATE INDEX "orders_customerId_idx" ON "orders"("customerId");

CREATE TABLE "order_items" ("id" UUID NOT NULL, "orderId" UUID NOT NULL, "productId" UUID NOT NULL, "quantity" INTEGER NOT NULL, "unitPrice" DECIMAL(12,2) NOT NULL, "lineTotal" DECIMAL(12,2) NOT NULL, CONSTRAINT "order_items_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "order_items_orderId_productId_key" ON "order_items"("orderId", "productId");
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

CREATE TABLE "leads" ("id" UUID NOT NULL, "name" TEXT NOT NULL, "email" TEXT, "phone" TEXT, "company" TEXT, "source" TEXT, "status" "LeadStatus" NOT NULL DEFAULT 'NEW', "notes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "leads_pkey" PRIMARY KEY ("id"));
CREATE INDEX "leads_status_createdAt_idx" ON "leads"("status", "createdAt");
CREATE INDEX "leads_email_idx" ON "leads"("email");

CREATE TABLE "projects" ("id" UUID NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "status" "ProjectStatus" NOT NULL DEFAULT 'PLANNING', "startDate" TIMESTAMP(3), "dueDate" TIMESTAMP(3), "ownerId" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "projects_pkey" PRIMARY KEY ("id"));
CREATE INDEX "projects_status_dueDate_idx" ON "projects"("status", "dueDate");
CREATE INDEX "projects_ownerId_idx" ON "projects"("ownerId");

CREATE TABLE "tasks" ("id" UUID NOT NULL, "title" TEXT NOT NULL, "description" TEXT, "status" "TaskStatus" NOT NULL DEFAULT 'TODO', "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM', "dueDate" TIMESTAMP(3), "projectId" UUID, "assigneeId" UUID, "createdById" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "tasks_pkey" PRIMARY KEY ("id"));
CREATE INDEX "tasks_status_priority_dueDate_idx" ON "tasks"("status", "priority", "dueDate");
CREATE INDEX "tasks_projectId_idx" ON "tasks"("projectId");
CREATE INDEX "tasks_assigneeId_idx" ON "tasks"("assigneeId");

CREATE TABLE "tickets" ("id" UUID NOT NULL, "title" TEXT NOT NULL, "description" TEXT NOT NULL, "status" "TicketStatus" NOT NULL DEFAULT 'OPEN', "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM', "customerId" UUID, "assignedToId" UUID, "createdById" UUID, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, CONSTRAINT "tickets_pkey" PRIMARY KEY ("id"));
CREATE INDEX "tickets_status_priority_createdAt_idx" ON "tickets"("status", "priority", "createdAt");
CREATE INDEX "tickets_customerId_idx" ON "tickets"("customerId");

CREATE TABLE "audit_logs" ("id" UUID NOT NULL, "userId" UUID, "action" TEXT NOT NULL, "entity" TEXT NOT NULL, "entityId" TEXT, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id"));
CREATE INDEX "audit_logs_entity_entityId_createdAt_idx" ON "audit_logs"("entity", "entityId", "createdAt");
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "orders" ADD CONSTRAINT "orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
