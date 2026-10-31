"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsContent, CmsContentType, CmsLocale, CmsStatus, CmsTranslation } from "@/helpers/cmsApi";

type CmsRow = { content: CmsContent; translation: CmsTranslation };
const statusLabels: Record<CmsStatus, string> = {
  DRAFT: "Draft", IN_REVIEW: "In review", SCHEDULED: "Scheduled", PUBLISHED: "Published", ARCHIVED: "Archived",
};
function getErrorMessage(error: unknown): string {
  const value = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message) ? message.join(", ") : message ?? "Unable to complete the request.";
}

export default function CmsContentListPage() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<CmsContent[]>([]);
  const [types, setTypes] = useState<CmsContentType[]>([]);
  const [locales, setLocales] = useState<CmsLocale[]>([]);
  const [search, setSearch] = useState("");
  const [typeKey, setTypeKey] = useState("");
  const [localeCode, setLocaleCode] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalContent, setTotalContent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const requestSequence = useRef(0);

  const load = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError("");
    try {
      const [contentPage, nextTypes, nextLocales] = await Promise.all([
        cmsApi.contents({ page, limit: 20, ...(typeKey ? { typeKey } : {}), ...(localeCode ? { localeCode } : {}), ...(status ? { status: status as CmsStatus } : {}), ...(search.trim() ? { search: search.trim() } : {}) }),
        cmsApi.contentTypes(true),
        cmsApi.locales(true),
      ]);
      if (requestId !== requestSequence.current) return;
      setItems(contentPage.data);
      setTotalPages(contentPage.pagination.pages);
      setTotalContent(contentPage.pagination.total);
      setTypes(nextTypes);
      setLocales(nextLocales.filter(locale => locale.isActive));
    } catch (cause) {
      if (requestId === requestSequence.current) setError(getErrorMessage(cause));
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [typeKey, localeCode, status, search, page]);

  useEffect(() => {
    void load();
    return () => { requestSequence.current += 1; };
  }, [load]);

  const rows = useMemo<CmsRow[]>(() => items.flatMap(content => content.translations.map(translation => ({ content, translation }))), [items]);

  const performWorkflow = async (contentId: string, locale: string, action: "submit" | "publish" | "reject" | "unpublish" | "archive" | "restore-to-draft") => {
    setBusyId(contentId + ":" + locale);
    setError("");
    setNotice("");
    try {
      let body: Record<string, unknown> | undefined;
      if (action === "reject") {
        const reason = window.prompt(t("Enter rejection reason"));
        if (!reason?.trim()) return;
        body = { reason: reason.trim() };
      }
      await cmsApi.workflow(contentId, locale, action, body);
      setNotice(t("Operation completed successfully"));
      await load();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setBusyId("");
    }
  };

  const actionButtons = (row: CmsRow) => {
    const { content, translation } = row;
    const busy = busyId === content.id + ":" + (translation.locale?.code ?? "");
    const locale = translation.locale?.code ?? locales.find(x => x.id === translation.localeId)?.code ?? "";
    if (!locale) return null;
    return (
      <div className="d-flex gap-1 flex-wrap">
        <Link className="btn btn-sm btn-soft-primary" href={`/apps-cms/content/${content.id}?localeCode=${encodeURIComponent(locale)}`}>{t("Edit")}</Link>
        {translation.status === "DRAFT" && <Button size="sm" color="info" disabled={busy} onClick={() => void performWorkflow(content.id, locale, "submit")}>{t("Submit for review")}</Button>}
        {translation.status === "DRAFT" && translation.publishedSlug && <Button size="sm" color="warning" outline disabled={busy} onClick={() => void performWorkflow(content.id, locale, "unpublish")}>{t("Unpublish live copy")}</Button>}
        {translation.status === "IN_REVIEW" && <>
          <Button size="sm" color="success" disabled={busy} onClick={() => void performWorkflow(content.id, locale, "publish")}>{t("Publish")}</Button>
          <Button size="sm" color="warning" outline disabled={busy} onClick={() => void performWorkflow(content.id, locale, "reject")}>{t("Reject")}</Button>
        </>}
        {translation.status === "PUBLISHED" && <Button size="sm" color="warning" outline disabled={busy} onClick={() => void performWorkflow(content.id, locale, "unpublish")}>{t("Unpublish")}</Button>}
        {translation.status === "SCHEDULED" && <><Button size="sm" color="success" disabled={busy} onClick={() => void performWorkflow(content.id, locale, "publish")}>{t("Publish now")}</Button><Button size="sm" color="warning" outline disabled={busy} onClick={() => void performWorkflow(content.id, locale, "unpublish")}>{t("Cancel schedule")}</Button></>}
        {translation.status !== "ARCHIVED" && <Button size="sm" color="danger" outline disabled={busy} onClick={() => void performWorkflow(content.id, locale, "archive")}>{t("Archive")}</Button>}
        {translation.status === "ARCHIVED" && <Button size="sm" color="secondary" outline disabled={busy} onClick={() => void performWorkflow(content.id, locale, "restore-to-draft")}>{t("Restore to draft")}</Button>}
      </div>
    );
  };

  return (
    <div className="page-content" dir={i18n.language === "fa" || i18n.language === "ar" ? "rtl" : "ltr"}>
      <Container fluid>
        <Row className="align-items-center mb-4">
          <Col><h4 className="mb-1">{t("CMS Content")}</h4><p className="text-muted mb-0">{t("Manage content, translations and publishing workflow")}</p></Col>
          <Col xs="auto" className="d-flex gap-2">
            <Button color="light" onClick={() => void load()} disabled={loading}><i className="ri-refresh-line me-1" />{t("Refresh")}</Button>
            <Link href="/apps-cms/content/new" className="btn btn-primary"><i className="ri-add-line me-1" />{t("Create content")}</Link>
          </Col>
        </Row>
        {error && <Alert color="danger" toggle={() => setError("")}>{error}</Alert>}
        {notice && <Alert color="success" toggle={() => setNotice("")}>{notice}</Alert>}
        <Card>
          <CardHeader><h5 className="card-title mb-0">{t("Content library")}</h5></CardHeader>
          <CardBody>
            <Form onSubmit={event => { event.preventDefault(); void load(); }}>
              <Row className="g-3 mb-4">
                <Col lg={4}><Label>{t("Search")}</Label><Input value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder={t("Search title or slug")} /></Col>
                <Col sm={6} lg={3}><Label>{t("Content type")}</Label><Input type="select" value={typeKey} onChange={event => { setTypeKey(event.target.value); setPage(1); }}><option value="">{t("All content types")}</option>{types.map(item => <option key={item.id} value={item.key}>{item.name} ({item.key})</option>)}</Input></Col>
                <Col sm={6} lg={2}><Label>{t("Language")}</Label><Input type="select" value={localeCode} onChange={event => { setLocaleCode(event.target.value); setPage(1); }}><option value="">{t("All languages")}</option>{locales.map(locale => <option key={locale.id} value={locale.code}>{locale.nativeName} ({locale.code})</option>)}</Input></Col>
                <Col sm={6} lg={2}><Label>{t("Status")}</Label><Input type="select" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }}><option value="">{t("All statuses")}</option>{Object.entries(statusLabels).map(([key, value]) => <option key={key} value={key}>{t(value)}</option>)}</Input></Col>
                <Col sm={6} lg={1} className="d-flex align-items-end"><Button type="submit" color="primary" block disabled={loading}>{t("Apply")}</Button></Col>
              </Row>
            </Form>
            <div className="table-responsive">
              <Table hover responsive className="align-middle table-nowrap mb-0">
                <thead className="table-light"><tr><th>{t("Title")}</th><th>{t("Type")}</th><th>{t("Language")}</th><th>{t("Slug")}</th><th>{t("Status")}</th><th>{t("Version")}</th><th>{t("Updated")}</th><th>{t("Actions")}</th></tr></thead>
                <tbody>
                  {loading && <tr><td colSpan={8} className="text-center py-5"><Spinner size="sm" className="me-2" />{t("Loading")}</td></tr>}
                  {!loading && rows.length === 0 && <tr><td colSpan={8} className="text-center text-muted py-5">{t("No content found")}</td></tr>}
                  {!loading && rows.map(({ content, translation }) => (
                    <tr key={translation.id}>
                      <td><div className="fw-medium">{translation.title}</div><small className="text-muted">{content.id.slice(0, 8)}</small></td>
                      <td><span className="badge bg-light text-dark">{content.contentType.name}</span></td>
                      <td>{translation.locale?.nativeName ?? translation.locale?.code ?? locales.find(x => x.id === translation.localeId)?.nativeName ?? translation.localeId}</td>
                      <td><code>{translation.slug}</code>{translation.publishedSlug && translation.publishedSlug !== translation.slug && <small className="d-block text-muted">{t("Published slug")}: {translation.publishedSlug}</small>}</td>
                      <td><Badge color={translation.status === "PUBLISHED" ? "success" : translation.status === "IN_REVIEW" ? "warning" : translation.status === "ARCHIVED" ? "dark" : "secondary"}>{t(statusLabels[translation.status])}</Badge></td>
                      <td>{translation.version}</td>
                      <td>{new Date(translation.publishedAt ?? content.updatedAt).toLocaleDateString(i18n.language === "fa" ? "fa-IR" : "en-US")}</td>
                      <td>{actionButtons({ content, translation })}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mt-3">
              <span className="text-muted fs-13">{t("Content entries")}: {totalContent} · {t("Translations shown")}: {rows.length}</span>
              <div className="d-flex align-items-center gap-2">
                <Button type="button" color="light" size="sm" disabled={loading || page <= 1} onClick={() => setPage(current => Math.max(1, current - 1))}>{t("Previous")}</Button>
                <span className="text-muted fs-13">{page} / {Math.max(totalPages, 1)}</span>
                <Button type="button" color="light" size="sm" disabled={loading || page >= totalPages} onClick={() => setPage(current => Math.min(Math.max(totalPages, 1), current + 1))}>{t("Next")}</Button>
              </div>
            </div>
          </CardBody>
        </Card>
      </Container>
    </div>
  );
}
