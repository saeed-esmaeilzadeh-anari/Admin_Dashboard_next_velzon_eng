"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, CardBody, CardHeader, Col, Container, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { CmsAuditLog, cmsApi } from "@/helpers/cmsApi";

function getError(error:unknown):string{const value=error as {response?:{data?:{message?:string|string[]}};message?:string};const message=value?.response?.data?.message??value?.message;return Array.isArray(message)?message.join(", "):message??"Request failed."}
export default function CmsAuditLogPage(){
 const {t,i18n}=useTranslation();
 const [items,setItems]=useState<CmsAuditLog[]>([]);
 const [search,setSearch]=useState("");
 const [action,setAction]=useState("");
 const [entity,setEntity]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [page,setPage]=useState(1);
 const [pages,setPages]=useState(1);
 const [total,setTotal]=useState(0);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const result=await cmsApi.auditLogs({page,limit:50,...(search.trim()?{search:search.trim()}:{}),...(action.trim()?{action:action.trim()}:{}),...(entity.trim()?{entity:entity.trim()}:{})});setItems(result.data);setPages(result.pagination.pages);setTotal(result.pagination.total);}
  catch(cause){setError(getError(cause));}
  finally{setLoading(false);}
 },[page,search,action,entity]);
 useEffect(()=>{void load();},[load]);
 return <div className="page-content" dir={["fa","ar"].includes(i18n.language.split("-")[0])?"rtl":"ltr"}><Container fluid>
  <Row className="align-items-center mb-4"><Col><h4 className="mb-1">{t("CMS audit log")}</h4><p className="text-muted mb-0">{t("Inspect recorded CMS actions and management requests")}</p></Col><Col xs="auto"><Link href="/apps-cms/content" className="btn btn-light">{t("Back to content")}</Link></Col></Row>
  {error&&<Alert color="danger" toggle={()=>setError("")}>{error}</Alert>}
  <Card><CardHeader className="d-flex justify-content-between align-items-center"><h5 className="card-title mb-0">{t("Activity history")}</h5><Button color="light" size="sm" onClick={()=>void load()} disabled={loading}><i className="ri-refresh-line me-1"/>{t("Refresh")}</Button></CardHeader><CardBody>
   <Row className="g-3 mb-4">
    <Col md={5}><Label>{t("Search")}</Label><Input value={search} onChange={event=>{setPage(1);setSearch(event.target.value)}} placeholder={t("Search action, entity or record ID")}/></Col>
    <Col md={3}><Label>{t("Action")}</Label><Input value={action} onChange={event=>{setPage(1);setAction(event.target.value)}} placeholder="cms.http.post"/></Col>
    <Col md={3}><Label>{t("Entity")}</Label><Input value={entity} onChange={event=>{setPage(1);setEntity(event.target.value)}} placeholder="Content"/></Col>
    <Col md={1} className="d-flex align-items-end"><Button color="primary" block onClick={()=>void load()} disabled={loading}>{t("Apply")}</Button></Col>
   </Row>
   <div className="small text-muted mb-3">{t("Matching entries")}: {total}</div>
   <div className="table-responsive"><Table responsive hover className="align-middle"><thead className="table-light"><tr><th>{t("Date")}</th><th>{t("User")}</th><th>{t("Action")}</th><th>{t("Entity")}</th><th>{t("Record ID")}</th><th>{t("Metadata")}</th></tr></thead><tbody>
    {loading&&<tr><td colSpan={6} className="text-center py-5"><Spinner size="sm" className="me-2"/>{t("Loading")}</td></tr>}
    {!loading&&items.map(item=><tr key={item.id}><td><div className="text-nowrap">{new Date(item.createdAt).toLocaleString(i18n.language==="fa"?"fa-IR":"en-US")}</div></td><td><div className="fw-medium">{item.user?.name??t("System")}</div><small className="text-muted">{item.user?.email??item.userId??"—"}</small></td><td><code>{item.action}</code></td><td>{item.entity}</td><td><code>{item.entityId??"—"}</code></td><td style={{minWidth:220}}><details><summary>{t("View details")}</summary><pre className="small text-wrap mt-2 mb-0">{JSON.stringify(item.metadata??{},null,2)}</pre></details></td></tr>)}
    {!loading&&items.length===0&&<tr><td colSpan={6} className="text-center text-muted py-5">{t("No audit entries found")}</td></tr>}
   </tbody></Table></div>
   <div className="d-flex justify-content-between align-items-center mt-3"><span className="small text-muted">{t("Page")} {page} / {Math.max(1,pages)}</span><div className="d-flex gap-2"><Button color="light" disabled={page<=1||loading} onClick={()=>setPage(current=>Math.max(1,current-1))}>{t("Previous")}</Button><Button color="light" disabled={page>=pages||loading} onClick={()=>setPage(current=>Math.min(pages,current+1))}>{t("Next")}</Button></div></div>
  </CardBody></Card>
  <Alert color="info">{t("Audit rows are recorded for successful authenticated CMS management requests, and additional business-level events are recorded by the content workflow. Do not log passwords, webhook secrets or raw form response bodies.")}</Alert>
 </Container></div>;
}
