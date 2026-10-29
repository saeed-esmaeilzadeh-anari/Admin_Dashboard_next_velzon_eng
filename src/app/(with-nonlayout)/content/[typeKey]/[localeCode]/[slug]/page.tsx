import React, { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cmsApi, CmsMediaAsset, CmsPublicContent } from "@/helpers/cmsApi";
import PagePreview from "@/components/Cms/PagePreview";

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
  if(!content)return {title:"Not found"};
  const description=content.seoDescription??content.excerpt??undefined;
  const canonical=`/content/${encodeURIComponent(typeKey)}/${encodeURIComponent(localeCode)}/${encodeURIComponent(slug)}`;
  return {
    title:content.seoTitle??content.title,
    description,
    alternates:{canonical},
    openGraph:{title:content.seoTitle??content.title,description,type:"article",url:canonical,locale:content.locale.code},
    robots:{index:true,follow:true},
  };
}

export default async function PublishedCmsPage({params}:RouteProps){
  const {typeKey,localeCode,slug}=await params;
  const content=await loadPublishedContent(typeKey,localeCode,slug);
  if(!content||content.type.key!==typeKey||content.locale.code!==localeCode||content.slug!==slug)notFound();

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
  const base=process.env.NEXT_PUBLIC_BACKEND_API_URL??"http://localhost:3001/api/v1";
  const assets=[...mediaMap.values()].map(asset=>({...asset,url:absoluteMediaUrl(asset.url)}));
  return <main style={{minHeight:"100vh",padding:"clamp(16px,4vw,48px)",background:"var(--vz-body-bg, #f3f3f9)"}}>
    <PagePreview title={content.title} excerpt={content.excerpt} fields={fields} mediaAssets={assets} direction={content.locale.direction}/>
    {content.terms.length>0&&<div style={{maxWidth:960,margin:"20px auto 0",padding:"0 24px",display:"flex",gap:8,flexWrap:"wrap"}}>{content.terms.map(term=><span key={term.id} style={{fontSize:13,padding:"5px 10px",borderRadius:999,background:"#e9ecef"}}>{term.name}</span>)}</div>}
  </main>;
}
