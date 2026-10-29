import React, { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cmsApi, CmsMediaAsset, CmsPublicContent, CmsPublicMenuItem } from "@/helpers/cmsApi";
import PagePreview from "@/components/Cms/PagePreview";

// Published content changes should be visible after publication, without waiting for a build or ISR window.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type RouteProps = { params: Promise<{ typeKey: string; localeCode: string; slug: string }> };

const loadPublishedContent = cache(async (typeKey: string, localeCode: string, slug: string): Promise<CmsPublicContent | null> => {
  try {
    return await cmsApi.publicContent(typeKey, localeCode, slug);
  } catch (error) {
    const value = error as { response?: { status?: number } };
    if (value?.response?.status === 404) return null;
    throw error;
  }
});

function safeMenuHref(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const candidate = value.trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//") && !/[\\r\\n\\\\]/.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
function renderMenuItems(items: CmsPublicMenuItem[]): React.ReactNode {
  if (!items.length) return null;
  return <ul style={{display:"flex",alignItems:"center",flexWrap:"wrap",gap:12,listStyle:"none",padding:0,margin:0}}>
    {items.map(item => {
      const href = safeMenuHref(item.href);
      return <li key={item.id} style={{position:"relative"}}>
        {href ? <a href={href} target={item.targetBlank ? "_blank" : undefined} rel={item.targetBlank ? "noopener noreferrer" : undefined} style={{display:"inline-block",padding:"6px 9px",borderRadius:8,color:"inherit",textDecoration:"none",fontSize:14}}>{item.label}</a> : <span style={{display:"inline-block",padding:"6px 9px",color:"var(--vz-secondary-color, #74788d)",fontSize:14}}>{item.label}</span>}
        {item.children?.length ? <div style={{paddingInlineStart:12,marginTop:4,borderInlineStart:"1px solid var(--vz-border-color, #e9ebec)"}}>{renderMenuItems(item.children)}</div> : null}
      </li>;
    })}
  </ul>;
}
function absoluteMediaUrl(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  const base = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:3001/api/v1";
  try { return new URL(url, new URL(base).origin).toString(); }
  catch { return url; }
}
function extractMedia(value: unknown, output: Map<string,CmsMediaAsset>) {
  if (Array.isArray(value)) { for (const item of value) extractMedia(item,output); return; }
  if (typeof value !== "object" || value === null) return;
  const asset=value as Record<string,unknown>;
  if (typeof asset.id==="string" && typeof asset.url==="string" && typeof asset.kind==="string" &&
      typeof asset.mimeType==="string" && typeof asset.sizeBytes==="number") {
    output.set(asset.id,{
      id:asset.id,storageKey:asset.id,originalName:typeof asset.originalName==="string"?asset.originalName:asset.id,
      mimeType:asset.mimeType,kind:asset.kind as CmsMediaAsset["kind"],sizeBytes:asset.sizeBytes,
      url:absoluteMediaUrl(asset.url),altText:typeof asset.altText==="string"?asset.altText:null,
      caption:typeof asset.caption==="string"?asset.caption:null,createdAt:"",
    });
  }
  for (const [key,child] of Object.entries(asset)) {
    if (key==="media" || key==="mediaItems" || key==="fields" || key==="blocks" || key==="gallery" || key==="coverImage") extractMedia(child,output);
  }
}

export async function generateMetadata({params}:RouteProps):Promise<Metadata>{
  const {typeKey,localeCode,slug}=await params;
  const content=await loadPublishedContent(typeKey,localeCode,slug);
  if(!content||content.type.key!==typeKey||content.locale.code!==localeCode||content.slug!==slug)return {title:"Not found"};
  const description=content.seoDescription??content.excerpt??undefined;
  const canonical=`/content/${encodeURIComponent(typeKey)}/${encodeURIComponent(localeCode)}/${encodeURIComponent(slug)}`;
  const languages:Record<string,string>={};
  for(const alternate of content.alternates??[]){
    if(alternate.slug)languages[alternate.localeCode]=`/content/${encodeURIComponent(typeKey)}/${encodeURIComponent(alternate.localeCode)}/${encodeURIComponent(alternate.slug)}`;
  }
  return {
    title:content.seoTitle??content.title,
    description,
    alternates:{canonical,languages:Object.keys(languages).length?languages:undefined},
    openGraph:{title:content.seoTitle??content.title,description,type:"article",url:canonical,locale:content.locale.code},
    robots:{index:true,follow:true},
  };
}

export default async function PublishedCmsPage({params}:RouteProps){
  const {typeKey,localeCode,slug}=await params;
  const content=await loadPublishedContent(typeKey,localeCode,slug);
  if(!content||content.type.key!==typeKey||content.locale.code!==localeCode||content.slug!==slug)notFound();

  const publicMenu = await cmsApi.publicMenu("main", localeCode).catch(() => null);

  const fields:Record<string,unknown>={...content.fields};
  const mediaMap=new Map<string,CmsMediaAsset>();
  extractMedia(fields,mediaMap);
  for(const [key,value] of Object.entries(fields)){
    if(typeof value==="object"&&value!==null&&!Array.isArray(value)){
      const candidate=value as Record<string,unknown>;
      if(typeof candidate.id==="string"&&mediaMap.has(candidate.id))fields[key]=candidate.id;
    }else if(Array.isArray(value)&&value.length>0&&value.every(item=>typeof item==="object"&&item!==null&&typeof (item as Record<string,unknown>).id==="string")){
      fields[key]=value.map(item=>(item as Record<string,unknown>).id);
    }
  }
  const blocks=Array.isArray(fields.blocks)?fields.blocks.filter(item=>typeof item==="object"&&item!==null) as Array<Record<string,unknown>>:[];
  fields.blocks=blocks.map(block=>{
    const next={...block};
    if(typeof next.mediaId==="string"&&mediaMap.has(next.mediaId))next.mediaId=next.mediaId;
    if(Array.isArray(next.mediaItems))next.mediaIds=next.mediaItems.filter(item=>typeof item==="object"&&item!==null).map(item=>(item as Record<string,unknown>).id).filter((id):id is string=>typeof id==="string");
    return next;
  });
  const assets=[...mediaMap.values()].map(asset=>({...asset,url:absoluteMediaUrl(asset.url)}));
  return <main lang={content.locale.code} dir={content.locale.direction==="RTL"?"rtl":"ltr"} style={{minHeight:"100vh",padding:"clamp(16px,4vw,48px)",background:"var(--vz-body-bg, #f3f3f9)"}}>
    {publicMenu ? <header style={{maxWidth:1120,margin:"0 auto 24px",padding:"14px 18px",border:"1px solid var(--vz-border-color, #e9ebec)",borderRadius:14,background:"var(--vz-card-bg, #fff)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:16,flexWrap:"wrap"}}>
        <a href="/" style={{fontWeight:700,color:"inherit",textDecoration:"none",fontSize:18}}>{publicMenu.name}</a>
        <nav aria-label={content.locale.code.toLowerCase().startsWith("fa") ? "ناوبری اصلی" : "Main navigation"}>{renderMenuItems(publicMenu.items)}</nav>
      </div>
    </header> : null}
    <PagePreview title={content.title} excerpt={content.excerpt} fields={fields} mediaAssets={assets} direction={content.locale.direction}/>
    {content.terms.length>0&&<div style={{maxWidth:960,margin:"20px auto 0",padding:"0 24px",display:"flex",gap:8,flexWrap:"wrap"}}>{content.terms.map(term=><span key={term.id} style={{fontSize:13,padding:"5px 10px",borderRadius:999,background:"#e9ecef"}}>{term.name}</span>)}</div>}
  </main>;
}
