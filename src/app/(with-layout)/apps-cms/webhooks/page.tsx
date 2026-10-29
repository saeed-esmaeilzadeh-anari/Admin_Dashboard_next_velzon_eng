"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsWebhook, CmsWebhookDelivery } from "@/helpers/cmsApi";

function getError(error:unknown):string{const value=error as {response?:{data?:{message?:string|string[]}};message?:string};const message=value?.response?.data?.message??value?.message;return Array.isArray(message)?message.join(", "):message??"Request failed."}
const events=["content.created","content.translation.created","content.updated","content.shared_fields.updated","content.submitted_for_review","content.published","content.scheduled","content.unpublished","content.archived"];
export default function CmsWebhooksPage(){
 const {t,i18n}=useTranslation();
 const [items,setItems]=useState<CmsWebhook[]>([]);
 const [selectedId,setSelectedId]=useState("");
 const [deliveries,setDeliveries]=useState<CmsWebhookDelivery[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [busyId,setBusyId]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [name,setName]=useState("");
 const [endpointUrl,setEndpointUrl]=useState("");
 const [secret,setSecret]=useState("");
 const [selectedEvents,setSelectedEvents]=useState<string[]>(["content.published"]);
 const selected=items.find(item=>item.id===selectedId);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const next=await cmsApi.webhooks();setItems(next);setSelectedId(current=>current||next[0]?.id||"");}
  catch(cause){setError(getError(cause));}
  finally{setLoading(false);}
 },[]);
 const loadDeliveries=useCallback(async(id:string)=>{
  if(!id){setDeliveries([]);return;}
  try{const result=await cmsApi.webhookDeliveries(id,{page:1,limit:50});setDeliveries(result.data);}
  catch(cause){setError(getError(cause));}
 },[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{void loadDeliveries(selectedId);},[loadDeliveries,selectedId]);
 const create=async(event:React.FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setSaving(true);setError("");setNotice("");
  try{
   const created=await cmsApi.createWebhook({name:name.trim(),endpointUrl:endpointUrl.trim(),secret,events:selectedEvents});
   setName("");setEndpointUrl("");setSecret("");setSelectedEvents(["content.published"]);await load();setSelectedId(created.id);setNotice(t("Webhook created"));
  }catch(cause){setError(getError(cause));}
  finally{setSaving(false);}
 };
 const toggle=async(item:CmsWebhook)=>{
  setBusyId(item.id);setError("");setNotice("");
  try{await cmsApi.updateWebhook(item.id,{isActive:!item.isActive});await load();setNotice(t("Webhook settings updated"));}
  catch(cause){setError(getError(cause));}
  finally{setBusyId("");}
 };
 const remove=async(item:CmsWebhook)=>{
  if(!window.confirm(t("Delete this webhook and its delivery history?")))return;
  setBusyId(item.id);setError("");setNotice("");
  try{await cmsApi.deleteWebhook(item.id);if(selectedId===item.id){setSelectedId("");setDeliveries([]);}await load();setNotice(t("Webhook deleted"));}
  catch(cause){setError(getError(cause));}
  finally{setBusyId("");}
 };
 const retry=async(delivery:CmsWebhookDelivery)=>{
  if(!selected)return;
  setBusyId(delivery.id);setError("");setNotice("");
  try{await cmsApi.retryWebhookDelivery(selected.id,delivery.id);await loadDeliveries(selected.id);setNotice(t("Webhook delivery queued for retry"));}
  catch(cause){setError(getError(cause));}
  finally{setBusyId("");}
 };
 return <div className="page-content" dir={["fa","ar"].includes(i18n.language.split("-")[0])?"rtl":"ltr"}><Container fluid>
  <Row className="align-items-center mb-4"><Col><h4 className="mb-1">{t("Webhooks")}</h4><p className="text-muted mb-0">{t("Configure signed HTTPS callbacks and inspect delivery attempts")}</p></Col><Col xs="auto"><Link href="/apps-cms/content" className="btn btn-light">{t("Back to content")}</Link></Col></Row>
  {error&&<Alert color="danger" toggle={()=>setError("")}>{error}</Alert>}{notice&&<Alert color="success" toggle={()=>setNotice("")}>{notice}</Alert>}
  <Row>
   <Col xl={4}><Card><CardHeader><h5 className="card-title mb-0">{t("Register webhook")}</h5></CardHeader><CardBody><Form onSubmit={create}>
    <div className="mb-3"><Label>{t("Webhook name")} *</Label><Input required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></div>
    <div className="mb-3"><Label>{t("HTTPS endpoint")} *</Label><Input required type="url" pattern="https://.*" value={endpointUrl} onChange={event=>setEndpointUrl(event.target.value)} placeholder="https://example.com/hooks/cms"/></div>
    <div className="mb-3"><Label>{t("Signing secret")} *</Label><Input required minLength={32} maxLength={256} type="password" value={secret} onChange={event=>setSecret(event.target.value)} autoComplete="new-password"/><small className="text-muted">{t("Use at least 32 random characters. Keep the secret in a password manager.")}</small></div>
    <div className="mb-3"><Label>{t("Events")} *</Label><div className="border rounded p-2" style={{maxHeight:260,overflowY:"auto"}}>{events.map(key=><div className="form-check" key={key}><Input type="checkbox" id={`hook-${key}`} checked={selectedEvents.includes(key)} onChange={event=>setSelectedEvents(current=>event.target.checked?[...current,key]:current.filter(value=>value!==key))}/><Label check for={`hook-${key}`}><code>{key}</code></Label></div>)}</div>{selectedEvents.length===0&&<small className="text-danger">{t("Select at least one event")}</small>}</div>
    <Button color="primary" block type="submit" disabled={saving||selectedEvents.length===0}>{saving?<Spinner size="sm" className="me-2"/>:null}{t("Create webhook")}</Button>
   </Form></CardBody></Card><Alert color="warning">{t("Webhook events are signed with HMAC-SHA256. Delivery requests are restricted to public HTTPS hostnames and retried with backoff.")}</Alert></Col>
   <Col xl={8}>
    <Card><CardHeader className="d-flex justify-content-between align-items-center"><h5 className="card-title mb-0">{t("Configured webhooks")}</h5><Button size="sm" color="light" onClick={()=>void load()} disabled={loading}><i className="ri-refresh-line me-1"/>{t("Refresh")}</Button></CardHeader><CardBody>
     {loading&&<Spinner size="sm"/>}
     <div className="table-responsive"><Table responsive hover className="align-middle"><thead className="table-light"><tr><th>{t("Name")}</th><th>{t("Endpoint")}</th><th>{t("Events")}</th><th>{t("Status")}</th><th>{t("Actions")}</th></tr></thead><tbody>
      {items.map(item=><tr key={item.id} className={selectedId===item.id?"table-active":""}><td><button type="button" className="btn btn-link p-0 text-start" onClick={()=>setSelectedId(item.id)}><strong>{item.name}</strong></button><small className="d-block text-muted">{item._count?.deliveries??0} {t("deliveries")}</small></td><td className="text-break"><small>{item.endpointUrl}</small></td><td style={{maxWidth:180}}>{item.events.map(value=><Badge key={value} color="light" className="text-dark me-1 mb-1">{value}</Badge>)}</td><td><Badge color={item.isActive?"success":"secondary"}>{t(item.isActive?"Active":"Inactive")}</Badge></td><td><div className="d-grid gap-1"><Button size="sm" color="light" disabled={busyId===item.id} onClick={()=>void toggle(item)}>{t(item.isActive?"Disable":"Enable")}</Button><Button size="sm" outline color="danger" disabled={busyId===item.id} onClick={()=>void remove(item)}>{t("Delete")}</Button></div></td></tr>)}
      {items.length===0&&!loading&&<tr><td colSpan={5} className="text-center text-muted py-4">{t("No webhooks configured")}</td></tr>}
     </tbody></Table></div>
    </CardBody></Card>
    <Card><CardHeader className="d-flex justify-content-between align-items-center"><div><h5 className="card-title mb-0">{t("Delivery history")}</h5><small className="text-muted">{selected?.name??t("Select a webhook")}</small></div><Button color="light" size="sm" disabled={!selectedId} onClick={()=>void loadDeliveries(selectedId)}><i className="ri-refresh-line"/></Button></CardHeader><CardBody>
     {selected&&<div className="table-responsive"><Table responsive hover className="align-middle"><thead className="table-light"><tr><th>{t("Event")}</th><th>{t("Status")}</th><th>{t("Attempts")}</th><th>{t("Last error")}</th><th>{t("Actions")}</th></tr></thead><tbody>
      {deliveries.map(delivery=><tr key={delivery.id}><td><code>{delivery.eventKey}</code><small className="d-block text-muted">{new Date(delivery.createdAt).toLocaleString(i18n.language==="fa"?"fa-IR":"en-US")}</small></td><td><Badge color={delivery.status==="SUCCESS"?"success":delivery.status==="FAILED"?"danger":delivery.status==="PROCESSING"?"info":"warning"}>{t(delivery.status)}</Badge>{delivery.responseStatus&&<small className="d-block text-muted">HTTP {delivery.responseStatus}</small>}</td><td>{delivery.attempts}</td><td className="text-break small">{delivery.lastError??"—"}</td><td>{delivery.status==="FAILED"&&<Button size="sm" outline color="primary" disabled={busyId===delivery.id} onClick={()=>void retry(delivery)}>{t("Retry")}</Button>}</td></tr>)}
      {deliveries.length===0&&<tr><td colSpan={5} className="text-center text-muted py-4">{t("No deliveries yet")}</td></tr>}
     </tbody></Table></div>}
    </CardBody></Card>
   </Col>
  </Row>
 </Container></div>;
}
