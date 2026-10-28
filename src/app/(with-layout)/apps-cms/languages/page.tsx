"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsLocale } from "@/helpers/cmsApi";

function errorMessage(error: unknown): string {
  const value = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message) ? message.join(", ") : message ?? "Unable to complete the request.";
}
export default function CmsLanguagesPage() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<CmsLocale[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [code, setCode] = useState("de-DE");
  const [name, setName] = useState("German");
  const [nativeName, setNativeName] = useState("Deutsch");
  const [direction, setDirection] = useState<"LTR" | "RTL">("LTR");
  const [fallbackLocaleId, setFallbackLocaleId] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems(await cmsApi.locales(true)); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const create = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      await cmsApi.createLocale({ code: code.trim(), name: name.trim(), nativeName: nativeName.trim(), direction, ...(fallbackLocaleId ? { fallbackLocaleId } : {}) });
      setNotice(t("Language created"));
      await load();
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  };
  const setDefault = async (locale: CmsLocale) => {
    setBusyId(locale.id); setError(""); setNotice("");
    try { await cmsApi.updateLocale(locale.id, { isDefault: true }); setNotice(t("Default language updated")); await load(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusyId(""); }
  };
  const toggleActive = async (locale: CmsLocale) => {
    setBusyId(locale.id); setError(""); setNotice("");
    try { await cmsApi.updateLocale(locale.id, { isActive: !locale.isActive }); setNotice(t("Language settings updated")); await load(); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusyId(""); }
  };

  return <div className="page-content" dir={i18n.language === "fa" || i18n.language === "ar" ? "rtl" : "ltr"}>
    <Container fluid>
      <Row className="align-items-center mb-4"><Col><h4 className="mb-1">{t("Languages and locales")}</h4><p className="text-muted mb-0">{t("Manage content locales, language direction and fallback")}</p></Col><Col xs="auto"><Link className="btn btn-light" href="/apps-cms/content">{t("Back to content")}</Link></Col></Row>
      {error && <Alert color="danger" toggle={() => setError("")}>{error}</Alert>}
      {notice && <Alert color="success" toggle={() => setNotice("")}>{notice}</Alert>}
      <Row>
        <Col xl={8}>
          <Card><CardHeader className="d-flex justify-content-between align-items-center"><h5 className="card-title mb-0">{t("Configured languages")}</h5><Button color="light" size="sm" onClick={() => void load()} disabled={loading}><i className="ri-refresh-line me-1" />{t("Refresh")}</Button></CardHeader>
            <CardBody><div className="table-responsive"><Table responsive hover className="align-middle table-nowrap"><thead className="table-light"><tr><th>{t("Language")}</th><th>{t("Locale code")}</th><th>{t("Direction")}</th><th>{t("Status")}</th><th>{t("Actions")}</th></tr></thead><tbody>
              {loading && <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" className="me-2" />{t("Loading")}</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">{t("No languages configured")}</td></tr>}
              {!loading && items.map(locale => <tr key={locale.id}>
                <td><div className="fw-medium">{locale.nativeName}</div><small className="text-muted">{locale.name}</small>{locale.isDefault && <Badge color="primary" className="ms-2">{t("Default")}</Badge>}</td>
                <td><code>{locale.code}</code></td><td><Badge color="light" className="text-dark">{locale.direction}</Badge></td>
                <td><Badge color={locale.isActive ? "success" : "secondary"}>{t(locale.isActive ? "Active" : "Inactive")}</Badge></td>
                <td><div className="d-flex gap-1 flex-wrap">
                  {!locale.isDefault && <Button size="sm" color="light" disabled={busyId === locale.id} onClick={() => void setDefault(locale)}>{t("Set default")}</Button>}
                  <Button size="sm" color={locale.isActive ? "warning" : "success"} outline disabled={busyId === locale.id || locale.isDefault && locale.isActive} onClick={() => void toggleActive(locale)}>{t(locale.isActive ? "Disable" : "Enable")}</Button>
                </div></td>
              </tr>)}
            </tbody></Table></div></CardBody>
          </Card>
          <Alert color="info">{t("Changing a content locale does not automatically add a translated UI dictionary. User-interface translations and stored content translations are separate systems.")}</Alert>
        </Col>
        <Col xl={4}>
          <Card><CardHeader><h5 className="card-title mb-0">{t("Add language")}</h5></CardHeader><CardBody>
            <Form onSubmit={create}>
              <div className="mb-3"><Label>{t("Locale code")} *</Label><Input required value={code} maxLength={35} pattern="[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*" onChange={event => setCode(event.target.value)} placeholder="fa-IR" /><small className="text-muted">{t("Use a language or language-region code, for example fa-IR or en-US.")}</small></div>
              <div className="mb-3"><Label>{t("Language name")} *</Label><Input required maxLength={100} value={name} onChange={event => setName(event.target.value)} /></div>
              <div className="mb-3"><Label>{t("Native name")} *</Label><Input required maxLength={100} value={nativeName} onChange={event => setNativeName(event.target.value)} /></div>
              <div className="mb-3"><Label>{t("Text direction")} *</Label><Input type="select" value={direction} onChange={event => setDirection(event.target.value as "LTR" | "RTL")}><option value="LTR">LTR — English, German...</option><option value="RTL">RTL — Persian, Arabic...</option></Input></div>
              <div className="mb-3"><Label>{t("Fallback locale")}</Label><Input type="select" value={fallbackLocaleId} onChange={event => setFallbackLocaleId(event.target.value)}><option value="">{t("No fallback")}</option>{items.filter(locale => locale.isActive).map(locale => <option key={locale.id} value={locale.id}>{locale.nativeName} ({locale.code})</option>)}</Input></div>
              <Button type="submit" color="primary" block disabled={saving}>{saving ? <><Spinner size="sm" className="me-2" />{t("Saving")}</> : t("Add language")}</Button>
            </Form>
          </CardBody></Card>
        </Col>
      </Row>
    </Container>
  </div>;
}
