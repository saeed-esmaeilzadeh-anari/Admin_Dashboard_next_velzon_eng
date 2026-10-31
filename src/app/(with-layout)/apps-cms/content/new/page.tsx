"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row, Spinner } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsContentType, CmsField, CmsLocale, CmsMediaAsset } from "@/helpers/cmsApi";
import PageBuilderField from "@/components/Cms/PageBuilderField";
import RelationField from "@/components/Cms/RelationField";
import RepeaterField from "@/components/Cms/RepeaterField";

function getErrorMessage(error: unknown): string {
  const value = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message) ? message.join(", ") : message ?? "Unable to complete the request.";
}
function createSlug(value: string) {
  return value.normalize("NFKC").toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
}
function fieldInitialValue(field: CmsField): unknown {
  if (field.key === "blocks" || field.type === "MULTISELECT" || field.type === "MEDIA_MULTIPLE" || field.type === "RELATION_MULTIPLE" || field.type === "REPEATER") return [];
  if (field.type === "BOOLEAN") return false;
  return "";
}
function fieldValueValid(field: CmsField, value: unknown): boolean {
  if (!field.isRequired && (value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0))) return true;
  if (field.isRequired && (value === "" || value === null || value === undefined || (Array.isArray(value) && value.length === 0))) return false;
  if (field.type === "INTEGER") return value === "" || Number.isInteger(Number(value));
  if (field.type === "DECIMAL") return value === "" || Number.isFinite(Number(value));
  if (field.type === "BOOLEAN") return typeof value === "boolean";
  if (field.type === "JSON") {
    if (typeof value !== "string") return true;
    try { JSON.parse(value); return true; } catch { return false; }
  }
  if (field.type === "MULTISELECT" || field.type === "MEDIA_MULTIPLE" || field.type === "RELATION_MULTIPLE") return Array.isArray(value) && value.every(item => typeof item === "string");
  if (field.type === "RELATION") return value === "" || typeof value === "string";
  if (field.type === "REPEATER") return Array.isArray(value) && value.every(item => typeof item === "object" && item !== null && !Array.isArray(item));
  if (field.type === "MEDIA") return value === "" || typeof value === "string";
  return true;
}
type CmsInputType = "number" | "date" | "datetime-local" | "email" | "url" | "text";
function renderInputType(field: CmsField): CmsInputType {
  if (field.type === "INTEGER" || field.type === "DECIMAL") return "number";
  if (field.type === "DATE") return "date";
  if (field.type === "DATETIME") return "datetime-local";
  if (field.type === "EMAIL") return "email";
  if (field.type === "URL") return "url";
  return "text";
}

