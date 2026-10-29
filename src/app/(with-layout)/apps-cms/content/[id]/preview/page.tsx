"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Alert, Button, Container, Spinner } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsContent, CmsLocale, CmsMediaAsset, CmsTranslation } from "@/helpers/cmsApi";
import PagePreview from "@/components/Cms/PagePreview";

function getError(error:unknown):string{const value=error as {response?:{data?:{message?:string|string[]}};message?:string};const message=value?.response?.data?.message??value?.message;return Array.isArray(message)?message.join(", "):message??"Request failed."}
export default function CmsContentPreviewPage(){
 const {t,i18n}=useTranslation();
 const params=useParams<{id:string}>();
 const search=useSearchParams();
 const contentId=params.id;
 const requestedLocale=search.get("localeCode")??"";
 const apiOrigin=useMemo(()=>{
  const base=process.env.NEXT_PUBLIC_BACKEND_API_URL??"http://localhost:3001/api/v1";
  try{return new URL(base).origin;}catch{return "";}
 },[]);
 const [content,setContent]=useState<CmsContent|null>(null);
 const [media,setMedia]=useState<CmsMediaAsset[]>([]);
 const [locales,setLocales]=useState<CmsLocale[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [localeCode,setLocaleCode]=useState(requestedLocale);
 const load=useCallback(async()=>{
  setLoading(true);setError("");
  try{
   const [nextContent,mediaPage,nextLocales]=await Promise.all([cmsApi.content(contentId),cmsApi.media({page:1,limit:100}),cmsApi.locales(true)]);
   setContent(nextContent);setMedia(mediaPage.data.map(asset=>({...asset,url:asset.url.startsWith("http")?asset.url:apiOrigin+asset.url})));setLocales(nextLocales.filter(locale=>locale.isActive));
   setLocaleCode(current=>current||requestedLocale||nextContent.translations[0]?.locale?.code||"");
  }catch(cause){setError(getError(cause));}
  finally{setLoading(false);}
 },[contentId,requestedLocale,apiOrigin]);
 useEffect(()=>{void load();},[load]);
 const translation=useMemo<CmsTranslation|null>(()=>content?.translations.find(item=>item.locale?.code===localeCode)??null,[content,localeCode]);
 const fields=useMemo(()=>({...content?.data,...(translation?.data??{})}),[content,translation]);
 const locale=locales.find(item=>item.code===localeCode);

 return <div className="page-content" dir={locale?.direction==="RTL"||["fa","ar"].includes(i18n.language.split("-")[0])?"rtl":"ltr"}><Container fluid>
  <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
   <div><h4 className="mb-1">{t("Content preview")}</h4><p className="text-muted mb-0">{t("Preview current saved draft values. Changes are not published by this page.")}</p></div>
   <div className="d-flex flex-wrap gap-2"><Link href={`/apps-cms/content/${contentId}?localeCode=${encodeURIComponent(localeCode)}`} className="btn btn-primary"><i className="ri-edit-line me-1"/>{t("Back to editor")}</Link><Link href="/apps-cms/content" className="btn btn-light">{t("Back to content")}</Link></div>
  </div>
  {error&&<Alert color="danger" toggle={()=>setError("")}>{error}</Alert>}
  {loading||!content?<div className="text-center py-5"><Spinner/> {t("Loading")}</div>:<>
   <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-3">
    <div><strong>{content.contentType.name}</strong>{translation&&<span className="text-muted ms-2">{translation.locale?.nativeName??translation.locale?.code}</span>}</div>
    <div className="d-flex align-items-center gap-2"><span className="text-muted small">{t("Language")}</span><select className="form-select" style={{minWidth:180}} value={localeCode} onChange={event=>setLocaleCode(event.target.value)}>{locales.map(item=><option key={item.id} value={item.code}>{item.nativeName} ({item.code})</option>)}</select></div>
   </div>
   {!translation?<Alert color="warning">{t("No translation exists for this language. Create the language version from the editor first.")}</Alert>:<PagePreview title={translation.title} excerpt={translation.excerpt} fields={fields} mediaAssets={media} direction={locale?.direction??translation.locale?.direction??"LTR"} statusLabel={t(translation.status.replace("_"," "))}/>}
  </>}
 </Container></div>;
}
