"use client";

import React, { useMemo } from "react";
import { Button, Card, CardBody, CardHeader, Col, Input, Label, Row } from "reactstrap";
import { useTranslation } from "react-i18next";
import type { CmsMediaAsset } from "@/helpers/cmsApi";

export type CmsPageBlockType = "hero" | "richText" | "image" | "gallery" | "cta" | "faq" | "cardGrid";
export type CmsPageBlock = {
  id: string;
  type: CmsPageBlockType;
  [key: string]: unknown;
};
const blockTypes: Array<{ type: CmsPageBlockType; label: string }> = [
  { type: "hero", label: "Hero" }, { type: "richText", label: "Rich text" },
  { type: "image", label: "Image" }, { type: "gallery", label: "Gallery" },
  { type: "cta", label: "Call to action" }, { type: "faq", label: "FAQ" },
  { type: "cardGrid", label: "Card grid" },
];
function makeBlock(type: CmsPageBlockType): CmsPageBlock {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "block-" + Date.now() + "-" + Math.random().toString(36).slice(2);
  const base = { id, type };
  if (type === "hero") return { ...base, eyebrow: "", title: "", body: "", buttonLabel: "", buttonUrl: "" };
  if (type === "richText") return { ...base, heading: "", bodyMarkdown: "" };
  if (type === "image") return { ...base, mediaId: "", altText: "", caption: "" };
  if (type === "gallery") return { ...base, mediaIds: [] as string[], caption: "" };
  if (type === "cta") return { ...base, heading: "", body: "", buttonLabel: "", buttonUrl: "" };
  if (type === "faq") return { ...base, heading: "", items: [] as Array<{ question: string; answer: string }> };
  return { ...base, heading: "", cards: [] as Array<{ title: string; description: string; url: string }> };
}
function normalizeBlocks(value: unknown): CmsPageBlock[] {
  let candidate = value;
  if (typeof candidate === "string") {
    try { candidate = JSON.parse(candidate); } catch { return []; }
  }
  if (!Array.isArray(candidate)) return [];
  return candidate.filter(item => typeof item === "object" && item !== null && typeof (item as Record<string, unknown>).type === "string").map(item => {
    const block = item as Record<string, unknown>;
    return { ...block, id: typeof block.id === "string" ? block.id : "block-" + Math.random().toString(36).slice(2) } as CmsPageBlock;
  }).filter(block => blockTypes.some(item => item.type === block.type));
}
function parseFaq(value: unknown): Array<{question:string;answer:string}> {
  if (Array.isArray(value)) return value.filter(item => typeof item === "object" && item !== null).map(item => ({question:String((item as Record<string,unknown>).question??""),answer:String((item as Record<string,unknown>).answer??"")}));
  if (typeof value !== "string") return [];
  return value.split("\n").map(line=>line.trim()).filter(Boolean).map(line=>{const parts=line.split("|");return {question:(parts.shift()??"").trim(),answer:parts.join("|").trim()};});
}
function parseCards(value: unknown): Array<{title:string;description:string;url:string}> {
  if (Array.isArray(value)) return value.filter(item=>typeof item==="object"&&item!==null).map(item=>({title:String((item as Record<string,unknown>).title??""),description:String((item as Record<string,unknown>).description??""),url:String((item as Record<string,unknown>).url??"")}));
  if(typeof value!=="string")return [];
  return value.split("\n").map(line=>line.trim()).filter(Boolean).map(line=>{const parts=line.split("|").map(p=>p.trim());return {title:parts[0]??"",description:parts[1]??"",url:parts[2]??""};});
}
export default function PageBuilderField({ value, onChange, mediaAssets, disabled=false }: {
  value: unknown;
  onChange: (next: CmsPageBlock[]) => void;
  mediaAssets: CmsMediaAsset[];
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const blocks = useMemo(() => normalizeBlocks(value), [value]);
  const update = (index: number, changes: Partial<CmsPageBlock>) => onChange(blocks.map((block,i)=>i===index?{...block,...changes}:block));
  const add = (type: CmsPageBlockType) => onChange([...blocks,makeBlock(type)]);
  const move = (index:number, offset:number) => {
    const next=[...blocks]; const target=index+offset;
    if(target<0||target>=next.length)return;
    [next[index],next[target]]=[next[target],next[index]];
    onChange(next);
  };
  const remove = (index:number) => onChange(blocks.filter((_,i)=>i!==index));
  const textInput = (block:CmsPageBlock,index:number,key:string,label:string,textarea=false) => <Col md={textarea?12:6} key={key}><div className="mb-3"><Label>{t(label)}</Label>{textarea?<Input type="textarea" rows={3} value={String(block[key]??"")} onChange={event=>update(index,{[key]:event.target.value})}/>:<Input value={String(block[key]??"")} onChange={event=>update(index,{[key]:event.target.value})}/>}</div></Col>;

  return <div className="cms-page-builder">
    <div className="d-flex flex-wrap gap-2 mb-3">
      {blockTypes.map(item=><Button key={item.type} type="button" color="light" size="sm" disabled={disabled} onClick={()=>add(item.type)}><i className="ri-add-line me-1"/>{t("Add block")}: {t(item.label)}</Button>)}
    </div>
    {blocks.length===0&&<div className="border border-dashed rounded text-center p-4 text-muted">{t("No blocks yet. Add a block to start building this page.")}</div>}
    {blocks.map((block,index)=><Card key={block.id} className="mb-3">
      <CardHeader className="d-flex align-items-center justify-content-between gap-2">
        <div><strong>{index+1}. {t(blockTypes.find(item=>item.type===block.type)?.label??block.type)}</strong><small className="d-block text-muted">{t("Block key")}: <code>{block.type}</code></small></div>
        <div className="d-flex gap-1"><Button type="button" color="light" size="sm" disabled={disabled||index===0} onClick={()=>move(index,-1)} title={t("Move up")}><i className="ri-arrow-up-line"/></Button><Button type="button" color="light" size="sm" disabled={disabled||index===blocks.length-1} onClick={()=>move(index,1)} title={t("Move down")}><i className="ri-arrow-down-line"/></Button><Button type="button" color="danger" outline size="sm" disabled={disabled} onClick={()=>remove(index)} title={t("Remove block")}><i className="ri-delete-bin-line"/></Button></div>
      </CardHeader>
      <CardBody><Row className="g-2">
        {block.type==="hero"&&<>{textInput(block,index,"eyebrow","Eyebrow")}{textInput(block,index,"title","Heading")}{textInput(block,index,"body","Body",true)}{textInput(block,index,"buttonLabel","Button label")}{textInput(block,index,"buttonUrl","Button URL")}</>}
        {block.type==="richText"&&<>{textInput(block,index,"heading","Heading")}{textInput(block,index,"bodyMarkdown","Markdown body",true)}<Col xs={12}><small className="text-muted">{t("Markdown is stored as data. Do not render untrusted HTML without sanitization.")}</small></Col></>}
        {block.type==="image"&&<><Col md={6}><div className="mb-3"><Label>{t("Media asset")}</Label><Input type="select" value={String(block.mediaId??"")} onChange={event=>update(index,{mediaId:event.target.value})}><option value="">{t("Choose media")}</option>{mediaAssets.filter(asset=>asset.kind==="IMAGE").map(asset=><option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</Input></div></Col>{textInput(block,index,"altText","Alternative text")}{textInput(block,index,"caption","Caption",true)}</>}
        {block.type==="gallery"&&<><Col xs={12}><div className="mb-3"><Label>{t("Gallery images")}</Label><Input type="select" multiple value={Array.isArray(block.mediaIds)?block.mediaIds.map(String):[]} onChange={event=>update(index,{mediaIds:Array.from((event.currentTarget as unknown as HTMLSelectElement).selectedOptions).map(option=>option.value)})}>{mediaAssets.filter(asset=>asset.kind==="IMAGE").map(asset=><option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</Input><small className="text-muted">{t("Hold Ctrl to select multiple images.")}</small></div></Col>{textInput(block,index,"caption","Caption",true)}</>}
        {block.type==="cta"&&<>{textInput(block,index,"heading","Heading")}{textInput(block,index,"body","Body",true)}{textInput(block,index,"buttonLabel","Button label")}{textInput(block,index,"buttonUrl","Button URL")}</>}
        {block.type==="faq"&&<>{textInput(block,index,"heading","Heading")}<Col xs={12}><div className="mb-3"><Label>{t("FAQ entries")}</Label><Input type="textarea" rows={5} value={parseFaq(block.items).map(item=>item.question+" | "+item.answer).join("\n")} onChange={event=>update(index,{items:parseFaq(event.target.value)})} placeholder={t("Question one | Answer one")}/><small className="text-muted">{t("One question and answer per line, separated by |")}</small></div></Col></>}
        {block.type==="cardGrid"&&<>{textInput(block,index,"heading","Heading")}<Col xs={12}><div className="mb-3"><Label>{t("Cards")}</Label><Input type="textarea" rows={5} value={parseCards(block.cards).map(item=>[item.title,item.description,item.url].join(" | ")).join("\n")} onChange={event=>update(index,{cards:parseCards(event.target.value)})} placeholder={t("Card title | Description | /path")}/><small className="text-muted">{t("One card per line: title | description | URL")}</small></div></Col></>}
      </Row></CardBody>
    </Card>)}
  </div>;
}
