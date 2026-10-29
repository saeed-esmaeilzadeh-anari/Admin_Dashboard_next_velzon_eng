import backendApi from "@/helpers/backendApi";

export type CmsStatus = "DRAFT" | "IN_REVIEW" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type CmsFieldType = "TEXT" | "TEXTAREA" | "RICH_TEXT" | "MARKDOWN" | "INTEGER" | "DECIMAL" | "BOOLEAN" | "DATE" | "DATETIME" | "SELECT" | "MULTISELECT" | "EMAIL" | "URL" | "JSON" | "MEDIA" | "MEDIA_MULTIPLE";
export type CmsLocale = {
  id: string; code: string; name: string; nativeName: string; direction: "LTR" | "RTL";
  isDefault: boolean; isActive: boolean; fallbackLocaleId?: string | null;
};
export type CmsField = {
  id?: string; key: string; label: string; type: CmsFieldType; isRequired: boolean;
  isLocalized: boolean; isActive?: boolean; sortOrder?: number; config?: Record<string, unknown> | null;
};
export type CmsContentType = {
  id: string; key: string; name: string; description?: string | null; isActive: boolean;
  fields: CmsField[]; _count?: { contents: number };
};
export type CmsTranslation = {
  id: string; localeId: string; title: string; slug: string; excerpt?: string | null; data?: Record<string, unknown>;
  seoTitle?: string | null; seoDescription?: string | null; status: CmsStatus; version: number;
  publishedAt?: string | null; scheduledAt?: string | null; publishedSlug?: string | null;
  locale?: CmsLocale; revisions?: Array<{ id: string; version: number; changeNote?: string | null; createdAt: string }>;
};
export type CmsContent = {
  id: string; contentType: Pick<CmsContentType, "id" | "key" | "name"> & { fields?: CmsField[] };
  data: Record<string, unknown>; translations: CmsTranslation[]; createdAt: string; updatedAt: string;
};
export type CmsPage<T> = { data: T[]; pagination: { page: number; limit: number; total: number; pages: number } };

export type CmsMediaKind = "IMAGE" | "VIDEO" | "AUDIO" | "DOCUMENT" | "OTHER";
export type CmsMediaAsset = {
  id: string; storageKey: string; originalName: string; mimeType: string; kind: CmsMediaKind;
  sizeBytes: number; url: string; altText?: string | null; caption?: string | null; createdAt: string;
  uploadedBy?: { id: string; name: string; email: string } | null;
};
export type CmsTaxonomy = { id: string; key: string; name: string; description?: string | null; isHierarchical: boolean; isActive: boolean; _count?: { terms: number } };
export type CmsTaxonomyTerm = {
  id: string; taxonomyId: string; parentId?: string | null; name: string; slug: string; description?: string | null;
  sortOrder: number; isActive: boolean; parent?: { id: string; name: string; slug: string } | null;
  translations?: Array<{ id: string; localeId: string; name: string; slug: string; locale?: CmsLocale }>;
  _count?: { contents: number; children: number };
};
export type CmsMenu = { id: string; key: string; name: string; localeId: string; isActive: boolean; locale?: CmsLocale; _count?: { items: number } };
export type CmsMenuItem = { id: string; menuId: string; parentId?: string | null; contentId?: string | null; label: string; url?: string | null; targetBlank: boolean; sortOrder: number; isActive: boolean };
export type CmsRedirect = { id: string; sourcePath: string; destinationPath: string; statusCode: number; isActive: boolean; hitCount: number; localeId?: string | null; locale?: CmsLocale | null };
export type CmsFormDefinition = { id: string; key: string; name: string; description?: string | null; schema: { fields: Array<Record<string, unknown>>; [key: string]: unknown }; successMessage?: string | null; isActive: boolean; _count?: { submissions: number } };
export type CmsAuditLog = {
  id: string; userId?: string | null; action: string; entity: string; entityId?: string | null;
  metadata?: Record<string, unknown> | null; createdAt: string;
  user?: { id: string; name: string; email: string; role: string } | null;
};
export type CmsWebhook = { id: string; name: string; endpointUrl: string; events: string[]; isActive: boolean; createdAt: string; _count?: { deliveries: number } };
export type CmsWebhookDelivery = { id: string; eventKey: string; status: "PENDING" | "PROCESSING" | "SUCCESS" | "FAILED"; attempts: number; responseStatus?: number | null; lastError?: string | null; nextAttemptAt: string; deliveredAt?: string | null; createdAt: string };
export type CmsPermissionState = { code: string; name: string; description: string; grantedRoles: Array<"ADMIN" | "MANAGER" | "USER"> };

