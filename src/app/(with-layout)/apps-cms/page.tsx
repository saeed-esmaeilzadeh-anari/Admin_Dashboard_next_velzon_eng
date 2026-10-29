"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Col, Container, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsDashboardSummary, CmsStatus } from "@/helpers/cmsApi";

function getErrorMessage(error: unknown): string {
  const value = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message) ? message.join(", ") : message ?? "Unable to load the CMS overview.";
}
const statuses: Array<{ value: CmsStatus; label: string; color: string }> = [
  { value: "DRAFT", label: "Draft", color: "secondary" },
  { value: "IN_REVIEW", label: "In review", color: "warning" },
  { value: "SCHEDULED", label: "Scheduled", color: "info" },
  { value: "PUBLISHED", label: "Published", color: "success" },
  { value: "ARCHIVED", label: "Archived", color: "dark" },
];
const shortcuts = [
  { label: "Content library", href: "/apps-cms/content", icon: "ri-file-text-line", description: "Create, edit and publish content" },
  { label: "Content types and fields", href: "/apps-cms/content-types", icon: "ri-list-settings-line", description: "Design dynamic content schemas" },
  { label: "Media library", href: "/apps-cms/media", icon: "ri-image-line", description: "Manage uploaded assets" },
  { label: "Languages and locales", href: "/apps-cms/languages", icon: "ri-translate-2", description: "Configure languages and direction" },
  { label: "Taxonomies and terms", href: "/apps-cms/taxonomies", icon: "ri-price-tag-3-line", description: "Organize content with categories" },
  { label: "Navigation menus", href: "/apps-cms/menus", icon: "ri-menu-line", description: "Manage localized site navigation" },
  { label: "Redirect manager", href: "/apps-cms/redirects", icon: "ri-arrow-left-right-line", description: "Manage old URLs and redirects" },
  { label: "Forms and submissions", href: "/apps-cms/forms", icon: "ri-survey-line", description: "Build public forms and review entries" },
  { label: "Webhooks", href: "/apps-cms/webhooks", icon: "ri-links-line", description: "Manage outgoing integrations" },
  { label: "Import / Export", href: "/apps-cms/import-export", icon: "ri-exchange-line", description: "Move structured content as JSON" },
  { label: "CMS permissions", href: "/apps-cms/permissions", icon: "ri-shield-user-line", description: "Configure role-level access" },
  { label: "Audit log", href: "/apps-cms/audit-logs", icon: "ri-history-line", description: "Review CMS activity" },
];
const fmt = (value: number) => new Intl.NumberFormat().format(value);

