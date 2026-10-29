"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsFormDefinition } from "@/helpers/cmsApi";

type DraftField={key:string;label:string;type:string;required:boolean;maxLength:number;options:string};
const defaultField=():DraftField=>({key:"email",label:"Email",type:"email",required:true,maxLength:254,options:""});
const fieldTypes=["text","textarea","email","phone","number","checkbox","select","multiselect","date","url"];
function getError(error:unknown):string{const value=error as {response?:{data?:{message?:string|string[]}};message?:string};const message=value?.response?.data?.message??value?.message;return Array.isArray(message)?message.join(", "):message??"Request failed."}
export default function CmsFormsPage(){
 const {t,i18n}=useTranslation();
 const [forms,setForms]=useState<CmsFormDefinition[]>([]);
 const [selectedId,setSelectedId]=useState("");
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [busyId,setBusyId]=useState("");
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [key,setKey]=useState("contact");
 const [name,setName]=useState("");
 const [description,setDescription]=useState("");
 const [successMessage,setSuccessMessage]=useState("Thank you, your message has been received.");
 const [fields,setFields]=useState<DraftField[]>([{...defaultField()}]);
 const [submissions,setSubmissions]=useState<Array<Record<string,unknown>>>([]);
 const [submissionStatus,setSubmissionStatus]=useState("NEW");
 const [submissionNote,setSubmissionNote]=useState<Record<string,string>>({});
 const selected=forms.find(form=>form.id===selectedId);

 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{const next=await cmsApi.forms();setForms(next);setSelectedId(current=>current||next[0]?.id||"");}
  catch(cause){setError(getError(cause));}
  finally{setLoading(false);}
 },[]);
 const loadSubmissions=useCallback(async(id:string,status="")=>{
  if(!id){setSubmissions([]);return;}
  try{const result=await cmsApi.formSubmissions(id,{page:1,limit:100,...(status?{status}:{})});setSubmissions(result.data as Array<Record<string,unknown>>);}
  catch(cause){setError(getError(cause));}
 },[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{void loadSubmissions(selectedId,submissionStatus);},[loadSubmissions,selectedId,submissionStatus]);
 const create=async(event:React.FormEvent<HTMLFormElement>)=>{
  event.preventDefault();setSaving(true);setError("");setNotice("");
  try{
   const schema={fields:fields.map((field,index)=>({key:field.key.trim(),label:field.label.trim(),type:field.type,required:field.required,maxLength:field.maxLength,...(["select","multiselect"].includes(field.type)?{options:field.options.split(",").map(value=>value.trim()).filter(Boolean)}:{})}))};
   const created=await cmsApi.createForm({key:key.trim(),name:name.trim(),description:description.trim(),successMessage, schema});
   setName("");setDescription("");setKey("");setFields([{...defaultField()}]);await load();setSelectedId(created.id);setNotice(t("Form created"));
  }catch(cause){setError(getError(cause));}
  finally{setSaving(false);}
 };
 const updateForm=async(form:CmsFormDefinition,active:boolean)=>{
  setBusyId(form.id);setError("");setNotice("");
  try{await cmsApi.updateForm(form.id,{isActive:active});await load();setNotice(t("Form settings updated"));}
  catch(cause){setError(getError(cause));}
  finally{setBusyId("");}
 };
 const updateSubmission=async(submission:Record<string,unknown>,status:"NEW"|"REVIEWED"|"RESOLVED"|"SPAM")=>{
  if(!selected)return;
  const id=String(submission.id??"");setBusyId(id);setError("");setNotice("");
  try{await cmsApi.updateFormSubmission(selected.id,id,{status,internalNote:submissionNote[id]??(typeof submission.internalNote==="string"?submission.internalNote:"")});await loadSubmissions(selected.id,submissionStatus);setNotice(t("Submission updated"));}
  catch(cause){setError(getError(cause));}
  finally{setBusyId("");}
 };
 const submissionData=(submission:Record<string,unknown>)=>typeof submission.data==="object"&&submission.data!==null?Object.entries(submission.data as Record<string,unknown>).map(([key,value])=>`${key}: ${typeof value==="string"?value:JSON.stringify(value)}`).join(" · "):"";

 return <div className="page-content" dir={["fa","ar"].includes(i18n.language.split("-")[0])?"rtl":"ltr"}><Container fluid>
  <Row className="align-items-center mb-4"><Col><h4 className="mb-1">{t("Forms and submissions")}</h4><p className="text-muted mb-0">{t("Configure validated public forms and manage submitted responses")}</p></Col><Col xs="auto"><Link href="/apps-cms/content" className="btn btn-light">{t("Back to content")}</Link></Col></Row>
  {error&&<Alert color="danger" toggle={()=>setError("")}>{error}</Alert>}{notice&&<Alert color="success" toggle={()=>setNotice("")}>{notice}</Alert>}
  <Row>
   <Col xl={4}>
    <Card><CardHeader><h5 className="card-title mb-0">{t("Create form")}</h5></CardHeader><CardBody><Form onSubmit={create}>
     <div className="mb-3"><Label>{t("Machine key")} *</Label><Input required pattern="[a-z][a-z0-9_-]{0,63}" value={key} onChange={event=>setKey(event.target.value)}/></div>
     <div className="mb-3"><Label>{t("Form name")} *</Label><Input required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></div>
     <div className="mb-3"><Label>{t("Description")}</Label><Input value={description} maxLength={2000} onChange={event=>setDescription(event.target.value)}/></div>
     <div className="mb-3"><Label>{t("Success message")}</Label><Input type="textarea" rows={2} maxLength={1000} value={successMessage} onChange={event=>setSuccessMessage(event.target.value)}/></div>
     <hr/><div className="d-flex justify-content-between align-items-center mb-3"><h6 className="mb-0">{t("Fields")}</h6><Button type="button" size="sm" color="light" onClick={()=>setFields(current=>[...current,{...defaultField(),key:"field"+(current.length+1),label:""}])}><i className="ri-add-line me-1"/>{t("Add field")}</Button></div>
     {fields.map((field,index)=><div key={index} className="border rounded p-3 mb-3">
      <div className="d-flex justify-content-between mb-2"><strong>{t("Field")} {index+1}</strong>{fields.length>1&&<Button type="button" color="danger" outline size="sm" onClick={()=>setFields(current=>current.filter((_,i)=>i!==index))}>{t("Remove")}</Button>}</div>
      <Row className="g-2">
       <Col md={6}><Label>{t("Field key")}</Label><Input required pattern="[a-zA-Z][a-zA-Z0-9_-]{0,63}" value={field.key} onChange={event=>setFields(current=>current.map((v,i)=>i===index?{...v,key:event.target.value}:v))}/></Col>
       <Col md={6}><Label>{t("Label")}</Label><Input required maxLength={160} value={field.label} onChange={event=>setFields(current=>current.map((v,i)=>i===index?{...v,label:event.target.value}:v))}/></Col>
       <Col md={7}><Label>{t("Field type")}</Label><Input type="select" value={field.type} onChange={event=>setFields(current=>current.map((v,i)=>i===index?{...v,type:event.target.value}:v))}>{fieldTypes.map(type=><option key={type} value={type}>{type}</option>)}</Input></Col>
       <Col md={5}><Label>{t("Max length")}</Label><Input type="number" min={1} max={20000} value={field.maxLength} onChange={event=>setFields(current=>current.map((v,i)=>i===index?{...v,maxLength:Number(event.target.value)}:v))}/></Col>
       <Col xs={12}><div className="form-check"><Input type="checkbox" id={`required-${index}`} checked={field.required} onChange={event=>setFields(current=>current.map((v,i)=>i===index?{...v,required:event.target.checked}:v))}/><Label check for={`required-${index}`}>{t("Required field")}</Label></div></Col>
       {["select","multiselect"].includes(field.type)&&<Col xs={12}><Label>{t("Options separated by commas")}</Label><Input required value={field.options} onChange={event=>setFields(current=>current.map((v,i)=>i===index?{...v,options:event.target.value}:v))}/></Col>}
      </Row>
     </div>)}
     <Button color="primary" block type="submit" disabled={saving}>{saving?<Spinner size="sm" className="me-2"/>:null}{t("Create form")}</Button>
    </Form></CardBody></Card>
   </Col>
   <Col xl={8}>
    <Card><CardHeader><h5 className="card-title mb-0">{t("Configured forms")}</h5></CardHeader><CardBody>
     {loading&&<Spinner size="sm"/>}
     <div className="table-responsive"><Table responsive hover className="align-middle"><thead className="table-light"><tr><th>{t("Name")}</th><th>{t("Fields")}</th><th>{t("Submissions")}</th><th>{t("Status")}</th><th>{t("Action")}</th></tr></thead><tbody>
      {forms.map(form=><tr key={form.id} className={selectedId===form.id?"table-active":""}><td><button type="button" className="btn btn-link p-0 text-start" onClick={()=>setSelectedId(form.id)}><strong>{form.name}</strong></button><small className="d-block text-muted"><code>{form.key}</code></small></td><td>{form.schema.fields?.length??0}</td><td>{form._count?.submissions??0}</td><td><Badge color={form.isActive?"success":"secondary"}>{t(form.isActive?"Active":"Inactive")}</Badge></td><td><Button size="sm" color="light" disabled={busyId===form.id} onClick={()=>void updateForm(form,!form.isActive)}>{t(form.isActive?"Disable":"Enable")}</Button></td></tr>)}
      {!loading&&forms.length===0&&<tr><td colSpan={5} className="text-center text-muted py-4">{t("No forms created")}</td></tr>}
     </tbody></Table></div>
    </CardBody></Card>
    <Card><CardHeader className="d-flex justify-content-between align-items-center"><div><h5 className="card-title mb-0">{t("Form submissions")}</h5><small className="text-muted">{selected?selected.name:t("Select a form")}</small></div><Input type="select" style={{maxWidth:190}} value={submissionStatus} onChange={event=>setSubmissionStatus(event.target.value)}><option value="">{t("All statuses")}</option>{["NEW","REVIEWED","RESOLVED","SPAM"].map(status=><option key={status} value={status}>{t(status)}</option>)}</Input></CardHeader><CardBody>
     {!selected&&<div className="text-muted py-4 text-center">{t("Select a form to see submissions")}</div>}
     {selected&&<div className="table-responsive"><Table responsive hover className="align-middle"><thead className="table-light"><tr><th>{t("Submitted")}</th><th>{t("Response data")}</th><th>{t("Status and notes")}</th><th>{t("Actions")}</th></tr></thead><tbody>
      {submissions.map(submission=>{const id=String(submission.id??"");const status=String(submission.status??"NEW") as "NEW"|"REVIEWED"|"RESOLVED"|"SPAM";return <tr key={id}><td><div>{typeof submission.createdAt==="string"?new Date(submission.createdAt).toLocaleString(i18n.language==="fa"?"fa-IR":"en-US"):"—"}</div><small className="text-muted">{id.slice(0,8)}</small></td><td style={{minWidth:240}}><div className="small text-break">{submissionData(submission)}</div></td><td style={{minWidth:180}}><Badge color={status==="RESOLVED"?"success":status==="SPAM"?"danger":status==="REVIEWED"?"info":"warning"}>{t(status)}</Badge><Input className="mt-2" type="textarea" rows={2} maxLength={4000} placeholder={t("Internal note")} value={submissionNote[id]??(typeof submission.internalNote==="string"?submission.internalNote:"")} onChange={event=>setSubmissionNote(current=>({...current,[id]:event.target.value}))}/></td><td><div className="d-grid gap-1">{(["REVIEWED","RESOLVED","SPAM","NEW"] as const).map(next=><Button key={next} size="sm" outline color={next==="SPAM"?"danger":next==="RESOLVED"?"success":"secondary"} disabled={busyId===id||status===next} onClick={()=>void updateSubmission(submission,next)}>{t(next)}</Button>)}</div></td></tr>})}
      {submissions.length===0&&<tr><td colSpan={4} className="text-center text-muted py-4">{t("No submissions")}</td></tr>}
     </tbody></Table></div>}
     {selected&&<Alert color="info" className="mb-0">{t("Public form endpoint")}: <code>/api/v1/public/cms/forms/{selected.key}/submissions</code></Alert>}
    </CardBody></Card>
   </Col>
  </Row>
 </Container></div>;
}
