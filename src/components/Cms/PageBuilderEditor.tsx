"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Col, Form, Input, Label, Row, Spinner } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsMediaAsset } from "@/helpers/cmsApi";

type BlockType = "hero" | "richText" | "image" | "gallery" | "cta" | "faq" | "cardGrid";
type CmsBlock = { id: string; type: BlockType; [key: string]: unknown };
const BLOCKS: Array<{ type: BlockType; label: string; description: string }> = [
  { type: "hero", label: "Hero section", description: "Large headline, supporting text and button." },
  { type: "richText", label: "Text section", description: "A heading and readable text content." },
  { type: "image", label: "Image", description: "One asset with accessible alternative text and caption." },
  { type: "gallery", label: "Image gallery", description: "A responsive grid of selected media assets." },
  { type: "cta", label: "Call to action", description: "A centered message and button." },
  { type: "faq", label: "FAQ", description: "Expandable question and answer rows." },
  { type: "cardGrid", label: "Card grid", description: "A responsive collection of links or feature cards." },
];
function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : "block-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
}
function asText(value: unknown): string { return typeof value === "string" ? value : ""; }
function parseBlocks(value: unknown): CmsBlock[] {
  let parsed = value;
  if (typeof parsed === "string") {
    if (!parsed.trim()) return [];
    try { parsed = JSON.parse(parsed); } catch { return []; }
  }
  if (!Array.isArray(parsed)) return [];
  return parsed.filter((item): item is CmsBlock => typeof item === "object" && item !== null && typeof (item as { type?: unknown }).type === "string")
    .map(item => ({ ...item, id: asText(item.id) || makeId() }) as CmsBlock);
}
function defaultBlock(type: BlockType): CmsBlock {
  const id = makeId();
  if (type === "hero") return { id, type, eyebrow: "", title: "Your headline", body: "", buttonLabel: "", buttonUrl: "" };
  if (type === "richText") return { id, type, heading: "Section heading", bodyMarkdown: "" };
  if (type === "image") return { id, type, mediaId: "", altText: "", caption: "" };
  if (type === "gallery") return { id, type, mediaIds: [], caption: "" };
  if (type === "cta") return { id, type, heading: "Ready to begin?", body: "", buttonLabel: "Learn more", buttonUrl: "" };
  if (type === "faq") return { id, type, heading: "Frequently asked questions", items: [{ question: "", answer: "" }] };
  return { id, type, heading: "Highlights", cards: [{ title: "", description: "", url: "" }] };
}
function safeList(value: unknown): Array<Record<string, unknown>> {
  return Array.isArray(value) ? value.filter(item => typeof item === "object" && item !== null) as Array<Record<string, unknown>> : [];
}

