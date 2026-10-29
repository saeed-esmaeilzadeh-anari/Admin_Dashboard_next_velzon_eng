CREATE TYPE "CmsMediaKind" AS ENUM ('IMAGE','VIDEO','AUDIO','DOCUMENT','OTHER');
CREATE TYPE "CmsFormSubmissionStatus" AS ENUM ('NEW','REVIEWED','RESOLVED','SPAM');
CREATE TYPE "CmsWebhookDeliveryStatus" AS ENUM ('PENDING','SUCCESS','FAILED');

CREATE TABLE "cms_media_assets" (
"id" UUID NOT NULL, "storageKey" TEXT NOT NULL, "originalName" TEXT NOT NULL,
"mimeType" TEXT NOT NULL, "kind" "CmsMediaKind" NOT NULL DEFAULT 'OTHER', "sizeBytes" INTEGER NOT NULL,
"url" TEXT NOT NULL, "altText" TEXT, "caption" TEXT, "uploadedById" UUID,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "cms_media_assets_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "cms_media_assets_storageKey_key" ON "cms_media_assets"("storageKey");
CREATE INDEX "cms_media_assets_kind_createdAt_idx" ON "cms_media_assets"("kind","createdAt");
CREATE INDEX "cms_media_assets_uploadedById_createdAt_idx" ON "cms_media_assets"("uploadedById","createdAt");
ALTER TABLE "cms_media_assets" ADD CONSTRAINT "cms_media_assets_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "cms_taxonomies" (
"id" UUID NOT NULL, "key" TEXT NOT NULL, "name" TEXT NOT NULL, "description" TEXT, "isHierarchical" BOOLEAN NOT NULL DEFAULT true,
"isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "cms_taxonomies_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "cms_taxonomies_key_key" ON "cms_taxonomies"("key");
CREATE INDEX "cms_taxonomies_isActive_name_idx" ON "cms_taxonomies"("isActive","name");

CREATE TABLE "cms_taxonomy_terms" (
"id" UUID NOT NULL, "taxonomyId" UUID NOT NULL, "parentId" UUID, "name" TEXT NOT NULL, "slug" TEXT NOT NULL,
"description" TEXT, "sortOrder" INTEGER NOT NULL DEFAULT 0, "isActive" BOOLEAN NOT NULL DEFAULT true,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "cms_taxonomy_terms_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "cms_taxonomy_terms_taxonomyId_slug_key" ON "cms_taxonomy_terms"("taxonomyId","slug");
CREATE INDEX "cms_taxonomy_terms_taxonomyId_parentId_sortOrder_idx" ON "cms_taxonomy_terms"("taxonomyId","parentId","sortOrder");
CREATE INDEX "cms_taxonomy_terms_isActive_name_idx" ON "cms_taxonomy_terms"("isActive","name");
ALTER TABLE "cms_taxonomy_terms" ADD CONSTRAINT "cms_taxonomy_terms_taxonomyId_fkey" FOREIGN KEY ("taxonomyId") REFERENCES "cms_taxonomies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cms_taxonomy_terms" ADD CONSTRAINT "cms_taxonomy_terms_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "cms_taxonomy_terms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "cms_taxonomy_term_translations" (
"id" UUID NOT NULL,"termId" UUID NOT NULL,"localeId" UUID NOT NULL,"name" TEXT NOT NULL,"slug" TEXT NOT NULL,"description" TEXT,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "cms_taxonomy_term_translations_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "cms_taxonomy_term_translations_termId_localeId_key" ON "cms_taxonomy_term_translations"("termId","localeId");
CREATE UNIQUE INDEX "cms_taxonomy_term_translations_localeId_slug_key" ON "cms_taxonomy_term_translations"("localeId","slug");
CREATE INDEX "cms_taxonomy_term_translations_localeId_name_idx" ON "cms_taxonomy_term_translations"("localeId","name");
ALTER TABLE "cms_taxonomy_term_translations" ADD CONSTRAINT "cms_taxonomy_term_translations_termId_fkey" FOREIGN KEY ("termId") REFERENCES "cms_taxonomy_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cms_taxonomy_term_translations" ADD CONSTRAINT "cms_taxonomy_term_translations_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cms_content_taxonomy_terms" (
"contentId" UUID NOT NULL,"termId" UUID NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "cms_content_taxonomy_terms_pkey" PRIMARY KEY ("contentId","termId"));
CREATE INDEX "cms_content_taxonomy_terms_termId_contentId_idx" ON "cms_content_taxonomy_terms"("termId","contentId");
ALTER TABLE "cms_content_taxonomy_terms" ADD CONSTRAINT "cms_content_taxonomy_terms_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "cms_contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cms_content_taxonomy_terms" ADD CONSTRAINT "cms_content_taxonomy_terms_termId_fkey" FOREIGN KEY ("termId") REFERENCES "cms_taxonomy_terms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cms_menus" (
"id" UUID NOT NULL,"key" TEXT NOT NULL,"name" TEXT NOT NULL,"localeId" UUID NOT NULL,"isActive" BOOLEAN NOT NULL DEFAULT true,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "cms_menus_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "cms_menus_key_localeId_key" ON "cms_menus"("key","localeId");
CREATE INDEX "cms_menus_localeId_isActive_idx" ON "cms_menus"("localeId","isActive");
ALTER TABLE "cms_menus" ADD CONSTRAINT "cms_menus_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "locales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "cms_menu_items" (
"id" UUID NOT NULL,"menuId" UUID NOT NULL,"parentId" UUID,"contentId" UUID,"label" TEXT NOT NULL,"url" TEXT,"targetBlank" BOOLEAN NOT NULL DEFAULT false,
"sortOrder" INTEGER NOT NULL DEFAULT 0,"isActive" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "cms_menu_items_pkey" PRIMARY KEY ("id"));
CREATE INDEX "cms_menu_items_menuId_parentId_sortOrder_idx" ON "cms_menu_items"("menuId","parentId","sortOrder");
CREATE INDEX "cms_menu_items_contentId_idx" ON "cms_menu_items"("contentId");
ALTER TABLE "cms_menu_items" ADD CONSTRAINT "cms_menu_items_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "cms_menus"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cms_menu_items" ADD CONSTRAINT "cms_menu_items_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "cms_menu_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "cms_menu_items" ADD CONSTRAINT "cms_menu_items_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "cms_contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "cms_redirects" (
"id" UUID NOT NULL,"sourcePath" TEXT NOT NULL,"destinationPath" TEXT NOT NULL,"statusCode" INTEGER NOT NULL DEFAULT 301,"isActive" BOOLEAN NOT NULL DEFAULT true,
"hitCount" INTEGER NOT NULL DEFAULT 0,"localeId" UUID,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "cms_redirects_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "cms_redirects_sourcePath_localeId_key" ON "cms_redirects"("sourcePath","localeId");
CREATE INDEX "cms_redirects_isActive_sourcePath_idx" ON "cms_redirects"("isActive","sourcePath");
ALTER TABLE "cms_redirects" ADD CONSTRAINT "cms_redirects_localeId_fkey" FOREIGN KEY ("localeId") REFERENCES "locales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cms_forms" (
"id" UUID NOT NULL,"key" TEXT NOT NULL,"name" TEXT NOT NULL,"description" TEXT,"schema" JSONB NOT NULL DEFAULT '{}'::jsonb,
"successMessage" TEXT,"isActive" BOOLEAN NOT NULL DEFAULT true,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "cms_forms_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "cms_forms_key_key" ON "cms_forms"("key");
CREATE INDEX "cms_forms_isActive_name_idx" ON "cms_forms"("isActive","name");
CREATE TABLE "cms_form_submissions" (
"id" UUID NOT NULL,"formId" UUID NOT NULL,"data" JSONB NOT NULL,"status" "CmsFormSubmissionStatus" NOT NULL DEFAULT 'NEW',"internalNote" TEXT,"processedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "cms_form_submissions_pkey" PRIMARY KEY ("id"));
CREATE INDEX "cms_form_submissions_formId_status_createdAt_idx" ON "cms_form_submissions"("formId","status","createdAt");
ALTER TABLE "cms_form_submissions" ADD CONSTRAINT "cms_form_submissions_formId_fkey" FOREIGN KEY ("formId") REFERENCES "cms_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cms_webhooks" (
"id" UUID NOT NULL,"name" TEXT NOT NULL,"endpointUrl" TEXT NOT NULL,"secret" TEXT NOT NULL,"events" TEXT[] NOT NULL,"isActive" BOOLEAN NOT NULL DEFAULT true,
"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,CONSTRAINT "cms_webhooks_pkey" PRIMARY KEY ("id"));
CREATE INDEX "cms_webhooks_isActive_name_idx" ON "cms_webhooks"("isActive","name");
CREATE TABLE "cms_webhook_deliveries" (
"id" UUID NOT NULL,"webhookId" UUID NOT NULL,"eventKey" TEXT NOT NULL,"payload" JSONB NOT NULL,"status" "CmsWebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
"attempts" INTEGER NOT NULL DEFAULT 0,"responseStatus" INTEGER,"lastError" TEXT,"nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
"deliveredAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "cms_webhook_deliveries_pkey" PRIMARY KEY ("id"));
CREATE INDEX "cms_webhook_deliveries_status_nextAttemptAt_idx" ON "cms_webhook_deliveries"("status","nextAttemptAt");
CREATE INDEX "cms_webhook_deliveries_webhookId_createdAt_idx" ON "cms_webhook_deliveries"("webhookId","createdAt");
ALTER TABLE "cms_webhook_deliveries" ADD CONSTRAINT "cms_webhook_deliveries_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "cms_webhooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "cms_permissions" (
"id" UUID NOT NULL,"code" TEXT NOT NULL,"name" TEXT NOT NULL,"description" TEXT,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL,
CONSTRAINT "cms_permissions_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "cms_permissions_code_key" ON "cms_permissions"("code");
CREATE TABLE "cms_role_permissions" (
"id" UUID NOT NULL,"role" "Role" NOT NULL,"permissionId" UUID NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
CONSTRAINT "cms_role_permissions_pkey" PRIMARY KEY ("id"));
CREATE UNIQUE INDEX "cms_role_permissions_role_permissionId_key" ON "cms_role_permissions"("role","permissionId");
CREATE INDEX "cms_role_permissions_role_idx" ON "cms_role_permissions"("role");
ALTER TABLE "cms_role_permissions" ADD CONSTRAINT "cms_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "cms_permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
