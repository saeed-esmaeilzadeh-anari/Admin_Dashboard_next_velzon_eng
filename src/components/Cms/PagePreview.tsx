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
type MarkdownBlock =
  | { kind: "heading"; level: number; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "quote"; text: string }
  | { kind: "code"; text: string }
  | { kind: "hr" };

function parseMarkdown(source: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  let paragraph: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  let quote: string[] = [];
  let code: string[] | null = null;
  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ kind: "paragraph", text: paragraph.join(" ") });
    paragraph = [];
  };
  const flushList = () => {
    if (list) blocks.push({ kind: "list", ordered: list.ordered, items: list.items });
    list = null;
  };
  const flushQuote = () => {
    if (quote.length) blocks.push({ kind: "quote", text: quote.join("\n") });
    quote = [];
  };

  for (const originalLine of source.replace(/\r\n?/g, "\n").split("\n")) {
    const line = originalLine.replace(/\t/g, "  ");
    if (code !== null) {
      if (/^\s*```/.test(line)) {
        blocks.push({ kind: "code", text: code.join("\n") });
        code = null;
      } else {
        code.push(originalLine);
      }
      continue;
    }
    if (/^\s*```/.test(line)) {
      flushParagraph(); flushList(); flushQuote();
      code = [];
      continue;
    }
    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      flushParagraph(); flushList(); flushQuote();
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      continue;
    }
    if (/^\s{0,3}(?:---+|___+|\*\s*\*\s*\*+)\s*$/.test(line)) {
      flushParagraph(); flushList(); flushQuote();
      blocks.push({ kind: "hr" });
      continue;
    }
    const quoteMatch = line.match(/^\s{0,3}>\s?(.*)$/);
    if (quoteMatch) {
      flushParagraph(); flushList();
      quote.push(quoteMatch[1]);
      continue;
    }
    flushQuote();
    const unordered = line.match(/^\s{0,3}[-+*]\s+(.+)$/);
    const ordered = line.match(/^\s{0,3}\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const nextOrdered = Boolean(ordered);
      if (list && list.ordered !== nextOrdered) flushList();
      if (!list) list = { ordered: nextOrdered, items: [] };
      list.items.push((unordered ?? ordered)![1]);
      continue;
    }
    flushList();
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line.trim());
  }

  flushParagraph(); flushList(); flushQuote();
  if (code !== null) blocks.push({ kind: "code", text: code.join("\n") });
  return blocks;
}

function renderInlineMarkdown(source: string): React.ReactNode[] {
  const result: React.ReactNode[] = [];
  const pattern = /\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\n]+\*|_[^_\n]+_/g;
  let cursor = 0;
  for (const match of source.matchAll(pattern)) {
    const token = match[0];
    const start = match.index ?? 0;
    if (start > cursor) result.push(<React.Fragment key={`text-${cursor}`}>{source.slice(cursor, start)}</React.Fragment>);
    const link = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (link) {
      const href = safeHref(link[2].trim());
      result.push(href
        ? <a key={`link-${start}`} href={href} target={href.startsWith("https://") ? "_blank" : undefined} rel={href.startsWith("https://") ? "noopener noreferrer" : undefined}>{link[1]}</a>
        : <React.Fragment key={`unsafe-link-${start}`}>{token}</React.Fragment>);
    } else if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
      result.push(<strong key={`strong-${start}`}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`") && token.endsWith("`")) {
      result.push(<code key={`code-${start}`} className="px-1 rounded bg-light">{token.slice(1, -1)}</code>);
    } else if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
      result.push(<em key={`em-${start}`}>{token.slice(1, -1)}</em>);
    } else {
      result.push(<React.Fragment key={`plain-${start}`}>{token}</React.Fragment>);
    }
    cursor = start + token.length;
  }
  if (cursor < source.length) result.push(<React.Fragment key={`text-${cursor}`}>{source.slice(cursor)}</React.Fragment>);
  return result;
}

function MarkdownContent({ value }: { value: string }) {
  const blocks = parseMarkdown(value);
  if (!blocks.length) return null;
  return <div className="cms-markdown-content" style={{ overflowWrap: "anywhere" }}>
    {blocks.map((block, index) => {
      if (block.kind === "heading") {
        const Tag = (`h${block.level}`) as keyof React.JSX.IntrinsicElements;
        return <Tag key={index} className={block.level < 3 ? "fw-bold mb-3" : "fw-semibold mb-2"}>{renderInlineMarkdown(block.text)}</Tag>;
      }
      if (block.kind === "paragraph") return <p key={index} className="mb-3" style={{ whiteSpace: "pre-wrap" }}>{renderInlineMarkdown(block.text)}</p>;
      if (block.kind === "quote") return <blockquote key={index} className="border-start border-3 ps-3 text-muted mb-3">{renderInlineMarkdown(block.text)}</blockquote>;
      if (block.kind === "list") {
        const ListTag = block.ordered ? "ol" : "ul";
        return <ListTag key={index} className="ps-4 mb-3">{block.items.map((item, itemIndex) => <li key={itemIndex} className="mb-1">{renderInlineMarkdown(item)}</li>)}</ListTag>;
      }
      if (block.kind === "code") return <pre key={index} className="bg-light rounded-3 p-3 mb-3" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}><code>{block.text}</code></pre>;
      return <hr key={index} className="my-3" />;
    })}
  </div>;
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
    return <section key={text(block.id)||index} className="p-4 p-md-5 rounded-4" style={{background:"var(--vz-light, #f5f7fb)"}}><small className="text-primary fw-semibold">{text(block.eyebrow)}</small><h2 className="display-6 fw-bold mt-2">{text(block.title)}</h2><p className="fs-5" style={{whiteSpace:"pre-wrap"}}>{text(block.body)}</p>{href&&text(block.buttonLabel).trim()&&<a className="btn btn-primary mt-2" href={href}>{text(block.buttonLabel)}</a>}</section>;
   }
   if(type==="richText")return <section key={text(block.id)||index}><h2 className="h3 fw-bold mb-3">{text(block.heading)}</h2><MarkdownContent value={text(block.bodyMarkdown)} /></section>;
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
    return <section key={text(block.id)||index} className="text-center rounded-4 p-4 p-md-5" style={{background:"var(--vz-light, #f5f7fb)"}}><h2 className="h3 fw-bold">{text(block.heading)}</h2><p style={{whiteSpace:"pre-wrap"}}>{text(block.body)}</p>{href&&text(block.buttonLabel).trim()&&<a className="btn btn-primary" href={href}>{text(block.buttonLabel)}</a>}</section>;
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
      if(typeof value==="string")return <section key={key}><h2 className="h5 fw-bold text-capitalize">{label}</h2><MarkdownContent value={value} /></section>;
      return null;
    })}</div>}
  <footer className="border-top mt-5 pt-3 text-muted small">CMS preview · Markdown uses a safe formatting subset. Raw HTML is displayed as text and is never executed.</footer>
 </article>;
}
