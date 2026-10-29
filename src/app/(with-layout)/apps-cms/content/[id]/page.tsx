"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row, Spinner } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsContent, CmsField, CmsLocale, CmsMediaAsset, CmsStatus, CmsTranslation } from "@/helpers/cmsApi";
import PageBuilderField from "@/components/Cms/PageBuilderField";

function messageFrom(error: unknown): string {
  const value = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message) ? message.join(", ") : message ?? "Unable to complete the request.";
}
function inputValue(field: CmsField, value: unknown): unknown {
  if (field.key === "blocks") {
    if (Array.isArray(value)) return value;
    if (typeof value === "string") { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
    return [];
  }
  if (value === undefined || value === null) return field.type === "BOOLEAN" ? false : field.type === "MULTISELECT" || field.type === "MEDIA_MULTIPLE" ? [] : "";
  if (field.type === "JSON" && typeof value !== "string") return JSON.stringify(value, null, 2);
  return value;
}
function prepareValue(field: CmsField, value: unknown): unknown {
  if (field.type === "INTEGER" && value !== "") return Number(value);
  if (field.type === "DECIMAL" && value !== "") return Number(value);
  if (field.type === "JSON" && typeof value === "string" && value.trim()) return JSON.parse(value);
  return value;
}
type CmsInputType = "number" | "date" | "datetime-local" | "email" | "url" | "text";
function inputType(field: CmsField): CmsInputType {
  if (field.type === "INTEGER" || field.type === "DECIMAL") return "number";
  if (field.type === "DATE") return "date";
  if (field.type === "DATETIME") return "datetime-local";
  if (field.type === "EMAIL") return "email";
  if (field.type === "URL") return "url";
  return "text";
}

export default function CmsContentEditorPage() {
  const { t, i18n } = useTranslation();
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const contentId = params.id;
  const [content, setContent] = useState<CmsContent | null>(null);
  const [locales, setLocales] = useState<CmsLocale[]>([]);
  const [localeCode, setLocaleCode] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [localizedValues, setLocalizedValues] = useState<Record<string, unknown>>({});
  const [sharedValues, setSharedValues] = useState<Record<string, unknown>>({});
  const [mediaAssets, setMediaAssets] = useState<CmsMediaAsset[]>([]);
  const [revisions, setRevisions] = useState<NonNullable<CmsTranslation["revisions"]>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const localesByCode = useMemo(() => new Map(locales.map(locale => [locale.code, locale])), [locales]);
  const selectedTranslation = useMemo(() => content?.translations.find(translation => translation.locale?.code === localeCode) ?? null, [content, localeCode]);
  const isNewTranslation = Boolean(content && localeCode && !selectedTranslation);
  const fields = content?.contentType.fields ?? [];
  const localizedDefinitions = useMemo(() => fields.filter(field => field.isLocalized && field.isActive !== false), [fields]);
  const sharedDefinitions = useMemo(() => fields.filter(field => !field.isLocalized && field.isActive !== false), [fields]);

  const reload = useCallback(async (keepMessage = true) => {
    if (!keepMessage) setNotice("");
    setLoading(true);
    setError("");
    try {
      const [nextContent, nextLocales, mediaPage] = await Promise.all([cmsApi.content(contentId), cmsApi.locales(true), cmsApi.media({page:1,limit:100})]);
      setContent(nextContent);
      setLocales(nextLocales.filter(locale => locale.isActive));
      setMediaAssets(mediaPage.data);
      setLocaleCode(current => current || searchParams.get("localeCode") || nextContent.translations[0]?.locale?.code || nextLocales.find(locale => locale.isDefault && locale.isActive)?.code || "");
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setLoading(false);
    }
  }, [contentId, searchParams]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    if (!content || !localeCode) return;
    const translation = content.translations.find(item => item.locale?.code === localeCode);
    setTitle(translation?.title ?? "");
    setSlug(translation?.slug ?? "");
    setExcerpt(translation?.excerpt ?? "");
    setSeoTitle(translation?.seoTitle ?? "");
    setSeoDescription(translation?.seoDescription ?? "");
    const localValues: Record<string, unknown> = {};
    for (const field of localizedDefinitions) localValues[field.key] = inputValue(field, translation?.data?.[field.key]);
    setLocalizedValues(localValues);
    const shared: Record<string, unknown> = {};
    for (const field of sharedDefinitions) shared[field.key] = inputValue(field, content.data?.[field.key]);
    setSharedValues(shared);
    setError("");
  }, [content?.id, localeCode, localizedDefinitions, sharedDefinitions]);

  useEffect(() => {
    if (!content || !localeCode || !selectedTranslation) { setRevisions([]); return; }
    let active = true;
    cmsApi.revisions(content.id, localeCode).then(data => { if (active) setRevisions(data); }).catch(() => { if (active) setRevisions([]); });
    return () => { active = false; };
  }, [content?.id, localeCode, selectedTranslation?.id, selectedTranslation?.version]);

  const setDynamicValue = (field: CmsField, value: unknown) => {
    const setValues = field.isLocalized ? setLocalizedValues : setSharedValues;
    setValues(current => ({ ...current, [field.key]: value }));
  };

  const renderField = (field: CmsField, values: Record<string, unknown>) => {
    const value = values[field.key];
    const options = Array.isArray(field.config?.options) ? field.config.options as Array<string | { value: string; label?: string }> : [];
    const choices = options.map(option => typeof option === "string" ? { value: option, label: option } : { value: option.value, label: option.label ?? option.value });
    return <Col md={field.type === "TEXTAREA" || field.type === "RICH_TEXT" || field.type === "MARKDOWN" || field.type === "JSON" ? 12 : 6} key={field.key}>
      <div className="mb-3">
        <Label for={`field-${field.key}`}>{field.label}{field.isRequired ? <span className="text-danger ms-1">*</span> : null}</Label>
        {field.type === "BOOLEAN" ? <div className="form-check form-switch mt-2"><Input className="form-check-input" type="switch" id={`field-${field.key}`} checked={Boolean(value)} onChange={event => setDynamicValue(field, event.target.checked)} /><Label className="form-check-label" for={`field-${field.key}`}>{t("Enabled")}</Label></div>
          : field.type === "SELECT" ? <Input id={`field-${field.key}`} type="select" value={String(value ?? "")} onChange={event => setDynamicValue(field, event.target.value)}><option value="">{t("Select an option")}</option>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</Input>
          : field.type === "MULTISELECT" ? <Input id={`field-${field.key}`} type="select" multiple value={Array.isArray(value) ? value.map(String) : []} onChange={event => setDynamicValue(field, Array.from((event.currentTarget as unknown as HTMLSelectElement).selectedOptions).map(option => option.value))}>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</Input>
          : field.type === "MEDIA" ? <Input id={`field-${field.key}`} type="select" value={String(value ?? "")} onChange={event => setDynamicValue(field, event.target.value)}><option value="">{t("Choose media")}</option>{mediaAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.originalName} · {asset.kind}</option>)}</Input>
          : field.type === "MEDIA_MULTIPLE" ? <Input id={`field-${field.key}`} type="select" multiple value={Array.isArray(value) ? value.map(String) : []} onChange={event => setDynamicValue(field, Array.from((event.currentTarget as unknown as HTMLSelectElement).selectedOptions).map(option => option.value))}>{mediaAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.originalName} · {asset.kind}</option>)}</Input>
          : field.key === "blocks" && field.type === "JSON" ? <PageBuilderField value={value} onChange={next => setDynamicValue(field,next)} mediaAssets={mediaAssets} />
          : field.type === "TEXTAREA" || field.type === "RICH_TEXT" || field.type === "MARKDOWN" || field.type === "JSON" ? <Input id={`field-${field.key}`} type="textarea" rows={field.type === "JSON" ? 5 : 4} value={typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2)} onChange={event => setDynamicValue(field, event.target.value)} placeholder={field.type === "JSON" ? '{"key":"value"}' : field.type === "MARKDOWN" ? "## Heading" : field.type === "RICH_TEXT" ? t("Rich text or HTML content; sanitize before public rendering") : ""} />
          : <Input id={`field-${field.key}`} type={inputType(field)} value={value == null ? "" : String(value)} step={field.type === "DECIMAL" ? "any" : field.type === "INTEGER" ? "1" : undefined} onChange={event => setDynamicValue(field, event.target.value)} />}
      </div>
    </Col>;
  };

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content || !localeCode) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const localizedFields: Record<string, unknown> = {};
      for (const field of localizedDefinitions) {
        const value = localizedValues[field.key];
        if (value === "" && !field.isRequired) continue;
        if (field.isRequired && (value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0))) {
          throw new Error(`${field.label}: ${t("Required field is missing")}`);
        }
        localizedFields[field.key] = prepareValue(field, value);
      }
      const scalar = { title: title.trim(), slug: slug.trim(), excerpt: excerpt.trim(), seoTitle: seoTitle.trim(), seoDescription: seoDescription.trim() };
      if (!scalar.title || !scalar.slug) throw new Error(t("Title and slug are required"));
      if (isNewTranslation) {
        await cmsApi.createTranslation(content.id, { localeCode, ...scalar, fields: localizedFields });
      } else {
        await cmsApi.updateTranslation(content.id, localeCode, { ...scalar, fields: localizedFields });
        const sharedFields: Record<string, unknown> = {};
        for (const field of sharedDefinitions) {
          const value = sharedValues[field.key];
          if (value === "" && !field.isRequired) continue;
          if (field.isRequired && (value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0))) {
            throw new Error(`${field.label}: ${t("Required field is missing")}`);
          }
          sharedFields[field.key] = prepareValue(field, value);
        }
        if (Object.keys(sharedFields).length) await cmsApi.updateSharedFields(content.id, sharedFields);
      }
      setNotice(t("Changes saved"));
      const updated = await cmsApi.content(content.id);
      setContent(updated);
      router.replace(`/apps-cms/content/${content.id}?localeCode=${encodeURIComponent(localeCode)}`);
    } catch (cause) {
      setError(messageFrom(cause));
    } finally {
      setSaving(false);
    }
  };

  const workflow = async (action: "submit" | "publish" | "reject" | "schedule" | "unpublish" | "archive" | "restore-to-draft") => {
    if (!content || !localeCode) return;
    let body: Record<string, unknown> | undefined;
    if (action === "reject") {
      const reason = window.prompt(t("Enter rejection reason"));
      if (!reason?.trim()) return;
      body = { reason: reason.trim() };
    }
    if (action === "schedule") {
      const date = window.prompt(t("Enter publication time in ISO format"), new Date(Date.now() + 3600000).toISOString());
      if (!date) return;
      body = { scheduledAt: date };
    }
    setBusyAction(action); setError(""); setNotice("");
    try {
      await cmsApi.workflow(content.id, localeCode, action, body);
      setNotice(t("Operation completed successfully"));
      const next = await cmsApi.content(content.id);
      setContent(next);
    } catch (cause) { setError(messageFrom(cause)); }
    finally { setBusyAction(""); }
  };

  const restoreRevision = async (revisionId: string) => {
    if (!content || !localeCode || !window.confirm(t("Restore this revision as a new draft?"))) return;
    setBusyAction("revision"); setError(""); setNotice("");
    try {
      const next = await cmsApi.restoreRevision(content.id, localeCode, revisionId);
      setContent(next); setNotice(t("Revision restored as a new draft"));
    } catch (cause) { setError(messageFrom(cause)); }
    finally { setBusyAction(""); }
  };

  const selectedLocale = localesByCode.get(localeCode);
  const workflowActions: Array<{ action: "submit" | "publish" | "reject" | "schedule" | "unpublish" | "archive" | "restore-to-draft"; label: string; color: string }> = selectedTranslation ? (
    selectedTranslation.status === "DRAFT" ? [{ action: "submit", label: "Submit for review", color: "info" }, ...(selectedTranslation.publishedSlug ? [{ action: "unpublish" as const, label: "Unpublish live copy", color: "warning" }] : []), { action: "archive", label: "Archive", color: "danger" }] :
    selectedTranslation.status === "IN_REVIEW" ? [{ action: "publish", label: "Publish", color: "success" }, { action: "schedule", label: "Schedule publication", color: "primary" }, { action: "reject", label: "Reject", color: "warning" }, { action: "archive", label: "Archive", color: "danger" }] :
    selectedTranslation.status === "SCHEDULED" ? [{ action: "unpublish", label: "Cancel scheduled/live publication", color: "warning" }] :
    selectedTranslation.status === "PUBLISHED" ? [{ action: "unpublish", label: "Unpublish", color: "warning" }, { action: "archive", label: "Archive", color: "danger" }] :
    [{ action: "restore-to-draft", label: "Restore to draft", color: "secondary" }]
  ) : [];

  return <div className="page-content" dir={i18n.language === "fa" || i18n.language === "ar" ? "rtl" : "ltr"}>
    <Container fluid>
      <Row className="align-items-center mb-4">
        <Col><h4 className="mb-1">{isNewTranslation ? t("Add translation") : t("Edit content")}</h4><p className="text-muted mb-0">{content?.contentType.name ?? t("Content")}</p></Col>
        <Col xs="auto" className="d-flex gap-2"><Link className="btn btn-light" href="/apps-cms/content">{t("Back to content")}</Link><Button color="light" onClick={() => void reload()} disabled={loading}><i className="ri-refresh-line me-1" />{t("Refresh")}</Button></Col>
      </Row>
      {error && <Alert color="danger" toggle={() => setError("")}>{error}</Alert>}
      {notice && <Alert color="success" toggle={() => setNotice("")}>{notice}</Alert>}
      {loading || !content ? <div className="text-center py-5"><Spinner /> {t("Loading")}</div> : <>
        <Card>
          <CardBody>
            <Row className="align-items-end g-3">
              <Col md={5}><Label>{t("Edit language version")}</Label><Input type="select" value={localeCode} onChange={event => { const next = event.target.value; setLocaleCode(next); router.replace(`/apps-cms/content/${content.id}?localeCode=${encodeURIComponent(next)}`); }}>{locales.map(locale => <option key={locale.id} value={locale.code}>{locale.nativeName} ({locale.code}){content.translations.some(item => item.locale?.code === locale.code) ? ` — ${t("Translation exists")}` : ` — ${t("Add translation")}`}</option>)}</Input></Col>
              <Col md={3}>{selectedTranslation && <div><div className="text-muted small">{t("Status")}</div><Badge color={selectedTranslation.status === "PUBLISHED" ? "success" : selectedTranslation.status === "IN_REVIEW" ? "warning" : "secondary"}>{t(selectedTranslation.status.replace("_", " "))}</Badge><span className="ms-2 text-muted small">{t("Version")} {selectedTranslation.version}</span></div>}</Col>
              <Col md={4} className="text-md-end">{selectedTranslation?.publishedSlug && <div className="small text-muted">{t("Current live slug")}: <code>{selectedTranslation.publishedSlug}</code></div>}</Col>
            </Row>
          </CardBody>
        </Card>
        <Form onSubmit={save}>
          <Row>
            <Col xl={8}>
              <Card>
                <CardHeader><h5 className="card-title mb-0">{t("Content details")}</h5></CardHeader>
                <CardBody><Row className="g-3">
                  <Col md={12}><Label>{t("Title")} *</Label><Input value={title} maxLength={300} required onChange={event => setTitle(event.target.value)} /></Col>
                  <Col md={12}><Label>{t("Slug")} *</Label><Input value={slug} maxLength={180} required onChange={event => setSlug(event.target.value)} /><small className="text-muted">{t("Slug is unique within its language")}</small></Col>
                  <Col md={12}><Label>{t("Excerpt")}</Label><Input type="textarea" rows={2} value={excerpt} maxLength={2000} onChange={event => setExcerpt(event.target.value)} /></Col>
                  <Col md={6}><Label>{t("SEO title")}</Label><Input value={seoTitle} maxLength={300} onChange={event => setSeoTitle(event.target.value)} /></Col>
                  <Col md={6}><Label>{t("SEO description")}</Label><Input type="textarea" rows={2} value={seoDescription} maxLength={1000} onChange={event => setSeoDescription(event.target.value)} /></Col>
                </Row></CardBody>
              </Card>
              <Card><CardHeader><h5 className="card-title mb-0">{t("Translated fields")}</h5></CardHeader><CardBody><Row className="g-3">{localizedDefinitions.map(field => renderField(field, localizedValues))}</Row></CardBody></Card>
              {!isNewTranslation && sharedDefinitions.length > 0 && <Card><CardHeader><h5 className="card-title mb-0">{t("Shared fields")}</h5><small className="text-muted">{t("Changing these values affects every language version")}</small></CardHeader><CardBody><Row className="g-3">{sharedDefinitions.map(field => renderField(field, sharedValues))}</Row></CardBody></Card>}
              <div className="d-flex flex-wrap justify-content-end gap-2 mb-4"><Button type="submit" color="primary" disabled={saving}>{saving ? <><Spinner size="sm" className="me-2" />{t("Saving")}</> : t(isNewTranslation ? "Create translation draft" : "Save draft")}</Button></div>
            </Col>
            <Col xl={4}>
              <Card><CardHeader><h5 className="card-title mb-0">{t("Publishing workflow")}</h5></CardHeader><CardBody>
                {isNewTranslation ? <Alert color="info">{t("Save this language version first. Then submit it for review or schedule publication.")}</Alert> : <div className="d-grid gap-2">{workflowActions.map(item => <Button key={item.action} type="button" color={item.color} outline={item.action === "reject" || item.action === "unpublish" || item.action === "archive"} disabled={Boolean(busyAction)} onClick={() => void workflow(item.action)}>{busyAction === item.action ? <Spinner size="sm" className="me-2" /> : null}{t(item.label)}</Button>)}</div>}
                <hr /><div className="small text-muted">{t("Language direction")}: {selectedLocale?.direction ?? t("Unknown")} · {t("Translation state is managed independently for each language.")}</div>
              </CardBody></Card>
              <Card><CardHeader><h5 className="card-title mb-0">{t("Version history")}</h5></CardHeader><CardBody>
                {!selectedTranslation ? <div className="text-muted small">{t("Save the translation to create revision history.")}</div> :
                  revisions.length === 0 ? <div className="text-muted small">{t("No revisions found")}</div> :
                  <div className="d-flex flex-column gap-3">{revisions.map(revision => <div key={revision.id} className="border-bottom pb-3">
                    <div className="d-flex justify-content-between align-items-center"><strong>v{revision.version}</strong><small className="text-muted">{new Date(revision.createdAt).toLocaleString(i18n.language === "fa" ? "fa-IR" : "en-US")}</small></div>
                    <div className="small text-muted mb-2">{revision.changeNote ?? t("Content saved")}</div>
                    <Button type="button" color="light" size="sm" disabled={Boolean(busyAction) || revision.version === selectedTranslation.version} onClick={() => void restoreRevision(revision.id)}>{t("Restore as draft")}</Button>
                  </div>)}</div>}
              </CardBody></Card>
            </Col>
          </Row>
        </Form>
      </>}
    </Container>
  </div>;
}