export default function NewCmsContentPage() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const [types, setTypes] = useState<CmsContentType[]>([]);
  const [locales, setLocales] = useState<CmsLocale[]>([]);
  const [typeKey, setTypeKey] = useState("");
  const [localeCode, setLocaleCode] = useState("");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [mediaAssets, setMediaAssets] = useState<CmsMediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string,string>>({});

  useEffect(() => {
    let active = true;
    Promise.all([cmsApi.contentTypes(false), cmsApi.locales(true), cmsApi.media({page:1,limit:100})])
      .then(([nextTypes, nextLocales, mediaPage]) => {
        if (!active) return;
        setTypes(nextTypes.filter(item => item.isActive));
        setLocales(nextLocales.filter(locale => locale.isActive));
        setMediaAssets(mediaPage.data);
        const firstType = nextTypes.find(item => item.isActive);
        const defaultLocale = nextLocales.find(locale => locale.isDefault && locale.isActive) ?? nextLocales.find(locale => locale.isActive);
        setTypeKey(firstType?.key ?? "");
        setLocaleCode(defaultLocale?.code ?? "");
      })
      .catch(cause => { if (active) setError(getErrorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const selectedType = useMemo(() => types.find(item => item.key === typeKey), [types, typeKey]);
  useEffect(() => {
    const next: Record<string, unknown> = {};
    for (const field of selectedType?.fields ?? []) next[field.key] = fieldInitialValue(field);
    setValues(next);
    setFieldErrors({});
  }, [selectedType?.id]);

  useEffect(() => {
    if (!slugTouched) setSlug(createSlug(title));
  }, [title, slugTouched]);

  const setFieldValue = (field: CmsField, value: unknown) => {
    setValues(current => ({ ...current, [field.key]: value }));
    setFieldErrors(current => ({ ...current, [field.key]: "" }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const errors: Record<string,string> = {};
    for (const field of selectedType?.fields ?? []) {
      const value = values[field.key];
      if (!fieldValueValid(field, value)) errors[field.key] = t("Please enter a valid value");
    }
    if (!typeKey) errors.typeKey = t("Choose a content type");
    if (!localeCode) errors.localeCode = t("Choose a language");
    if (!title.trim()) errors.title = t("Title is required");
    if (!slug.trim()) errors.slug = t("Slug is required");
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;

    const localizedFields: Record<string, unknown> = {};
    const sharedFields: Record<string, unknown> = {};
    for (const field of selectedType?.fields ?? []) {
      let value = values[field.key];
      if (value === "" && !field.isRequired) continue;
      if ((field.type === "INTEGER" || field.type === "DECIMAL") && value !== "") value = Number(value);
      if (field.type === "MEDIA" && value === "") continue;
      if (field.type === "JSON" && typeof value === "string" && value.trim()) {
        try { value = JSON.parse(value); } catch { errors[field.key] = t("Invalid JSON"); }
      }
      (field.isLocalized ? localizedFields : sharedFields)[field.key] = value;
    }
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }

    setSaving(true);
    try {
      const created = await cmsApi.createContent({
        typeKey, localeCode, title: title.trim(), slug: slug.trim(),
        ...(excerpt.trim() ? { excerpt: excerpt.trim() } : {}),
        ...(seoTitle.trim() ? { seoTitle: seoTitle.trim() } : {}),
        ...(seoDescription.trim() ? { seoDescription: seoDescription.trim() } : {}),
        fields: { ...localizedFields, ...sharedFields },
      });
      router.push(`/apps-cms/content/${created.id}?localeCode=${encodeURIComponent(localeCode)}`);
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: CmsField) => {
    const value = values[field.key];
    if (field.type === "RELATION" || field.type === "RELATION_MULTIPLE") {
      return <Col md={12} key={field.key}><div className="mb-3"><small className="text-muted d-block mb-1">{field.isLocalized ? t("Translated field") : t("Shared field")}</small><RelationField field={field} value={value} localeCode={localeCode} onChange={next => setFieldValue(field, next)} /></div></Col>;
    }
    if (field.type === "REPEATER") {
      return <Col md={12} key={field.key}><div className="mb-3"><RepeaterField field={field} value={value} onChange={next => setFieldValue(field, next)} /></div></Col>;
    }
    const options = Array.isArray(field.config?.options) ? field.config?.options as Array<string | { value: string; label?: string }> : [];
    const choices = options.map(option => typeof option === "string" ? { value: option, label: option } : { value: option.value, label: option.label ?? option.value });
    return <Col md={field.type === "TEXTAREA" || field.type === "RICH_TEXT" || field.type === "MARKDOWN" || field.type === "JSON" ? 12 : 6} key={field.key}>
      <div className="mb-3">
        <Label for={`field-${field.key}`}>{field.label}{field.isRequired ? <span className="text-danger ms-1">*</span> : null}
          <small className="text-muted ms-2">{field.isLocalized ? t("Translated field") : t("Shared field")}</small>
        </Label>
        {field.type === "BOOLEAN" ? <div className="form-check form-switch mt-2"><Input className="form-check-input" type="switch" id={`field-${field.key}`} checked={Boolean(value)} onChange={event => setFieldValue(field, event.target.checked)} /><Label className="form-check-label" for={`field-${field.key}`}>{t("Enabled")}</Label></div>
          : field.type === "SELECT" ? <Input id={`field-${field.key}`} type="select" value={String(value ?? "")} invalid={Boolean(fieldErrors[field.key])} onChange={event => setFieldValue(field, event.target.value)}><option value="">{t("Select an option")}</option>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</Input>
          : field.type === "MULTISELECT" ? <Input id={`field-${field.key}`} type="select" multiple value={Array.isArray(value) ? value.map(String) : []} invalid={Boolean(fieldErrors[field.key])} onChange={event => setFieldValue(field, Array.from((event.currentTarget as unknown as HTMLSelectElement).selectedOptions).map(option => option.value))}>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</Input>
          : field.type === "MEDIA" ? <Input id={`field-${field.key}`} type="select" value={String(value ?? "")} invalid={Boolean(fieldErrors[field.key])} onChange={event => setFieldValue(field, event.target.value)}><option value="">{t("Choose media")}</option>{mediaAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.originalName} · {asset.kind}</option>)}</Input>
          : field.type === "MEDIA_MULTIPLE" ? <Input id={`field-${field.key}`} type="select" multiple value={Array.isArray(value) ? value.map(String) : []} invalid={Boolean(fieldErrors[field.key])} onChange={event => setFieldValue(field, Array.from((event.currentTarget as unknown as HTMLSelectElement).selectedOptions).map(option => option.value))}>{mediaAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.originalName} · {asset.kind}</option>)}</Input>
          : field.key === "blocks" && field.type === "JSON" ? <PageBuilderField value={value} onChange={next => setFieldValue(field,next)} mediaAssets={mediaAssets} />
          : field.type === "TEXTAREA" || field.type === "RICH_TEXT" || field.type === "MARKDOWN" || field.type === "JSON" ? <Input id={`field-${field.key}`} type="textarea" rows={field.type === "JSON" ? 5 : 4} value={typeof value === "string" ? value : value == null ? "" : JSON.stringify(value, null, 2)} invalid={Boolean(fieldErrors[field.key])} onChange={event => setFieldValue(field, event.target.value)} placeholder={field.type === "RICH_TEXT" ? t("Markdown or plain text; HTML tags are displayed as text for safety") : field.type === "MARKDOWN" ? "## Heading" : field.type === "JSON" ? '{"key":"value"}' : ""} />
          : <Input id={`field-${field.key}`} type={renderInputType(field)} value={value == null ? "" : String(value)} step={field.type === "DECIMAL" ? "any" : field.type === "INTEGER" ? "1" : undefined} invalid={Boolean(fieldErrors[field.key])} onChange={event => setFieldValue(field, event.target.value)} />}
        {fieldErrors[field.key] && <div className="invalid-feedback d-block">{fieldErrors[field.key]}</div>}
      </div>
    </Col>;
  };

  return <div className="page-content" dir={i18n.language === "fa" || i18n.language === "ar" ? "rtl" : "ltr"}>
    <Container fluid>
      <Row className="align-items-center mb-4">
        <Col><h4 className="mb-1">{t("Create content")}</h4><p className="text-muted mb-0">{t("Create a database-backed content entry with localized fields")}</p></Col>
        <Col xs="auto"><Link className="btn btn-light" href="/apps-cms/content">{t("Back to content")}</Link></Col>
      </Row>
      {error && <Alert color="danger" toggle={() => setError("")}>{error}</Alert>}
      {loading ? <div className="text-center py-5"><Spinner /> {t("Loading")}</div> : <Form onSubmit={submit}>
        <Row>
          <Col xl={8}>
            <Card>
              <CardHeader><h5 className="card-title mb-0">{t("Content details")}</h5></CardHeader>
              <CardBody>
                <Row className="g-3">
                  <Col md={6}><Label>{t("Content type")}</Label><Input type="select" value={typeKey} onChange={event => setTypeKey(event.target.value)}>{types.map(type => <option key={type.id} value={type.key}>{type.name} ({type.key})</option>)}</Input></Col>
                  <Col md={6}><Label>{t("Language")}</Label><Input type="select" value={localeCode} onChange={event => setLocaleCode(event.target.value)}>{locales.map(locale => <option key={locale.id} value={locale.code}>{locale.nativeName} ({locale.code})</option>)}</Input></Col>
                  <Col md={12}><Label>{t("Title")} *</Label><Input value={title} maxLength={300} invalid={Boolean(fieldErrors.title)} onChange={event => setTitle(event.target.value)} />{fieldErrors.title && <div className="invalid-feedback d-block">{fieldErrors.title}</div>}</Col>
                  <Col md={12}><Label>{t("Slug")} *</Label><Input value={slug} maxLength={180} invalid={Boolean(fieldErrors.slug)} onChange={event => { setSlug(event.target.value); setSlugTouched(true); }} />{fieldErrors.slug && <div className="invalid-feedback d-block">{fieldErrors.slug}</div>}<small className="text-muted">{t("Slug is unique within its language")}</small></Col>
                  <Col md={12}><Label>{t("Excerpt")}</Label><Input type="textarea" rows={2} value={excerpt} maxLength={2000} onChange={event => setExcerpt(event.target.value)} /></Col>
                  <Col md={6}><Label>{t("SEO title")}</Label><Input value={seoTitle} maxLength={300} onChange={event => setSeoTitle(event.target.value)} /></Col>
                  <Col md={6}><Label>{t("SEO description")}</Label><Input type="textarea" rows={2} value={seoDescription} maxLength={1000} onChange={event => setSeoDescription(event.target.value)} /></Col>
                </Row>
              </CardBody>
            </Card>
            <Card>
              <CardHeader><h5 className="card-title mb-0">{t("Content fields")}</h5><small className="text-muted">{t("Field definitions come from the selected content type")}</small></CardHeader>
              <CardBody><Row className="g-3">{(selectedType?.fields ?? []).filter(field => field.isLocalized).map(renderField)}</Row></CardBody>
            </Card>
            <Card>
              <CardHeader><h5 className="card-title mb-0">{t("Shared fields")}</h5><small className="text-muted">{t("These values are common to all translations")}</small></CardHeader>
              <CardBody><Row className="g-3">{(selectedType?.fields ?? []).filter(field => !field.isLocalized).map(renderField)}</Row></CardBody>
            </Card>
            <div className="d-flex gap-2 justify-content-end mb-4">
              <Link className="btn btn-light" href="/apps-cms/content">{t("Cancel")}</Link>
              <Button type="submit" color="primary" disabled={saving || !selectedType || !localeCode}>{saving ? <><Spinner size="sm" className="me-2" />{t("Saving")}</> : t("Save draft")}</Button>
            </div>
          </Col>
          <Col xl={4}><Card><CardHeader><h5 className="card-title mb-0">{t("Publishing workflow")}</h5></CardHeader><CardBody>
            <div className="d-flex align-items-start gap-2 mb-3"><i className="ri-draft-line fs-4 text-primary" /><div><div className="fw-medium">{t("Draft")}</div><small className="text-muted">{t("Content is saved privately first and can be sent for review later.")}</small></div></div>
            <div className="d-flex align-items-start gap-2 mb-3"><i className="ri-translate-2 fs-4 text-info" /><div><div className="fw-medium">{t("Translations")}</div><small className="text-muted">{t("Create the first language version now; add other languages from the content editor.")}</small></div></div>
            <div className="d-flex align-items-start gap-2"><i className="ri-shield-check-line fs-4 text-success" /><div><div className="fw-medium">{t("Public visibility")}</div><small className="text-muted">{t("Only the published snapshot is delivered by the public API.")}</small></div></div>
          </CardBody></Card></Col>
        </Row>
      </Form>}
    </Container>
  </div>;
}
