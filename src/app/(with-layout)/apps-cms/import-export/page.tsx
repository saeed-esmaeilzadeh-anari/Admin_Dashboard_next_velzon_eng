"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { CmsImportResult, cmsApi } from "@/helpers/cmsApi";

function errorMessage(error: unknown): string {
  const value = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message) ? message.join(", ") : message ?? "Request failed.";
}
export default function CmsImportExportPage() {
  const {t,i18n}=useTranslation();
  const [file,setFile]=useState<File|null>(null);
  const [exportLimit,setExportLimit]=useState(5000);
  const [exporting,setExporting]=useState(false);
  const [importing,setImporting]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [result,setResult]=useState<CmsImportResult|null>(null);

  const exportData=async()=>{
    setExporting(true);setError("");setNotice("");setResult(null);
    try{
      const data=await cmsApi.exportContents(exportLimit);
      const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json;charset=utf-8"});
      const url=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=url;
      anchor.download=`cms-export-${new Date().toISOString().replace(/[:.]/g,"-")}.json`;
      document.body.appendChild(anchor);anchor.click();anchor.remove();URL.revokeObjectURL(url);
      setNotice(data.truncated?t("Export downloaded but was truncated at the configured record limit"):t("Export downloaded successfully"));
    }catch(cause){setError(errorMessage(cause));}
    finally{setExporting(false);}
  };
  const importData=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!file)return;
    setImporting(true);setError("");setNotice("");setResult(null);
    try{
      const parsed=JSON.parse(await file.text()) as {schemaVersion?:unknown;records?:unknown};
      if(parsed.schemaVersion!==1||!Array.isArray(parsed.records))throw new Error(t("Invalid CMS export package. Choose a schemaVersion 1 JSON export."));
      if(parsed.records.length<1||parsed.records.length>100)throw new Error(t("Import packages must contain between 1 and 100 content records."));
      const normalized = {
        schemaVersion: 1 as const,
        records: parsed.records.map((rawRecord) => {
          if (typeof rawRecord !== "object" || rawRecord === null || Array.isArray(rawRecord)) throw new Error(t("Each import record must be an object."));
          const record = rawRecord as Record<string, unknown>;
          if (typeof record.typeKey !== "string" || !Array.isArray(record.translations)) throw new Error(t("Each import record needs a type key and translations."));
          const translations = record.translations.map((rawTranslation) => {
            if (typeof rawTranslation !== "object" || rawTranslation === null || Array.isArray(rawTranslation)) throw new Error(t("Each translation must be an object."));
            const translation = rawTranslation as Record<string, unknown>;
            return {
              localeCode: translation.localeCode,
              title: translation.title,
              slug: translation.slug,
              excerpt: translation.excerpt,
              seoTitle: translation.seoTitle,
              seoDescription: translation.seoDescription,
              fields: translation.fields,
            };
          });
          return { typeKey: record.typeKey, sharedFields: record.sharedFields, translations };
        }),
      };
      const data=await cmsApi.importContents(normalized);
      setResult(data);
      setNotice(t("Import completed: {{imported}} imported, {{partial}} partial, {{failed}} failed",data.summary));
      setFile(null);
      const input=document.getElementById("cms-import-json") as HTMLInputElement|null;
      if(input)input.value="";
    }catch(cause){setError(errorMessage(cause));}
    finally{setImporting(false);}
  };
  return <div className="page-content" dir={["fa","ar"].includes(i18n.language.split("-")[0])?"rtl":"ltr"}><Container fluid>
    <Row className="align-items-center mb-4"><Col><h4 className="mb-1">{t("Import and export")}</h4><p className="text-muted mb-0">{t("Move CMS content and its language versions using a versioned JSON package")}</p></Col><Col xs="auto"><Link href="/apps-cms/content" className="btn btn-light">{t("Back to content")}</Link></Col></Row>
    {error&&<Alert color="danger" toggle={()=>setError("")}>{error}</Alert>}
    {notice&&<Alert color="success" toggle={()=>setNotice("")}>{notice}</Alert>}
    <Row>
      <Col xl={6}>
        <Card><CardHeader><h5 className="card-title mb-0">{t("Export content")}</h5></CardHeader><CardBody>
          <p className="text-muted">{t("Export content types, shared field values and all language versions into a JSON package.")}</p>
          <div className="mb-3"><Label>{t("Maximum records")}</Label><Input type="select" value={exportLimit} onChange={event=>setExportLimit(Number(event.target.value))}>{[100,500,1000,2500,5000].map(value=><option key={value} value={value}>{value.toLocaleString()}</option>)}</Input></div>
          <Button color="primary" onClick={()=>void exportData()} disabled={exporting}>{exporting?<><Spinner size="sm" className="me-2"/>{t("Preparing export")}</>:<><i className="ri-download-2-line me-1"/>{t("Download JSON export")}</>}</Button>
          <hr/>
          <ul className="mb-0">
            <li>{t("The package includes translation fields, slugs and SEO metadata.")}</li>
            <li>{t("Media files are not embedded; fields retain their media asset IDs.")}</li>
            <li>{t("Published states are included as source metadata, but imported content is always created as a draft.")}</li>
          </ul>
        </CardBody></Card>
      </Col>
      <Col xl={6}>
        <Card><CardHeader><h5 className="card-title mb-0">{t("Import content")}</h5></CardHeader><CardBody>
          <Form onSubmit={importData}>
            <div className="mb-3"><Label for="cms-import-json">{t("CMS JSON package")} *</Label><Input id="cms-import-json" type="file" accept="application/json,.json" required onChange={event=>setFile(event.target.files?.[0]??null)}/><small className="text-muted d-block mt-1">{t("Only schemaVersion 1 packages with up to 100 records are accepted per import.")}</small></div>
            {file&&<div className="small text-muted mb-3">{file.name} · {(file.size/1024).toFixed(1)} KB</div>}
            <Button color="success" type="submit" disabled={importing||!file}>{importing?<><Spinner size="sm" className="me-2"/>{t("Importing")}</>:<><i className="ri-upload-2-line me-1"/>{t("Import JSON package")}</>}</Button>
          </Form>
          <hr/>
          <Alert color="warning" className="mb-0">{t("Imported records are created as new content and are not merged with matching slugs. A record may be marked partial if a later translation fails; inspect the result report before retrying.")}</Alert>
        </CardBody></Card>
      </Col>
    </Row>
    {result&&<Card><CardHeader><h5 className="card-title mb-0">{t("Import report")}</h5></CardHeader><CardBody>
      <Row className="g-3 mb-3">
        {[["requested",result.summary.requested,"secondary"],["imported",result.summary.imported,"success"],["partial",result.summary.partial,"warning"],["failed",result.summary.failed,"danger"]].map(([label,count,color])=><Col md={3} key={String(label)}><div className="border rounded p-3"><div className="text-muted small">{t(String(label))}</div><div className="fs-4 fw-semibold"><Badge color={String(color)}>{String(count)}</Badge></div></div></Col>)}
      </Row>
      <div className="table-responsive"><Table responsive hover className="align-middle"><thead className="table-light"><tr><th>{t("Record")}</th><th>{t("Content type")}</th><th>{t("Content ID")}</th><th>{t("Status")}</th><th>{t("Translations imported")}</th><th>{t("Error")}</th></tr></thead><tbody>
        {result.results.map(item=><tr key={item.index}><td>{item.index+1}</td><td><code>{item.typeKey}</code></td><td>{item.contentId?<Link href={`/apps-cms/content/${item.contentId}`}>{item.contentId}</Link>:"—"}</td><td><Badge color={item.status==="IMPORTED"?"success":item.status==="PARTIAL"?"warning":"danger"}>{t(item.status)}</Badge></td><td>{item.translationsImported}</td><td className="text-danger small">{item.error??"—"}</td></tr>)}
      </tbody></Table></div>
    </CardBody></Card>}
  </Container></div>;
}
