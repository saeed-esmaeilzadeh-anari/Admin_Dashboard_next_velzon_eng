"use client";

import React from "react";
import type { CmsMediaAsset } from "@/helpers/cmsApi";

type Block = {id?:string;type?:string;[key:string]:unknown};
function text(value:unknown):string{return typeof value==="string"?value:value===null||value===undefined?"":String(value);}
function safeHref(value:unknown):string|null{
 if(typeof value!=="string"||!value.trim())return null;
 const path=value.trim();
 if(path.startsWith("/")&&!path.startsWith("//")&&!/[\r\n\\]/.test(path))return path;
 try{const url=new URL(path);return url.protocol==="https:"?url.toString():null;}catch{return null;}
}
export default function CmsPagePreview({title,excerpt,fields,mediaAssets=[],direction="LTR",statusLabel}:{
 title:string;excerpt?:string|null;fields:Record<string,unknown>;mediaAssets?:CmsMediaAsset[];direction?:"LTR"|"RTL";statusLabel?:string;
}){
 const mediaById=new Map(mediaAssets.map(asset=>[asset.id,asset]));
 const blocks=Array.isArray(fields.blocks)?fields.blocks.filter(item=>typeof item==="object"&&item!==null) as Block[]:[];
 const renderMedia=(asset:CmsMediaAsset,alt?:string,caption?:string)=><figure className="m-0" key={asset.id}><img src={asset.url} alt={alt||asset.altText||""} style={{maxWidth:"100%",height:"auto",borderRadius:10}}/><figcaption className="text-muted small mt-2">{caption||asset.caption||""}</figcaption></figure>;
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
    const asset=mediaById.get(text(block.mediaId));
    return <section key={text(block.id)||index} className="d-grid gap-2">{asset?renderMedia(asset,text(block.altText),text(block.caption)):<p className="text-muted">[Media asset unavailable]</p>}</section>;
   }
   if(type==="gallery"){
    const ids=Array.isArray(block.mediaIds)?block.mediaIds.map(text):[];
    return <section key={text(block.id)||index} className="d-grid gap-2"><div className="row g-3">{ids.map(id=>mediaById.get(id)).filter((asset):asset is CmsMediaAsset=>Boolean(asset)).map(asset=><div className="col-6 col-md-4" key={asset.id}>{renderMedia(asset)}</div>)}</div>{text(block.caption)&&<p className="text-muted">{text(block.caption)}</p>}</section>;
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
  })}</div>:<div className="d-grid gap-4">{Object.entries(fields).filter(([key,value])=>key!=="blocks"&&typeof value==="string"&&value.trim()).map(([key,value])=><section key={key}><h2 className="h5 fw-bold text-capitalize">{key.replace(/([A-Z])/g," $1")}</h2><div style={{whiteSpace:"pre-wrap",overflowWrap:"anywhere"}}>{value as string}</div></section>)}</div>}
  <footer className="border-top mt-5 pt-3 text-muted small">CMS preview · Rich text is rendered as plain text in this preview so author-provided HTML is not executed.</footer>
 </article>;
}
