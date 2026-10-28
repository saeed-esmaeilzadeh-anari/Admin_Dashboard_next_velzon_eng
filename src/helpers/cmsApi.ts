import backendApi from "@/helpers/backendApi";

export type CmsStatus = "DRAFT" | "IN_REVIEW" | "SCHEDULED" | "PUBLISHED" | "ARCHIVED";
export type CmsFieldType = "TEXT" | "TEXTAREA" | "RICH_TEXT" | "MARKDOWN" | "INTEGER" | "DECIMAL" | "BOOLEAN" | "DATE" | "DATETIME" | "SELECT" | "MULTISELECT" | "EMAIL" | "URL" | "JSON";
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
  id: string; localeId: string; title: string; slug: string; excerpt?: string | null;
  seoTitle?: string | null; seoDescription?: string | null; status: CmsStatus; version: number;
  publishedAt?: string | null; scheduledAt?: string | null; publishedSlug?: string | null;
  locale?: CmsLocale; revisions?: Array<{ id: string; version: number; changeNote?: string | null; createdAt: string }>;
};
export type CmsContent = {
  id: string; contentType: Pick<CmsContentType, "id" | "key" | "name">;
  data: Record<string, unknown>; translations: CmsTranslation[]; createdAt: string; updatedAt: string;
};
export type CmsPage<T> = { data: T[]; pagination: { page: number; limit: number; total: number; pages: number } };

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
};