export default function CmsOverviewPage() {
  const { t, i18n } = useTranslation();
  const [summary, setSummary] = useState<CmsDashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (quiet) setRefreshing(true); else setLoading(true);
    setError("");
    try {
      setSummary(await cmsApi.dashboardSummary());
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return <div className="page-content" dir={i18n.language === "fa" || i18n.language === "ar" ? "rtl" : "ltr"}>
    <Container fluid>
      <Row className="align-items-center mb-4">
        <Col><h4 className="mb-1">{t("CMS Overview")}</h4><p className="text-muted mb-0">{t("Overview of your content, translations and publishing workflow")}</p></Col>
        <Col xs="auto" className="d-flex flex-wrap gap-2">
          <Button color="light" onClick={() => void load(true)} disabled={loading || refreshing}><i className="ri-refresh-line me-1" />{refreshing ? t("Refreshing") : t("Refresh")}</Button>
          <Link className="btn btn-primary" href="/apps-cms/content/new"><i className="ri-add-line me-1" />{t("Create content")}</Link>
        </Col>
      </Row>
      {error && <Alert color="danger" toggle={() => setError("")}>{error}</Alert>}
      {loading && !summary ? <div className="text-center py-5"><Spinner className="me-2" />{t("Loading")}</div> : null}
      {!loading && !summary && !error && <Alert color="warning">{t("CMS overview is unavailable.")}</Alert>}
      {summary && <>
        <Row>
          {[
            { label: "Total content", value: summary.contentCount, icon: "ri-file-list-3-line", color: "primary", detail: "Content records" },
            { label: "Translations", value: summary.translationCount, icon: "ri-translate-2", color: "info", detail: "Language versions" },
            { label: "Active languages", value: summary.activeLocaleCount, icon: "ri-global-line", color: "success", detail: "Configured locales" },
            { label: "Content types", value: summary.activeContentTypeCount, icon: "ri-list-settings-line", color: "warning", detail: "Active schemas" },
          ].map(card => <Col sm={6} xl={3} key={card.label}>
            <Card className="card-animate"><CardBody>
              <div className="d-flex justify-content-between align-items-start"><div><p className="text-muted mb-1">{t(card.label)}</p><h3 className="mb-1">{new Intl.NumberFormat(i18n.language === "fa" ? "fa-IR" : i18n.language === "ar" ? "ar" : "en-US").format(card.value)}</h3><small className="text-muted">{t(card.detail)}</small></div><div className={`avatar-sm bg-${card.color}-subtle rounded`}><span className={`avatar-title rounded fs-4 text-${card.color}`}><i className={card.icon}/></span></div></div>
            </CardBody></Card></Col>)}
        </Row>
        <Row>
          <Col xl={5}>
            <Card>
              <CardHeader className="d-flex align-items-center justify-content-between"><h5 className="card-title mb-0">{t("Editorial workflow")}</h5><Link href="/apps-cms/content" className="btn btn-sm btn-soft-primary">{t("Content library")}</Link></CardHeader>
              <CardBody><div className="d-grid gap-3">
                {statuses.map(status => <div key={status.value} className="d-flex justify-content-between align-items-center border-bottom pb-2">
                  <div className="d-flex align-items-center gap-2"><Badge color={status.color}>{t(status.label)}</Badge><span className="text-muted small">{t(status.value === "IN_REVIEW" ? "Waiting for review" : status.value === "SCHEDULED" ? "Waiting to publish" : status.value === "PUBLISHED" ? "Visible to visitors" : status.value === "ARCHIVED" ? "Stored out of circulation" : "Private working drafts")}</span></div>
                  <strong>{new Intl.NumberFormat(i18n.language === "fa" ? "fa-IR" : "en-US").format(summary.statusCounts[status.value] ?? 0)}</strong>
                </div>)}
              </div></CardBody>
            </Card>
          </Col>
          <Col xl={7}>
            <Card>
              <CardHeader className="d-flex align-items-center justify-content-between"><h5 className="card-title mb-0">{t("Recently updated")}</h5><Link href="/apps-cms/content" className="btn btn-sm btn-soft-primary">{t("View all")}</Link></CardHeader>
              <CardBody><div className="table-responsive"><Table responsive hover className="align-middle table-nowrap mb-0">
                <thead className="table-light"><tr><th>{t("Title")}</th><th>{t("Type")}</th><th>{t("Language")}</th><th>{t("Status")}</th><th>{t("Updated")}</th></tr></thead>
                <tbody>
                  {summary.recentlyUpdated.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">{t("No recent content")}</td></tr>}
                  {summary.recentlyUpdated.map(item => <tr key={item.id}>
                    <td><Link href={`/apps-cms/content/${item.contentId}?localeCode=${encodeURIComponent(item.locale.code)}`} className="fw-medium">{item.title}</Link><small className="d-block text-muted"><code>{item.slug}</code></small></td>
                    <td>{item.contentType.name}</td><td>{item.locale.nativeName}</td>
                    <td><Badge color={statuses.find(status => status.value === item.status)?.color ?? "secondary"}>{t(statuses.find(status => status.value === item.status)?.label ?? item.status)}</Badge></td>
                    <td>{new Date(item.updatedAt).toLocaleDateString(i18n.language === "fa" ? "fa-IR" : i18n.language === "ar" ? "ar" : "en-US")}</td>
                  </tr>)}
                </tbody>
              </Table></div></CardBody>
            </Card>
          </Col>
        </Row>
        <Card><CardHeader><h5 className="card-title mb-0">{t("Quick access")}</h5></CardHeader><CardBody><Row className="g-3">
          {shortcuts.map(item => <Col sm={6} xl={3} key={item.href}><Link href={item.href} className="card card-body h-100 mb-0 text-reset text-decoration-none border">
            <div className="d-flex align-items-start gap-3"><span className="avatar-sm bg-light rounded"><span className="avatar-title bg-transparent rounded fs-4 text-primary"><i className={item.icon}/></span></span><div><h6 className="mb-1">{t(item.label)}</h6><p className="text-muted small mb-0">{t(item.description)}</p></div></div>
          </Link></Col>)}
        </Row></CardBody></Card>
      </>}
    </Container>
  </div>;
}