export default function PageBuilderEditor({ value, onChange, label = "Page builder blocks" }: {
  value: unknown;
  onChange: (value: CmsBlock[]) => void;
  label?: string;
}) {
  const { t } = useTranslation();
  const [assets, setAssets] = useState<CmsMediaAsset[]>([]);
  const [mediaLoading, setMediaLoading] = useState(true);
  const [mediaError, setMediaError] = useState("");
  const blocks = useMemo(() => parseBlocks(value), [value]);

  useEffect(() => {
    let active = true;
    cmsApi.media({ page: 1, limit: 100 }).then(page => {
      if (active) setAssets(page.data.filter(asset => asset.kind === "IMAGE"));
    }).catch(error => {
      const cause = error as { response?: { data?: { message?: string | string[] } }; message?: string };
      const message = cause.response?.data?.message ?? cause.message;
      if (active) setMediaError(Array.isArray(message) ? message.join(", ") : message ?? "Unable to load media.");
    }).finally(() => { if (active) setMediaLoading(false); });
    return () => { active = false; };
  }, []);

  const commit = (next: CmsBlock[]) => onChange(next);
  const patch = (index: number, fields: Record<string, unknown>) => commit(blocks.map((block, current) => current === index ? { ...block, ...fields } : block));
  const add = (type: BlockType) => commit([...blocks, defaultBlock(type)]);
  const remove = (index: number) => commit(blocks.filter((_, current) => current !== index));
  const move = (index: number, offset: -1 | 1) => {
    const next = [...blocks];
    const target = index + offset;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    commit(next);
  };
  const textInput = (index: number, key: string, fieldLabel: string, value: unknown, multiline = false, placeholder = "") => (
    <div className="mb-3" key={key}>
      <Label>{t(fieldLabel)}</Label>
      <Input type={multiline ? "textarea" : "text"} rows={multiline ? 3 : undefined} value={asText(value)} maxLength={key.toLowerCase().includes("url") ? 2048 : 10000} placeholder={placeholder} onChange={event => patch(index, { [key]: event.target.value })} />
    </div>
  );

  return <div className="cms-page-builder border rounded-3 p-3">
    <div className="d-flex align-items-start justify-content-between flex-wrap gap-2 mb-3">
      <div><h6 className="mb-1">{t(label)}</h6><p className="text-muted small mb-0">{t("Add, edit and reorder visual content blocks. Use preview to check the public layout.")}</p></div>
      <span className="badge bg-light text-dark">{blocks.length} {t("blocks")}</span>
    </div>
    {blocks.length === 0 && <div className="text-center border border-dashed rounded-3 p-4 mb-3"><i className="ri-layout-2-line display-6 text-muted"/><p className="text-muted mb-0">{t("No page blocks yet. Add the first block below.")}</p></div>}
    <div className="d-grid gap-3">
      {blocks.map((block, index) => {
        const info = BLOCKS.find(item => item.type === block.type);
        const list = safeList(block.type === "faq" ? block.items : block.cards);
        return <section className="border rounded-3 overflow-hidden" key={block.id}>
          <div className="bg-light px-3 py-2 d-flex align-items-center justify-content-between gap-2">
            <div><span className="badge bg-primary me-2">{index + 1}</span><strong>{t(info?.label ?? block.type)}</strong><div className="text-muted small">{t(info?.description ?? "")}</div></div>
            <div className="d-flex gap-1">
              <Button type="button" color="light" size="sm" title={t("Move up")} disabled={index === 0} onClick={() => move(index, -1)}><i className="ri-arrow-up-line"/></Button>
              <Button type="button" color="light" size="sm" title={t("Move down")} disabled={index === blocks.length - 1} onClick={() => move(index, 1)}><i className="ri-arrow-down-line"/></Button>
              <Button type="button" color="danger" outline size="sm" title={t("Remove block")} onClick={() => remove(index)}><i className="ri-delete-bin-line"/></Button>
            </div>
          </div>
          <div className="p-3">
            {block.type === "hero" && <Row><Col md={6}>{textInput(index,"eyebrow","Eyebrow",block.eyebrow)}{textInput(index,"title","Headline",block.title)}{textInput(index,"buttonLabel","Button label",block.buttonLabel)}</Col><Col md={6}>{textInput(index,"body","Supporting text",block.body,true)}{textInput(index,"buttonUrl","Button URL",block.buttonUrl,false,"/contact")}</Col></Row>}
            {block.type === "richText" && <Row><Col md={12}>{textInput(index,"heading","Section heading",block.heading)}</Col><Col md={12}>{textInput(index,"bodyMarkdown","Body content",block.bodyMarkdown,true,"Write the section content here.")}</Col></Row>}
            {block.type === "image" && <Row><Col md={6}><div className="mb-3"><Label>{t("Image asset")}</Label><Input type="select" value={asText(block.mediaId)} disabled={mediaLoading || assets.length === 0} onChange={event => patch(index,{mediaId:event.target.value})}><option value="">{t("Choose an image")}</option>{assets.map(asset=><option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</Input>{mediaLoading&&<small className="text-muted"><Spinner size="sm" className="me-1"/>{t("Loading media")}</small>}{mediaError&&<small className="text-warning d-block">{t("Media picker unavailable")}: {mediaError}</small>}</div>{textInput(index,"altText","Alternative text",block.altText)}</Col><Col md={6}>{textInput(index,"caption","Caption",block.caption,true)}{assets.find(asset=>asset.id===asText(block.mediaId))&&<img src={assets.find(asset=>asset.id===asText(block.mediaId))!.url.startsWith("http")?assets.find(asset=>asset.id===asText(block.mediaId))!.url:(process.env.NEXT_PUBLIC_BACKEND_API_URL??"http://localhost:3001/api/v1").replace(/\/api\/v1\/?$/,"")+assets.find(asset=>asset.id===asText(block.mediaId))!.url} alt={asText(block.altText)} style={{maxWidth:"100%",maxHeight:200,objectFit:"contain"}}/>}</Col></Row>}
            {block.type === "gallery" && <><div className="mb-3"><Label>{t("Gallery images")}</Label><Input type="select" multiple value={Array.isArray(block.mediaIds)?block.mediaIds.map(String):[]} disabled={mediaLoading || assets.length===0} onChange={event => patch(index,{mediaIds:Array.from(event.target.selectedOptions).map(option=>option.value)})}>{assets.map(asset=><option key={asset.id} value={asset.id}>{asset.originalName}</option>)}</Input><small className="text-muted">{t("Use Ctrl or Command to choose multiple images.")}</small></div>{textInput(index,"caption","Gallery caption",block.caption,true)}</>}
            {block.type === "cta" && <Row><Col md={6}>{textInput(index,"heading","Section heading",block.heading)}{textInput(index,"buttonLabel","Button label",block.buttonLabel)}</Col><Col md={6}>{textInput(index,"body","Supporting text",block.body,true)}{textInput(index,"buttonUrl","Button URL",block.buttonUrl,false,"/contact")}</Col></Row>}
            {(block.type === "faq" || block.type === "cardGrid") && <>
              {textInput(index,"heading","Section heading",block.heading)}
              <div className="d-grid gap-2">{list.map((item,itemIndex)=><div key={itemIndex} className="border rounded p-3">
                <div className="d-flex justify-content-between align-items-center mb-2"><strong>{t(block.type==="faq"?"Question":"Card")} {itemIndex+1}</strong><Button type="button" color="danger" outline size="sm" onClick={()=>patch(index,{[block.type==="faq"?"items":"cards"]:list.filter((_,i)=>i!==itemIndex)})}>{t("Remove")}</Button></div>
                {block.type==="faq"?<>{textInputForArray("question","Question","Question",item.question)}{textInputForArray("answer","Answer","Answer",item.answer,true)}</>:<>{textInputForArray("title","Card title","Title",item.title)}{textInputForArray("description","Card description","Description",item.description,true)}{textInputForArray("url","Card URL","URL",item.url)}</>}
              </div>)}</div>
              <Button type="button" color="light" size="sm" className="mt-2" onClick={()=>patch(index,{[block.type==="faq"?"items":"cards"]:[...list,block.type==="faq"?{question:"",answer:""}:{title:"",description:"",url:""}]})}><i className="ri-add-line me-1"/>{t(block.type==="faq"?"Add question":"Add card")}</Button>
            </>}
          </div>
        </section>;
        function textInputForArray(key: string, label: string, _id: string, value: unknown, multiline = false) {
          return <div className="mb-2" key={key}><Label>{t(label)}</Label><Input type={multiline?"textarea":"text"} rows={multiline?3:undefined} value={asText(value)} maxLength={5000} onChange={event=>patch(index,{[block.type==="faq"?"items":"cards"]:list.map((item,itemIndex)=>itemIndex===list.findIndex(target=>target===item)?{...item,[key]:event.target.value}:item)})}/></div>;
        }
      })}
    </div>
    <hr/>
    <div><Label>{t("Add a content block")}</Label><Row className="g-2">
      {BLOCKS.map(item=><Col key={item.type} xs={6} md={4} xl={3}><Button type="button" color="light" className="w-100 h-100 text-start" onClick={()=>add(item.type)}><i className="ri-add-circle-line me-1"/>{t(item.label)}</Button></Col>)}
    </Row></div>
    <input type="hidden" value={JSON.stringify(blocks)} readOnly aria-label={t("Block data")}/>
  </div>;
}
