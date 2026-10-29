"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsLocale, CmsRedirect } from "@/helpers/cmsApi";

function getError(error: unknown): string {
  const value = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message) ? message.join(", ") : message ?? "Request failed.";
}
export default function CmsRedirectsPage() {
  const {t,i18n}=useTranslation();
  const [items,setItems]=useState<CmsRedirect[]>([]);
  const [locales,setLocales]=useState<CmsLocale[]>([]);
  const [loading,setLoading]=useState(true);
  const [saving,setSaving]=useState(false);
  const [busyId,setBusyId]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [sourcePath,setSourcePath]=useState("");
  const [destinationPath,setDestinationPath]=useState("");
  const [statusCode,setStatusCode]=useState(301);
  const [localeCode,setLocaleCode]=useState("");
  const [editId,setEditId]=useState("");

  const load=useCallback(async()=>{
    setLoading(true);setError("");
    try{const [nextItems,nextLocales]=await Promise.all([cmsApi.redirects(),cmsApi.locales(true)]);setItems(nextItems);setLocales(nextLocales.filter(item=>item.isActive));}
    catch(cause){setError(getError(cause));}
    finally{setLoading(false);}
  },[]);
  useEffect(()=>{void load();},[load]);
  const reset=()=>{setSourcePath("");setDestinationPath("");setStatusCode(301);setLocaleCode("");setEditId("");};
  const startEdit=(item:CmsRedirect)=>{setEditId(item.id);setSourcePath(item.sourcePath);setDestinationPath(item.destinationPath);setStatusCode(item.statusCode);setLocaleCode(item.locale?.code??"");};
  const save=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSaving(true);setError("");setNotice("");
    try{
      if(editId) await cmsApi.updateRedirect(editId,{sourcePath:sourcePath.trim(),destinationPath:destinationPath.trim(),statusCode,localeCode:localeCode||null});
      else await cmsApi.createRedirect({sourcePath:sourcePath.trim(),destinationPath:destinationPath.trim(),statusCode,localeCode:localeCode||null});
      reset();await load();setNotice(t(editId?"Redirect updated":"Redirect created"));
    }catch(cause){setError(getError(cause));}
    finally{setSaving(false);}
  };
  const toggle=async(item:CmsRedirect)=>{
    setBusyId(item.id);setError("");setNotice("");
    try{await cmsApi.updateRedirect(item.id,{isActive:!item.isActive});await load();setNotice(t("Redirect updated"));}
    catch(cause){setError(getError(cause));}
    finally{setBusyId("");}
  };
  const resolve=async(item:CmsRedirect)=>{
    setBusyId(item.id);setError("");setNotice("");
    try{const result=await cmsApi.resolveRedirect(item.sourcePath,item.locale?.code);setNotice(`${item.sourcePath} → ${result.destinationPath} (HTTP ${result.statusCode})`);}
    catch(cause){setError(getError(cause));}
    finally{setBusyId("");}
  };
  return <div className="page-content" dir={["fa","ar"].includes(i18n.language.split("-")[0])?"rtl":"ltr"}><Container fluid>
    <Row className="align-items-center mb-4"><Col><h4 className="mb-1">{t("Redirect manager")}</h4><p className="text-muted mb-0">{t("Configure legacy URLs and locale-aware redirects")}</p></Col><Col xs="auto"><Link href="/apps-cms/content" className="btn btn-light">{t("Back to content")}</Link></Col></Row>
    {error&&<Alert color="danger" toggle={()=>setError("")}>{error}</Alert>}{notice&&<Alert color="success" toggle={()=>setNotice("")}>{notice}</Alert>}
    <Row>
      <Col xl={4}><Card><CardHeader><h5 className="card-title mb-0">{t(editId?"Edit redirect":"Add redirect")}</h5></CardHeader><CardBody><Form onSubmit={save}>
        <div className="mb-3"><Label>{t("Source path")} *</Label><Input required maxLength={2048} pattern="/(?!/).*" value={sourcePath} onChange={event=>setSourcePath(event.target.value)} placeholder="/old-page"/></div>
        <div className="mb-3"><Label>{t("Destination path or HTTPS URL")} *</Label><Input required maxLength={2048} value={destinationPath} onChange={event=>setDestinationPath(event.target.value)} placeholder="/new-page"/></div>
        <div className="mb-3"><Label>{t("Redirect status")}</Label><Input type="select" value={statusCode} onChange={event=>setStatusCode(Number(event.target.value))}>{[301,302,307,308].map(code=><option key={code} value={code}>{code} — {code===301?"Permanent":code===302?"Temporary":code===307?"Temporary (method preserving)":"Permanent (method preserving)"}</option>)}</Input></div>
        <div className="mb-3"><Label>{t("Language (optional)")}</Label><Input type="select" value={localeCode} onChange={event=>setLocaleCode(event.target.value)}><option value="">{t("All languages")}</option>{locales.map(locale=><option key={locale.id} value={locale.code}>{locale.nativeName} ({locale.code})</option>)}</Input></div>
        <div className="d-flex gap-2"><Button color="primary" type="submit" disabled={saving}>{saving?<Spinner size="sm" className="me-2"/>:null}{t("Save redirect")}</Button>{editId&&<Button color="light" type="button" onClick={reset}>{t("Cancel")}</Button>}</div>
      </Form></CardBody></Card><Alert color="warning">{t("Redirect records are resolved through the API. Connect the public site or Next.js middleware to the redirect resolver before expecting browser requests to follow them automatically.")}</Alert></Col>
      <Col xl={8}><Card><CardHeader className="d-flex justify-content-between align-items-center"><h5 className="card-title mb-0">{t("Configured redirects")}</h5><Button color="light" size="sm" onClick={()=>void load()} disabled={loading}><i className="ri-refresh-line me-1"/>{t("Refresh")}</Button></CardHeader><CardBody>
        {loading&&<div className="text-center py-4"><Spinner/></div>}
        {!loading&&<div className="table-responsive"><Table responsive hover className="align-middle"><thead className="table-light"><tr><th>{t("Source")}</th><th>{t("Destination")}</th><th>{t("Language")}</th><th>{t("Status")}</th><th>{t("Hits")}</th><th>{t("Actions")}</th></tr></thead><tbody>
          {items.map(item=><tr key={item.id}><td><code>{item.sourcePath}</code></td><td><code className="text-break">{item.destinationPath}</code><div className="small text-muted">HTTP {item.statusCode}</div></td><td>{item.locale?.code??t("All languages")}</td><td><Badge color={item.isActive?"success":"secondary"}>{t(item.isActive?"Active":"Inactive")}</Badge></td><td>{item.hitCount}</td><td><div className="d-flex gap-1 flex-wrap"><Button size="sm" color="light" onClick={()=>startEdit(item)}>{t("Edit")}</Button><Button size="sm" color="light" disabled={busyId===item.id} onClick={()=>void resolve(item)}>{t("Test")}</Button><Button size="sm" outline color={item.isActive?"warning":"success"} disabled={busyId===item.id} onClick={()=>void toggle(item)}>{t(item.isActive?"Disable":"Enable")}</Button></div></td></tr>)}
          {items.length===0&&<tr><td colSpan={6} className="text-center text-muted py-5">{t("No redirects configured")}</td></tr>}
        </tbody></Table></div>}
      </CardBody></Card></Col>
    </Row>
  </Container></div>;
}
