"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsLocale, CmsTaxonomy, CmsTaxonomyTerm } from "@/helpers/cmsApi";

function errorText(error: unknown): string {
  const value = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message) ? message.join(", ") : message ?? "Request failed.";
}
function slugify(value: string) {
  return value.normalize("NFKC").toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
}
export default function CmsTaxonomiesPage() {
  const { t, i18n } = useTranslation();
  const [taxonomies, setTaxonomies] = useState<CmsTaxonomy[]>([]);
  const [terms, setTerms] = useState<CmsTaxonomyTerm[]>([]);
  const [locales, setLocales] = useState<CmsLocale[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [hierarchical, setHierarchical] = useState(true);
  const [termName, setTermName] = useState("");
  const [termSlug, setTermSlug] = useState("");
  const [termDescription, setTermDescription] = useState("");
  const [parentId, setParentId] = useState("");
  const [translateTerm, setTranslateTerm] = useState<CmsTaxonomyTerm | null>(null);
  const [translationLocale, setTranslationLocale] = useState("");
  const [translationName, setTranslationName] = useState("");
  const [translationSlug, setTranslationSlug] = useState("");
  const [translationDescription, setTranslationDescription] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  const selected = taxonomies.find(item => item.id === selectedId);
  const termsByParent = useMemo(() => {
    const map = new Map<string | null, CmsTaxonomyTerm[]>();
    terms.forEach(term => { const items = map.get(term.parentId ?? null) ?? []; items.push(term); map.set(term.parentId ?? null, items); });
    return map;
  }, [terms]);

  const loadTaxonomies = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [nextTaxonomies, nextLocales] = await Promise.all([cmsApi.taxonomies(), cmsApi.locales(true)]);
      setTaxonomies(nextTaxonomies);
      setLocales(nextLocales.filter(locale => locale.isActive));
      setSelectedId(current => current || nextTaxonomies[0]?.id || "");
    } catch (cause) { setError(errorText(cause)); }
    finally { setLoading(false); }
  }, []);
  const loadTerms = useCallback(async (id: string) => {
    if (!id) { setTerms([]); return; }
    try { setTerms(await cmsApi.taxonomyTerms(id)); }
    catch (cause) { setError(errorText(cause)); }
  }, []);
  useEffect(() => { void loadTaxonomies(); }, [loadTaxonomies]);
  useEffect(() => { void loadTerms(selectedId); }, [loadTerms, selectedId]);
  useEffect(() => { if (!slugTouched) setTermSlug(slugify(termName)); }, [termName, slugTouched]);

  const createTaxonomy = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const created = await cmsApi.createTaxonomy({ key: key.trim(), name: name.trim(), description: description.trim(), isHierarchical: hierarchical });
      setKey(""); setName(""); setDescription(""); await loadTaxonomies(); setSelectedId(created.id); setNotice(t("Taxonomy created"));
    } catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  };
  const addTerm = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await cmsApi.createTaxonomyTerm(selected.id, { name: termName.trim(), slug: termSlug.trim(), description: termDescription.trim(), parentId: parentId || null });
      setTermName(""); setTermSlug(""); setSlugTouched(false); setTermDescription(""); setParentId("");
      await loadTerms(selected.id); await loadTaxonomies(); setNotice(t("Term created"));
    } catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  };
  const toggleTerm = async (term: CmsTaxonomyTerm) => {
    if (!selected) return;
    setBusyId(term.id); setError(""); setNotice("");
    try { await cmsApi.updateTaxonomyTerm(selected.id, term.id, { isActive: !term.isActive }); await loadTerms(selected.id); setNotice(t("Term settings updated")); }
    catch (cause) { setError(errorText(cause)); }
    finally { setBusyId(""); }
  };
  const openTranslation = (term: CmsTaxonomyTerm) => {
    setTranslateTerm(term);
    const existing = term.translations?.find(item => item.locale?.code !== "fa-IR") ?? null;
    const locale = locales.find(item => item.code !== "fa-IR")?.code ?? "";
    setTranslationLocale(existing?.locale?.code ?? locale);
    setTranslationName(existing?.name ?? term.name);
    setTranslationSlug(existing?.slug ?? term.slug);
    setTranslationDescription(existing?.description ?? term.description ?? "");
  };
  const saveTranslation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); if (!translateTerm || !translationLocale) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await cmsApi.translateTaxonomyTerm(translateTerm.id, { localeCode: translationLocale, name: translationName.trim(), slug: translationSlug.trim(), description: translationDescription.trim() });
      setTranslateTerm(null); await loadTerms(selectedId); setNotice(t("Translation saved"));
    } catch (cause) { setError(errorText(cause)); }
    finally { setSaving(false); }
  };

  const renderTermRows = (items: CmsTaxonomyTerm[], depth = 0): React.ReactNode[] => items.flatMap(term => [
    <tr key={term.id}>
      <td><div style={{paddingInlineStart: depth * 22}}><div className="fw-medium">{term.name}</div><small className="text-muted"><code>{term.slug}</code></small></div></td>
      <td>{term._count?.contents ?? 0}</td>
      <td>{term.translations?.map(tr => <Badge key={tr.id} color="light" className="text-dark me-1">{tr.locale?.code ?? tr.localeId}</Badge>)}</td>
      <td><Badge color={term.isActive ? "success" : "secondary"}>{t(term.isActive ? "Active" : "Inactive")}</Badge></td>
      <td><div className="d-flex flex-wrap gap-1"><Button size="sm" color="light" onClick={() => openTranslation(term)}>{t("Translate")}</Button><Button size="sm" outline color={term.isActive ? "warning" : "success"} disabled={busyId===term.id} onClick={() => void toggleTerm(term)}>{t(term.isActive ? "Disable" : "Enable")}</Button></div></td>
    </tr>,
    ...(termsByParent.get(term.id) ?? []).length ? renderTermRows(termsByParent.get(term.id)!, depth + 1) : []
  ]);

  return <div className="page-content" dir={["fa","ar"].includes(i18n.language.split("-")[0]) ? "rtl" : "ltr"}>
    <Container fluid>
      <Row className="align-items-center mb-4"><Col><h4 className="mb-1">{t("Taxonomies and terms")}</h4><p className="text-muted mb-0">{t("Create reusable categories and hierarchical terms for CMS content")}</p></Col><Col xs="auto"><Link href="/apps-cms/content" className="btn btn-light">{t("Back to content")}</Link></Col></Row>
      {error && <Alert color="danger" toggle={() => setError("")}>{error}</Alert>}
      {notice && <Alert color="success" toggle={() => setNotice("")}>{notice}</Alert>}
      <Row>
        <Col xl={4}>
          <Card><CardHeader><h5 className="card-title mb-0">{t("Create taxonomy")}</h5></CardHeader><CardBody>
            <Form onSubmit={createTaxonomy}>
              <div className="mb-3"><Label>{t("Machine key")} *</Label><Input required pattern="[a-z][a-z0-9_-]{0,63}" maxLength={64} value={key} onChange={event=>setKey(event.target.value)} placeholder="topics" /></div>
              <div className="mb-3"><Label>{t("Display name")} *</Label><Input required maxLength={120} value={name} onChange={event=>setName(event.target.value)} placeholder={t("Topics")} /></div>
              <div className="mb-3"><Label>{t("Description")}</Label><Input type="textarea" rows={2} value={description} onChange={event=>setDescription(event.target.value)} maxLength={1000} /></div>
              <div className="form-check form-switch mb-3"><Input className="form-check-input" type="switch" id="taxonomy-hierarchical" checked={hierarchical} onChange={event=>setHierarchical(event.target.checked)} /><Label className="form-check-label" for="taxonomy-hierarchical">{t("Allow parent and child terms")}</Label></div>
              <Button block color="primary" type="submit" disabled={saving}>{saving ? <Spinner size="sm" className="me-2" /> : null}{t("Create taxonomy")}</Button>
            </Form>
          </CardBody></Card>
          <Card><CardHeader><h5 className="card-title mb-0">{t("Taxonomies")}</h5></CardHeader><CardBody>
            {loading && <div className="text-center py-3"><Spinner size="sm" /></div>}
            {taxonomies.map(item=><button key={item.id} type="button" className={`w-100 text-start border rounded p-3 mb-2 ${selectedId===item.id?"border-primary bg-light":""}`} onClick={()=>setSelectedId(item.id)}><div className="d-flex justify-content-between"><strong>{item.name}</strong><Badge color="light" className="text-dark">{item._count?.terms ?? 0}</Badge></div><small className="text-muted"><code>{item.key}</code></small><div className="small text-muted">{item.isHierarchical ? t("Hierarchical") : t("Flat")}</div></button>)}
            {!loading && taxonomies.length===0 && <div className="text-muted small">{t("No taxonomies yet")}</div>}
          </CardBody></Card>
        </Col>
        <Col xl={8}>
          <Card><CardHeader className="d-flex justify-content-between align-items-center"><h5 className="card-title mb-0">{selected ? t("Terms in") + " " + selected.name : t("Terms")}</h5><Button color="light" size="sm" onClick={()=>void loadTerms(selectedId)} disabled={!selectedId}><i className="ri-refresh-line me-1" />{t("Refresh")}</Button></CardHeader><CardBody>
            {selected && <Form onSubmit={addTerm} className="border rounded p-3 mb-4"><h6 className="mb-3">{t("Add term")}</h6><Row className="g-2">
              <Col md={6}><Label>{t("Term name")} *</Label><Input required maxLength={160} value={termName} onChange={event=>setTermName(event.target.value)} /></Col>
              <Col md={6}><Label>{t("Slug")} *</Label><Input required maxLength={180} value={termSlug} onChange={event=>{setTermSlug(event.target.value);setSlugTouched(true);}} /></Col>
              {selected.isHierarchical && <Col md={6}><Label>{t("Parent term")}</Label><Input type="select" value={parentId} onChange={event=>setParentId(event.target.value)}><option value="">{t("No parent")}</option>{terms.filter(term=>term.isActive).map(term=><option key={term.id} value={term.id}>{term.name}</option>)}</Input></Col>}
              <Col md={selected.isHierarchical?6:12}><Label>{t("Description")}</Label><Input value={termDescription} onChange={event=>setTermDescription(event.target.value)} maxLength={2000} /></Col>
              <Col xs={12} className="text-end"><Button type="submit" color="primary" disabled={saving}>{saving ? <Spinner size="sm" className="me-2" /> : null}{t("Add term")}</Button></Col>
            </Row></Form>}
            {!selected && !loading && <div className="text-center text-muted py-5">{t("Select a taxonomy to manage its terms")}</div>}
            {selected && <div className="table-responsive"><Table responsive hover className="align-middle"><thead className="table-light"><tr><th>{t("Term")}</th><th>{t("Content count")}</th><th>{t("Translations")}</th><th>{t("Status")}</th><th>{t("Actions")}</th></tr></thead><tbody>{renderTermRows(termsByParent.get(null) ?? [])}{terms.length===0 && <tr><td colSpan={5} className="text-center text-muted py-4">{t("No terms yet")}</td></tr>}</tbody></Table></div>}
          </CardBody></Card>
          {translateTerm && <Card><CardHeader className="d-flex justify-content-between align-items-center"><h5 className="card-title mb-0">{t("Translate term")}: {translateTerm.name}</h5><Button close aria-label={t("Close")} onClick={()=>setTranslateTerm(null)} /></CardHeader><CardBody><Form onSubmit={saveTranslation}><Row className="g-3">
            <Col md={4}><Label>{t("Language")}</Label><Input type="select" value={translationLocale} onChange={event=>setTranslationLocale(event.target.value)}>{locales.map(locale=><option key={locale.id} value={locale.code}>{locale.nativeName} ({locale.code})</option>)}</Input></Col>
            <Col md={4}><Label>{t("Translated name")}</Label><Input required value={translationName} onChange={event=>setTranslationName(event.target.value)} maxLength={160} /></Col>
            <Col md={4}><Label>{t("Translated slug")}</Label><Input required value={translationSlug} onChange={event=>setTranslationSlug(event.target.value)} maxLength={180} /></Col>
            <Col xs={12}><Label>{t("Description")}</Label><Input type="textarea" rows={2} value={translationDescription} onChange={event=>setTranslationDescription(event.target.value)} maxLength={2000} /></Col>
            <Col xs={12} className="text-end"><Button type="button" color="light" className="me-2" onClick={()=>setTranslateTerm(null)}>{t("Cancel")}</Button><Button color="primary" type="submit" disabled={saving}>{t("Save translation")}</Button></Col>
          </Row></Form></CardBody></Card>}
        </Col>
      </Row>
    </Container>
  </div>;
}
