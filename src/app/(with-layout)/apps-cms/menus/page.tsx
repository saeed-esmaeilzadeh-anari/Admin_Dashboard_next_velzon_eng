"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsContent, CmsLocale, CmsMenu, CmsMenuItem } from "@/helpers/cmsApi";

function getError(error: unknown): string {
  const value = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message) ? message.join(", ") : message ?? "Request failed.";
}
export default function CmsMenusPage() {
  const { t, i18n } = useTranslation();
  const [menus, setMenus] = useState<CmsMenu[]>([]);
  const [locales, setLocales] = useState<CmsLocale[]>([]);
  const [contents, setContents] = useState<CmsContent[]>([]);
  const [items, setItems] = useState<CmsMenuItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [key, setKey] = useState("primary");
  const [name, setName] = useState("");
  const [localeCode, setLocaleCode] = useState("");
  const [itemLabel, setItemLabel] = useState("");
  const [itemUrl, setItemUrl] = useState("/");
  const [contentId, setContentId] = useState("");
  const [parentId, setParentId] = useState("");
  const [targetBlank, setTargetBlank] = useState(false);
  const [sortOrder, setSortOrder] = useState(0);

  const selected = menus.find(menu => menu.id === selectedId);
  const itemsByParent = useMemo(() => {
    const map = new Map<string | null,CmsMenuItem[]>();
    for (const item of items) {
      const key = item.parentId ?? null;
      const children = map.get(key) ?? [];
      children.push(item); map.set(key,children);
    }
    return map;
  },[items]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [nextMenus, nextLocales, contentPage] = await Promise.all([cmsApi.menus(), cmsApi.locales(true), cmsApi.contents({page:1,limit:100})]);
      setMenus(nextMenus); setLocales(nextLocales.filter(locale=>locale.isActive)); setContents(contentPage.data);
      setLocaleCode(current=>current||nextLocales.find(locale=>locale.isDefault&&locale.isActive)?.code||nextLocales.find(locale=>locale.isActive)?.code||"");
      setSelectedId(current=>current||nextMenus[0]?.id||"");
    } catch (cause) { setError(getError(cause)); }
    finally { setLoading(false); }
  },[]);
  const loadItems = useCallback(async(id:string)=> {
    if(!id){setItems([]);return;}
    try {setItems(await cmsApi.menuItems(id));}
    catch(cause){setError(getError(cause));}
  },[]);
  useEffect(()=>{void load();},[load]);
  useEffect(()=>{void loadItems(selectedId);},[loadItems,selectedId]);

  const createMenu = async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();setSaving(true);setError("");setNotice("");
    try{
      const created=await cmsApi.createMenu({key:key.trim(),name:name.trim(),localeCode});
      setKey("");setName("");await load();setSelectedId(created.id);setNotice(t("Menu created"));
    }catch(cause){setError(getError(cause));}
    finally{setSaving(false);}
  };
  const createItem=async(event:React.FormEvent<HTMLFormElement>)=>{
    event.preventDefault();if(!selected)return;
    setSaving(true);setError("");setNotice("");
    try{
      await cmsApi.createMenuItem(selected.id,{label:itemLabel.trim(),url:contentId?null:itemUrl.trim(),contentId:contentId||null,parentId:parentId||null,targetBlank,sortOrder,isActive:true});
      setItemLabel("");setItemUrl("/");setContentId("");setParentId("");setTargetBlank(false);setSortOrder(items.length*10+10);
      await loadItems(selected.id);await load();setNotice(t("Menu item created"));
    }catch(cause){setError(getError(cause));}
    finally{setSaving(false);}
  };
  const toggleItem=async(item:CmsMenuItem)=>{
    if(!selected)return;
    setBusyId(item.id);setError("");setNotice("");
    try{await cmsApi.updateMenuItem(selected.id,item.id,{isActive:!item.isActive});await loadItems(selected.id);setNotice(t("Menu item updated"));}
    catch(cause){setError(getError(cause));}
    finally{setBusyId("");}
  };
  const deleteItem=async(item:CmsMenuItem)=>{
    if(!selected||!window.confirm(t("Delete this menu item and its children?")))return;
    setBusyId(item.id);setError("");setNotice("");
    try{await cmsApi.deleteMenuItem(selected.id,item.id);await loadItems(selected.id);setNotice(t("Menu item deleted"));}
    catch(cause){setError(getError(cause));}
    finally{setBusyId("");}
  };
  const rows=(parent:string|null,depth=0,seen=new Set<string>()):React.ReactNode[]=>(itemsByParent.get(parent)??[]).flatMap(item=>{
    if(seen.has(item.id))return [];
    const nextSeen=new Set(seen);nextSeen.add(item.id);
    return [
      <tr key={item.id}>
        <td><div style={{paddingInlineStart:depth*20}}><div className="fw-medium">{item.label}</div><small className="text-muted">{item.contentId?t("Linked content")+": "+item.contentId.slice(0,8):item.url}</small></div></td>
        <td>{item.parentId?items.find(parentItem=>parentItem.id===item.parentId)?.label:"—"}</td>
        <td>{item.sortOrder}</td>
        <td><Badge color={item.isActive?"success":"secondary"}>{t(item.isActive?"Active":"Inactive")}</Badge>{item.targetBlank&&<Badge className="ms-1 text-dark" color="light">{t("New tab")}</Badge>}</td>
        <td><div className="d-flex gap-1 flex-wrap"><Button size="sm" outline color={item.isActive?"warning":"success"} disabled={busyId===item.id} onClick={()=>void toggleItem(item)}>{t(item.isActive?"Disable":"Enable")}</Button><Button size="sm" outline color="danger" disabled={busyId===item.id} onClick={()=>void deleteItem(item)}>{t("Delete")}</Button></div></td>
      </tr>,
      ...rows(item.id,depth+1,nextSeen)
    ];
  });

  return <div className="page-content" dir={["fa","ar"].includes(i18n.language.split("-")[0])?"rtl":"ltr"}>
    <Container fluid>
      <Row className="align-items-center mb-4"><Col><h4 className="mb-1">{t("Navigation menus")}</h4><p className="text-muted mb-0">{t("Create a separate navigation tree for each content language")}</p></Col><Col xs="auto"><Link href="/apps-cms/content" className="btn btn-light">{t("Back to content")}</Link></Col></Row>
      {error&&<Alert color="danger" toggle={()=>setError("")}>{error}</Alert>}{notice&&<Alert color="success" toggle={()=>setNotice("")}>{notice}</Alert>}
      <Row>
        <Col xl={4}>
          <Card><CardHeader><h5 className="card-title mb-0">{t("Create menu")}</h5></CardHeader><CardBody><Form onSubmit={createMenu}>
            <div className="mb-3"><Label>{t("Machine key")} *</Label><Input required pattern="[a-z][a-z0-9_-]{0,63}" value={key} onChange={event=>setKey(event.target.value)}/></div>
            <div className="mb-3"><Label>{t("Menu name")} *</Label><Input required maxLength={120} value={name} onChange={event=>setName(event.target.value)}/></div>
            <div className="mb-3"><Label>{t("Language")} *</Label><Input type="select" required value={localeCode} onChange={event=>setLocaleCode(event.target.value)}>{locales.map(locale=><option key={locale.id} value={locale.code}>{locale.nativeName} ({locale.code})</option>)}</Input></div>
            <Button color="primary" block disabled={saving||!localeCode} type="submit">{saving?<Spinner size="sm" className="me-2"/>:null}{t("Create menu")}</Button>
          </Form></CardBody></Card>
          <Card><CardHeader><h5 className="card-title mb-0">{t("Menus")}</h5></CardHeader><CardBody>
            {loading&&<Spinner size="sm"/>}
            {menus.map(menu=><button key={menu.id} className={`w-100 border rounded text-start p-3 mb-2 ${selectedId===menu.id?"border-primary bg-light":""}`} onClick={()=>setSelectedId(menu.id)} type="button"><div className="d-flex justify-content-between"><strong>{menu.name}</strong><Badge color="light" className="text-dark">{menu._count?.items??0}</Badge></div><small className="text-muted">{menu.key} · {menu.locale?.code}</small></button>)}
            {!loading&&menus.length===0&&<div className="text-muted small">{t("No menus yet")}</div>}
          </CardBody></Card>
        </Col>
        <Col xl={8}>
          <Card><CardHeader><h5 className="card-title mb-0">{selected?selected.name:t("Menu items")}</h5><small className="text-muted">{selected?.locale?.direction==="RTL"?t("Right-to-left language"):t("Left-to-right language")}</small></CardHeader><CardBody>
            {selected&&<Form onSubmit={createItem} className="border rounded p-3 mb-4"><h6 className="mb-3">{t("Add menu item")}</h6><Row className="g-2">
              <Col md={6}><Label>{t("Label")} *</Label><Input required maxLength={160} value={itemLabel} onChange={event=>setItemLabel(event.target.value)}/></Col>
              <Col md={6}><Label>{t("Link to published content (optional)")}</Label><Input type="select" value={contentId} onChange={event=>setContentId(event.target.value)}><option value="">{t("Use custom URL")}</option>{contents.map(content=>content.translations.filter(tr=>tr.status==="PUBLISHED"&&tr.locale?.code===selected.locale?.code).map(tr=><option key={tr.id} value={content.id}>{tr.title}</option>))}</Input></Col>
              {!contentId&&<Col md={6}><Label>{t("URL")} *</Label><Input required value={itemUrl} onChange={event=>setItemUrl(event.target.value)} placeholder="/about"/></Col>}
              <Col md={6}><Label>{t("Parent item")}</Label><Input type="select" value={parentId} onChange={event=>setParentId(event.target.value)}><option value="">{t("Top level")}</option>{items.filter(item=>item.isActive).map(item=><option key={item.id} value={item.id}>{item.label}</option>)}</Input></Col>
              <Col md={4}><Label>{t("Sort order")}</Label><Input type="number" min={0} max={100000} value={sortOrder} onChange={event=>setSortOrder(Number(event.target.value))}/></Col>
              <Col md={4} className="d-flex align-items-end"><div className="form-check form-switch mb-2"><Input className="form-check-input" type="switch" id="menu-target-blank" checked={targetBlank} onChange={event=>setTargetBlank(event.target.checked)}/><Label className="form-check-label" for="menu-target-blank">{t("Open in new tab")}</Label></div></Col>
              <Col xs={12} className="text-end"><Button type="submit" color="primary" disabled={saving}>{t("Add menu item")}</Button></Col>
            </Row></Form>}
            {selected&&<div className="table-responsive"><Table responsive hover className="align-middle"><thead className="table-light"><tr><th>{t("Menu item")}</th><th>{t("Parent")}</th><th>{t("Order")}</th><th>{t("Status")}</th><th>{t("Actions")}</th></tr></thead><tbody>{rows(null)}{items.length===0&&<tr><td colSpan={5} className="text-center text-muted py-4">{t("No menu items yet")}</td></tr>}</tbody></Table></div>}
            {selected&&<Alert color="info" className="mb-0">{t("Public menu JSON is available at")}: <code>/api/v1/public/cms/menus/{selected.key}/{selected.locale?.code}</code></Alert>}
            {!selected&&!loading&&<div className="text-muted text-center py-5">{t("Select a menu to manage its items")}</div>}
          </CardBody></Card>
        </Col>
      </Row>
    </Container>
  </div>;
}
