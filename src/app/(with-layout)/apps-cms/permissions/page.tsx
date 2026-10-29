"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, CardBody, CardHeader, Col, Container, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsPermissionState } from "@/helpers/cmsApi";

function getError(error:unknown):string{const value=error as {response?:{data?:{message?:string|string[]}};message?:string};const message=value?.response?.data?.message??value?.message;return Array.isArray(message)?message.join(", "):message??"Request failed."}
type RoleName="ADMIN"|"MANAGER"|"USER";
export default function CmsPermissionsPage(){
 const {t,i18n}=useTranslation();
 const [catalog,setCatalog]=useState<CmsPermissionState[]>([]);
 const [role,setRole]=useState<"MANAGER"|"USER">("MANAGER");
 const [grants,setGrants]=useState<string[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [savedGrants,setSavedGrants]=useState<string[]>([]);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const result=await cmsApi.permissions();setCatalog(result.catalog);const selected=result.roles.find(item=>item.role===role)?.permissionCodes??[];setGrants(selected);setSavedGrants(selected);}
  catch(cause){setError(getError(cause));}
  finally{setLoading(false);}
 },[role]);
 useEffect(()=>{void load();},[load]);
 const changeRole=(next:"MANAGER"|"USER")=>{setRole(next);setNotice("");};
 const toggle=(code:string,checked:boolean)=>setGrants(current=>checked?[...new Set([...current,code])]:current.filter(value=>value!==code));
 const save=async()=>{
  setSaving(true);setError("");setNotice("");
  try{await cmsApi.updateRolePermissions(role,grants);setSavedGrants([...grants]);setNotice(t("Role permissions saved"));}
  catch(cause){setError(getError(cause));}
  finally{setSaving(false);}
 };
 const dirty=[...grants].sort().join("|")!==[...savedGrants].sort().join("|");
 const grouped = new Map<string,CmsPermissionState[]>();
 for(const permission of catalog){const group=permission.code.split(".").slice(0,2).join(".");const values=grouped.get(group)??[];values.push(permission);grouped.set(group,values);}
 return <div className="page-content" dir={["fa","ar"].includes(i18n.language.split("-")[0])?"rtl":"ltr"}><Container fluid>
  <Row className="align-items-center mb-4"><Col><h4 className="mb-1">{t("CMS role permissions")}</h4><p className="text-muted mb-0">{t("Configure permission grants for Manager and User roles. Admin always retains all CMS permissions.")}</p></Col><Col xs="auto"><Link href="/apps-cms/content" className="btn btn-light">{t("Back to content")}</Link></Col></Row>
  {error&&<Alert color="danger" toggle={()=>setError("")}>{error}</Alert>}{notice&&<Alert color="success" toggle={()=>setNotice("")}>{notice}</Alert>}
  <Card><CardHeader className="d-flex align-items-center justify-content-between flex-wrap gap-2"><h5 className="card-title mb-0">{t("Permission matrix")}</h5><div className="d-flex gap-2 align-items-center"><Label className="mb-0">{t("Role")}</Label><Input type="select" style={{minWidth:160}} value={role} onChange={event=>changeRole(event.target.value as "MANAGER"|"USER")}><option value="MANAGER">{t("Manager")}</option><option value="USER">{t("User")}</option></Input><Button color="light" onClick={()=>void load()} disabled={loading}><i className="ri-refresh-line"/></Button></div></CardHeader><CardBody>
   {loading&&<div className="text-center py-4"><Spinner/></div>}
   {!loading&&<><div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3"><div className="text-muted small">{t("Granted permissions")}: <strong>{grants.length}</strong> / {catalog.length}</div><div className="d-flex gap-2"><Button color="light" size="sm" onClick={()=>setGrants(catalog.map(item=>item.code))}>{t("Select all")}</Button><Button color="light" size="sm" onClick={()=>setGrants([])}>{t("Clear all")}</Button><Button color="primary" disabled={!dirty||saving} onClick={()=>void save()}>{saving?<Spinner size="sm" className="me-2"/>:null}{t("Save permissions")}</Button></div></div>
   {[...grouped.entries()].map(([group,permissions])=><div className="border rounded mb-3" key={group}><div className="bg-light-subtle p-3 d-flex justify-content-between"><strong>{t(group)}</strong><small className="text-muted">{permissions.filter(item=>grants.includes(item.code)).length} / {permissions.length}</small></div><div className="table-responsive"><Table responsive className="align-middle mb-0"><thead><tr><th style={{width:60}}>{t("Allow")}</th><th>{t("Permission")}</th><th>{t("Code")}</th><th>{t("Description")}</th></tr></thead><tbody>
    {permissions.map(permission=><tr key={permission.code}><td><Input type="checkbox" checked={grants.includes(permission.code)} onChange={event=>toggle(permission.code,event.target.checked)} aria-label={permission.code}/></td><td><div className="fw-medium">{t(permission.name)}</div></td><td><code>{permission.code}</code></td><td className="text-muted small">{t(permission.description)}</td></tr>)}
   </tbody></Table></div></div>)}
   <div className="d-flex justify-content-end"><Button color="primary" disabled={!dirty||saving} onClick={()=>void save()}>{saving?<Spinner size="sm" className="me-2"/>:null}{t("Save permissions")}</Button></div></>}
  </CardBody></Card>
  <Alert color="info">{t("The API enforces these permissions on CMS endpoints. Existing legacy dashboard screens outside the CMS do not automatically inherit this permission matrix.")}</Alert>
 </Container></div>;
}
