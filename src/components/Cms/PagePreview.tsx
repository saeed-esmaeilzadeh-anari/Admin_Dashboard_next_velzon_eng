"use client";

import React from "react";
import type { CmsMediaAsset } from "@/helpers/cmsApi";

type PreviewMedia = Pick<CmsMediaAsset, "id" | "url"> & Partial<Pick<CmsMediaAsset, "altText" | "caption" | "kind" | "mimeType" | "sizeBytes">>;
type Block = {id?:string;type?:string;media?:unknown;mediaItems?:unknown;[key:string]:unknown};
function asMedia(value: unknown): PreviewMedia | null {
 if(typeof value!=="object"||value===null)return null;
 const record=value as Record<string,unknown>;
 if(typeof record.id!=="string"||typeof record.url!=="string")return null;
 return {id:record.id,url:record.url,altText:typeof record.altText==="string"?record.altText:null,caption:typeof record.caption==="string"?record.caption:null,
  ...(typeof record.kind==="string"?{kind:record.kind as CmsMediaAsset["kind"]}:{}),
  ...(typeof record.mimeType==="string"?{mimeType:record.mimeType}:{}),
  ...(typeof record.sizeBytes==="number"?{sizeBytes:record.sizeBytes}:{})};
}
function text(value:unknown):string{return typeof value==="string"?value:value===null||value===undefined?"":String(value);}
function safeHref(value:unknown):string|null{
 if(typeof value!=="string"||!value.trim())return null;
 const path=value.trim();
 if(path.startsWith("/")&&!path.startsWith("//")&&!/[\r\n\\]/.test(path))return path;
 try{const url=new URL(path);return url.protocol==="https:"?url.toString():null;}catch{return null;}
}
export default function CmsPagePreview({title,excerpt,fields,mediaAssets=[],direction="LTR",statusLabel}:{
 title:string;excerpt?:string|null;fields:Record<string,unknown>;mediaAssets?:PreviewMedia[];direction?:"LTR"|"RTL";statusLabel?:string;
}){
 const mediaById=new Map(mediaAssets.map(asset=>[asset.id,asset]));
 const blocks=Array.isArray(fields.blocks)?fields.blocks.filter(item=>typeof item==="object"&&item!==null) as Block[]:[];
 const renderMedia=(asset:PreviewMedia,alt?:string,caption?:string)=><figure className="m-0" key={asset.id}><img src={asset.url} alt={alt||asset.altText||""} style={{maxWidth:"100%",height:"auto",borderRadius:10}}/><figcaption className="text-muted small mt-2">{caption||asset.caption||""}</figcaption></figure>;
 return <article className="cms-page-preview" dir={direction==="RTL"?"rtl":"ltr"} style={{maxWidth:960,margin:"0 auto",padding:"clamp(16px,3vw,36px)",background:"var(--vz-card-bg, #fff)",borderRadius:16}}>
  {statusLabel&&<div className="mb-3"><span className="badge bg-warning-subtle text-warning-emphasis">{statusLabel}</span></div>}
  <header className="mb-4"><h1 className="display-6 fw-bold mb-3">{title}</h1>{excerpt&&<p className="lead text-muted">{excerpt}</p>}</header>
  {blocks.length>0?<div className="d-grid gap-4">{blocks.map((raw,index)=>{
   const block=raw as Block;const type=text(block.type);
   if(type==="hero"){
    const href=safeHref(block.buttonUrl);
    return <section key={text(block.id)||index} className="p-4 p-md-5 rounded-4" style={{background:"var(--vz-light, #f5f7fb)"}}><small className="text-primary fw-semibold">{text(block.eyebrow)}</small><h2 className="display-6 fw-bold mt-2">{text(block.title)}</h2><p className="fs-5" style={{whiteSpace:"pre-wrap"}}>{text(block.body)}</p>{href&&block.buttonLabel&&<a className="btn btn-primary mt-2" href={href}>{text(block.buttonLabel)}</a>}</section>;
   }
   if(type==="richText")return <section key={text(block.id)||index}><h2 className="h3 fw-bold mb-3">{text(block.heading)}</h2><div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{text(block.bodyMarkdown)}</div></section>;
   if(type==="image"){
    const asset=asMedia(block.media)??mediaById.get(text(block.mediaId));
    return <section key={text(block.id)||index} className="d-grid gap-2">{asset?renderMedia(asset,text(block.altText),text(block.caption)):<p className="text-muted">[Media asset unavailable]</p>}</section>;
   }
   if(type==="gallery"){
    const embedded=Array.isArray(block.mediaItems)?block.mediaItems.map(asMedia).filter((asset):asset is PreviewMedia=>Boolean(asset)):[];
    const ids=Array.isArray(block.mediaIds)?block.mediaIds.map(text):[];
    const galleryAssets=embedded.length?embedded:ids.map(id=>mediaById.get(id)).filter((asset):asset is PreviewMedia=>Boolean(asset));
    return <section key={text(block.id)||index} className="d-grid gap-2"><div className="row g-3">{galleryAssets.map(asset=><div className="col-6 col-md-4" key={asset.id}>{renderMedia(asset)}</div>)}</div>{text(block.caption)&&<p className="text-muted">{text(block.caption)}</p>}</section>;
   }
   if(type==="cta"){
    const href=safeHref(block.buttonUrl);
    return <section key={text(block.id)||index} className="text-center rounded-4 p-4 p-md-5" style={{background:"var(--vz-light, #f5f7fb)"}}><h2 className="h3 fw-bold">{text(block.heading)}</h2><p style={{whiteSpace:"pre-wrap"}}>{text(block.body)}</p>{href&&block.buttonLabel&&<a className="btn btn-primary" href={href}>{text(block.buttonLabel)}</a>}</section>;
   }
   if(type==="faq"){
    const items=Array.isArray(block.items)?block.items.filter(item=>typeof item==="object"&&item!==null) as Array<Record<string,unknown>>:[];
    return <section key={text(block.id)||index}><h2 className="h3 fw-bold mb-3">{text(block.heading)}</h2><div className="d-grid gap-3">{items.map((item,i)=><details key={i} className="border rounded p-3"><summary className="fw-semibold">{text(item.question)}</summary><div className="mt-3" style={{whiteSpace:"pre-wrap"}}>{text(item.answer)}</div></details>)}</div></section>;
   }
   if(type==="cardGrid"){
    const cards=Array.isArray(block.cards)?block.cards.filter(item=>typeof item==="object"&&item!==null) as Array<Record<string,unknown>>:[];
    return <section key={text(block.id)||index}><h2 className="h3 fw-bold mb-3">{text(block.heading)}</h2><div className="row g-3">{cards.map((card,i)=>{const href=safeHref(card.url);return <div className="col-md-6" key={i}><div className="border rounded-4 p-3 h-100"><h3 className="h5 fw-bold">{text(card.title)}</h3><p style={{whiteSpace:"pre-wrap"}}>{text(card.description)}</p>{href&&<a href={href}>{href}</a>}</div></div>})}</div></section>;
   }
   return <section key={text(block.id)||index} className="border rounded p-3"><div style={{whiteSpace:"pre-wrap"}}>{JSON.stringify(block,null,2)}</div></section>;
  })}</div>:<div className="d-grid gap-4">{Object.entries(fields).filter(([key,value])=>key!=="blocks"&&value!==null&&value!==undefined&&value!=="").map(([key,value])=>{
      const label=key.replace(/([A-Z])/g," $1");
      const embedded=asMedia(value);
      if(embedded){const asset=embedded;return <section key={key}><h2 className="h5 fw-bold text-capitalize">{label}</h2>{renderMedia(asset,asset.altText??"",asset.caption??"")}</section>;}
      if(typeof value==="string"&&mediaById.has(value)){const asset=mediaById.get(value)!;return <section key={key}><h2 className="h5 fw-bold text-capitalize">{label}</h2>{renderMedia(asset,asset.altText??"",asset.caption??"")}</section>;}
      if(Array.isArray(value)&&value.length>0){const embeddedItems=value.map(asMedia).filter((asset):asset is PreviewMedia=>Boolean(asset));const mapped=embeddedItems.length?embeddedItems:value.map(item=>typeof item==="string"?mediaById.get(item):asMedia(item)).filter((asset):asset is PreviewMedia=>Boolean(asset));if(mapped.length===value.length&&mapped.length>0)return <section key={key}><h2 className="h5 fw-bold text-capitalize">{label}</h2><div className="row g-3">{mapped.map(asset=><div className="col-6 col-md-4" key={asset.id}>{renderMedia(asset)}</div>)}</div></section>;}
      if(typeof value==="string")return <section key={key}><h2 className="h5 fw-bold text-capitalize">{label}</h2><div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{value}</div></section>;
      return null;
    })}</div>}
  <footer className="border-top mt-5 pt-3 text-muted small">CMS preview · Rich text is rendered as plain text in this preview so author-provided HTML is not executed.</footer>
 </article>;
}