export const cmsApi = {
  async locales(includeInactive = true): Promise<CmsLocale[]> {
    return (await backendApi.get<CmsLocale[]>("/cms/locales", { params: { includeInactive } })).data;
  },
  async createLocale(input: Partial<CmsLocale> & Pick<CmsLocale, "code" | "name" | "nativeName">): Promise<CmsLocale> {
    return (await backendApi.post<CmsLocale>("/cms/locales", input)).data;
  },
  async updateLocale(id: string, input: Partial<CmsLocale>): Promise<CmsLocale> {
    return (await backendApi.patch<CmsLocale>(`/cms/locales/${id}`, input)).data;
  },
  async contentTypes(includeInactive = true): Promise<CmsContentType[]> {
    return (await backendApi.get<CmsContentType[]>("/cms/content-types", { params: { includeInactive } })).data;
  },
  async createContentType(input: { key: string; name: string; description?: string; fields: Array<Omit<CmsField, "id" | "isActive">> }): Promise<CmsContentType> {
    return (await backendApi.post<CmsContentType>("/cms/content-types", input)).data;
  },
  async updateContentType(id: string, input: Partial<Pick<CmsContentType, "name" | "description" | "isActive">>): Promise<CmsContentType> {
    return (await backendApi.patch<CmsContentType>(`/cms/content-types/${id}`, input)).data;
  },
  async addField(typeId: string, input: Omit<CmsField, "id" | "isActive">): Promise<CmsField> {
    return (await backendApi.post<CmsField>(`/cms/content-types/${typeId}/fields`, input)).data;
  },
  async updateField(typeId: string, fieldId: string, input: Partial<CmsField>): Promise<CmsField> {
    return (await backendApi.patch<CmsField>(`/cms/content-types/${typeId}/fields/${fieldId}`, input)).data;
  },
  async contents(params: { page?: number; limit?: number; typeKey?: string; localeCode?: string; status?: CmsStatus; search?: string } = {}): Promise<CmsPage<CmsContent>> {
    return (await backendApi.get<CmsPage<CmsContent>>("/cms/contents", { params })).data;
  },
  async content(id: string): Promise<CmsContent> {
    return (await backendApi.get<CmsContent>(`/cms/contents/${id}`)).data;
  },
  async createContent(input: { typeKey: string; localeCode: string; title: string; slug: string; excerpt?: string; seoTitle?: string; seoDescription?: string; fields: Record<string, unknown> }): Promise<CmsContent> {
    return (await backendApi.post<CmsContent>("/cms/contents", input)).data;
  },
  async createTranslation(id: string, input: { localeCode: string; title: string; slug: string; excerpt?: string; seoTitle?: string; seoDescription?: string; fields: Record<string, unknown> }): Promise<CmsContent> {
    return (await backendApi.post<CmsContent>(`/cms/contents/${id}/translations`, input)).data;
  },
  async updateTranslation(id: string, localeCode: string, input: Partial<{ title: string; slug: string; excerpt: string; seoTitle: string; seoDescription: string; fields: Record<string, unknown> }>): Promise<CmsContent> {
    return (await backendApi.patch<CmsContent>(`/cms/contents/${id}/translations/${encodeURIComponent(localeCode)}`, input)).data;
  },
  async updateSharedFields(id: string, fields: Record<string, unknown>): Promise<CmsContent> {
    return (await backendApi.patch<CmsContent>(`/cms/contents/${id}/shared-fields`, { fields })).data;
  },
  async workflow(id: string, localeCode: string, action: "submit" | "publish" | "reject" | "schedule" | "unpublish" | "archive" | "restore-to-draft", body?: Record<string, unknown>): Promise<CmsContent> {
    return (await backendApi.post<CmsContent>(`/cms/contents/${id}/translations/${encodeURIComponent(localeCode)}/${action}`, body ?? {})).data;
  },
  async revisions(id: string, localeCode: string): Promise<NonNullable<CmsTranslation["revisions"]>> {
    return (await backendApi.get<NonNullable<CmsTranslation["revisions"]>>(`/cms/contents/${id}/translations/${encodeURIComponent(localeCode)}/revisions`)).data;
  },
  async restoreRevision(id: string, localeCode: string, revisionId: string): Promise<CmsContent> {
    return (await backendApi.post<CmsContent>(`/cms/contents/${id}/translations/${encodeURIComponent(localeCode)}/revisions/${revisionId}/restore`)).data;
  },

  async media(params: { page?: number; limit?: number; kind?: CmsMediaKind; search?: string } = {}): Promise<CmsPage<CmsMediaAsset>> {
    return (await backendApi.get<CmsPage<CmsMediaAsset>>("/cms/media", { params })).data;
  },
  async uploadMedia(file: File, altText = "", caption = ""): Promise<CmsMediaAsset> {
    const form = new FormData();
    form.append("file", file);
    if (altText) form.append("altText", altText);
    if (caption) form.append("caption", caption);
    return (await backendApi.post<CmsMediaAsset>("/cms/media", form, { headers: { "Content-Type": "multipart/form-data" } })).data;
  },
  async updateMedia(id: string, input: { altText?: string | null; caption?: string | null }): Promise<CmsMediaAsset> {
    return (await backendApi.patch<CmsMediaAsset>(`/cms/media/${id}`, input)).data;
  },
  async deleteMedia(id: string): Promise<{ id: string; deleted: boolean; fileRemoved: boolean }> {
    return (await backendApi.delete<{ id: string; deleted: boolean; fileRemoved: boolean }>(`/cms/media/${id}`)).data;
  },
  async taxonomies(): Promise<CmsTaxonomy[]> {
    return (await backendApi.get<CmsTaxonomy[]>("/cms/taxonomies")).data;
  },
  async createTaxonomy(input: { key: string; name: string; description?: string; isHierarchical?: boolean }): Promise<CmsTaxonomy> {
    return (await backendApi.post<CmsTaxonomy>("/cms/taxonomies", input)).data;
  },
  async updateTaxonomy(id: string, input: Partial<Pick<CmsTaxonomy, "name" | "description" | "isHierarchical" | "isActive">>): Promise<CmsTaxonomy> {
    return (await backendApi.patch<CmsTaxonomy>(`/cms/taxonomies/${id}`, input)).data;
  },
  async taxonomyTerms(taxonomyId: string): Promise<CmsTaxonomyTerm[]> {
    return (await backendApi.get<CmsTaxonomyTerm[]>(`/cms/taxonomies/${taxonomyId}/terms`)).data;
  },
  async createTaxonomyTerm(taxonomyId: string, input: { name: string; slug: string; description?: string; parentId?: string | null; sortOrder?: number }): Promise<CmsTaxonomyTerm> {
    return (await backendApi.post<CmsTaxonomyTerm>(`/cms/taxonomies/${taxonomyId}/terms`, input)).data;
  },
  async updateTaxonomyTerm(taxonomyId: string, termId: string, input: Partial<CmsTaxonomyTerm>): Promise<CmsTaxonomyTerm> {
    return (await backendApi.patch<CmsTaxonomyTerm>(`/cms/taxonomies/${taxonomyId}/terms/${termId}`, input)).data;
  },
  async translateTaxonomyTerm(termId: string, input: { localeCode: string; name: string; slug: string; description?: string }): Promise<CmsTaxonomyTerm> {
    return (await backendApi.post<CmsTaxonomyTerm>(`/cms/taxonomy-terms/${termId}/translations`, input)).data;
  },
  async assignContentTerms(contentId: string, termIds: string[]): Promise<Array<{ contentId: string; termId: string; term: CmsTaxonomyTerm }>> {
    return (await backendApi.put<Array<{ contentId: string; termId: string; term: CmsTaxonomyTerm }>>(`/cms/contents/${contentId}/terms`, { termIds })).data;
  },
  async menus(): Promise<CmsMenu[]> {
    return (await backendApi.get<CmsMenu[]>("/cms/menus")).data;
  },
  async createMenu(input: { key: string; name: string; localeCode: string }): Promise<CmsMenu> {
    return (await backendApi.post<CmsMenu>("/cms/menus", input)).data;
  },
  async updateMenu(id: string, input: Partial<Pick<CmsMenu, "name" | "isActive">>): Promise<CmsMenu> {
    return (await backendApi.patch<CmsMenu>(`/cms/menus/${id}`, input)).data;
  },
  async menuItems(menuId: string): Promise<CmsMenuItem[]> {
    return (await backendApi.get<CmsMenuItem[]>(`/cms/menus/${menuId}/items`)).data;
  },
  async createMenuItem(menuId: string, input: Partial<CmsMenuItem> & Pick<CmsMenuItem, "label">): Promise<CmsMenuItem> {
    return (await backendApi.post<CmsMenuItem>(`/cms/menus/${menuId}/items`, input)).data;
  },
  async updateMenuItem(menuId: string, itemId: string, input: Partial<CmsMenuItem>): Promise<CmsMenuItem> {
    return (await backendApi.patch<CmsMenuItem>(`/cms/menus/${menuId}/items/${itemId}`, input)).data;
  },
  async deleteMenuItem(menuId: string, itemId: string): Promise<{ id: string; deleted: boolean }> {
    return (await backendApi.delete<{ id: string; deleted: boolean }>(`/cms/menus/${menuId}/items/${itemId}`)).data;
  },
  async redirects(): Promise<CmsRedirect[]> {
    return (await backendApi.get<CmsRedirect[]>("/cms/redirects")).data;
  },
  async createRedirect(input: { sourcePath: string; destinationPath: string; statusCode?: number; localeCode?: string | null }): Promise<CmsRedirect> {
    return (await backendApi.post<CmsRedirect>("/cms/redirects", input)).data;
  },
  async updateRedirect(id: string, input: Partial<CmsRedirect> & { localeCode?: string | null }): Promise<CmsRedirect> {
    return (await backendApi.patch<CmsRedirect>(`/cms/redirects/${id}`, input)).data;
  },
  async resolveRedirect(path: string, localeCode?: string): Promise<{ destinationPath: string; statusCode: number }> {
    return (await backendApi.get<{ destinationPath: string; statusCode: number }>("/public/cms/redirects/resolve", { params: { path, localeCode } })).data;
  },
  async forms(): Promise<CmsFormDefinition[]> {
    return (await backendApi.get<CmsFormDefinition[]>("/cms/forms")).data;
  },
  async createForm(input: { key: string; name: string; description?: string; schema: CmsFormDefinition["schema"]; successMessage?: string }): Promise<CmsFormDefinition> {
    return (await backendApi.post<CmsFormDefinition>("/cms/forms", input)).data;
  },
  async updateForm(id: string, input: Partial<Pick<CmsFormDefinition, "name" | "description" | "schema" | "successMessage" | "isActive">>): Promise<CmsFormDefinition> {
    return (await backendApi.patch<CmsFormDefinition>(`/cms/forms/${id}`, input)).data;
  },
  async formSubmissions(formId: string, params: { page?: number; limit?: number; status?: string } = {}): Promise<CmsPage<Record<string, unknown>>> {
    return (await backendApi.get<CmsPage<Record<string, unknown>>>(`/cms/forms/${formId}/submissions`, { params })).data;
  },
  async updateFormSubmission(formId: string, submissionId: string, input: { status: "NEW" | "REVIEWED" | "RESOLVED" | "SPAM"; internalNote?: string | null }): Promise<Record<string, unknown>> {
    return (await backendApi.patch<Record<string, unknown>>(`/cms/forms/${formId}/submissions/${submissionId}`, input)).data;
  },
  async publicForm(key: string): Promise<{ key: string; name: string; description?: string | null; schema: CmsFormDefinition["schema"]; successMessage?: string | null }> {
    return (await backendApi.get(`/public/cms/forms/${key}`)).data;
  },
  async submitPublicForm(key: string, data: Record<string, unknown>): Promise<{ id: string; status: string; createdAt: string; message: string }> {
    return (await backendApi.post(`/public/cms/forms/${key}/submissions`, { data })).data;
  },
  async webhooks(): Promise<CmsWebhook[]> {
    return (await backendApi.get<CmsWebhook[]>("/cms/webhooks")).data;
  },
  async createWebhook(input: { name: string; endpointUrl: string; secret: string; events: string[] }): Promise<CmsWebhook> {
    return (await backendApi.post<CmsWebhook>("/cms/webhooks", input)).data;
  },
  async updateWebhook(id: string, input: Partial<{ name: string; endpointUrl: string; secret: string; events: string[]; isActive: boolean }>): Promise<CmsWebhook> {
    return (await backendApi.patch<CmsWebhook>(`/cms/webhooks/${id}`, input)).data;
  },
  async deleteWebhook(id: string): Promise<{ id: string; deleted: boolean }> {
    return (await backendApi.delete<{ id: string; deleted: boolean }>(`/cms/webhooks/${id}`)).data;
  },
  async webhookDeliveries(id: string, params: { page?: number; limit?: number } = {}): Promise<CmsPage<CmsWebhookDelivery>> {
    return (await backendApi.get<CmsPage<CmsWebhookDelivery>>(`/cms/webhooks/${id}/deliveries`, { params })).data;
  },
  async retryWebhookDelivery(id: string, deliveryId: string): Promise<CmsWebhookDelivery> {
    return (await backendApi.post<CmsWebhookDelivery>(`/cms/webhooks/${id}/deliveries/${deliveryId}/retry`)).data;
  },
  async auditLogs(params: { page?: number; limit?: number; action?: string; entity?: string; search?: string } = {}): Promise<CmsPage<CmsAuditLog>> {
    return (await backendApi.get<CmsPage<CmsAuditLog>>("/cms/audit-logs", { params })).data;
  },
  async permissions(): Promise<{ catalog: CmsPermissionState[]; roles: Array<{ role: "ADMIN" | "MANAGER" | "USER"; permissionCodes: string[] }> }> {
    return (await backendApi.get("/cms/permissions")).data;
  },
  async updateRolePermissions(role: "MANAGER" | "USER", permissionCodes: string[]): Promise<{ role: string; permissionCodes: string[] }> {
    return (await backendApi.put("/cms/permissions/roles", { role, permissionCodes })).data;
  },
};
