"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsContentType, CmsField, CmsFieldType } from "@/helpers/cmsApi";

type DraftField = { key: string; label: string; type: CmsFieldType; isRequired: boolean; isLocalized: boolean; options: string; };
const fieldTypes: CmsFieldType[] = ["TEXT","TEXTAREA","RICH_TEXT","MARKDOWN","INTEGER","DECIMAL","BOOLEAN","DATE","DATETIME","SELECT","MULTISELECT","EMAIL","URL","JSON","MEDIA","MEDIA_MULTIPLE"];
const emptyField = (): DraftField => ({ key: "", label: "", type: "TEXT", isRequired: false, isLocalized: true, options: "" });
function errorMessage(error: unknown): string {
  const value = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message) ? message.join(", ") : message ?? "Unable to complete the request.";
}
function fieldConfig(field: DraftField) {
  const options = field.options.split(",").map(value => value.trim()).filter(Boolean);
  return options.length && (field.type === "SELECT" || field.type === "MULTISELECT") ? { options } : undefined;
}
function FieldDraftForm({ field, onChange, onRemove, canRemove }: { field: DraftField; onChange: (next: DraftField) => void; onRemove: () => void; canRemove: boolean }) {
  const { t } = useTranslation();
  return <Row className="g-2 align-items-end mb-3">
    <Col md={3}><Label>{t("Field key")}</Label><Input value={field.key} pattern="[a-z][a-z0-9_-]{0,63}" required onChange={event => onChange({ ...field, key: event.target.value })} placeholder="body" /></Col>
    <Col md={3}><Label>{t("Field label")}</Label><Input value={field.label} required maxLength={100} onChange={event => onChange({ ...field, label: event.target.value })} placeholder={t("Body")} /></Col>
    <Col md={3}><Label>{t("Field type")}</Label><Input type="select" value={field.type} onChange={event => onChange({ ...field, type: event.target.value as CmsFieldType })}>{fieldTypes.map(type => <option key={type} value={type}>{type}</option>)}</Input></Col>
    <Col md={3}><div className="d-flex gap-2 mb-2"><div className="form-check"><Input id={`required-${field.key || "new"}`} type="checkbox" checked={field.isRequired} onChange={event => onChange({ ...field, isRequired: event.target.checked })} /><Label check for={`required-${field.key || "new"}`}>{t("Required")}</Label></div><div className="form-check"><Input id={`localized-${field.key || "new"}`} type="checkbox" checked={field.isLocalized} onChange={event => onChange({ ...field, isLocalized: event.target.checked })} /><Label check for={`localized-${field.key || "new"}`}>{t("Translated")}</Label></div>{canRemove && <Button type="button" color="danger" outline size="sm" onClick={onRemove}><i className="ri-delete-bin-line" /></Button>}</div></Col>
    {(field.type === "SELECT" || field.type === "MULTISELECT") && <Col md={12}><Label>{t("Options separated by commas")}</Label><Input value={field.options} required onChange={event => onChange({ ...field, options: event.target.value })} placeholder="draft, ready, archived" /></Col>}
  </Row>;
}
export default function CmsContentTypesPage() {
  const { t, i18n } = useTranslation();
  const [types, setTypes] = useState<CmsContentType[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [typeKey, setTypeKey] = useState("");
  const [typeName, setTypeName] = useState("");
  const [description, setDescription] = useState("");
  const [newFields, setNewFields] = useState<DraftField[]>([{ ...emptyField(), key: "body", label: "Body", type: "RICH_TEXT", isRequired: true }]);
  const [fieldDraft, setFieldDraft] = useState<DraftField>(emptyField());

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const nextTypes = await cmsApi.contentTypes(true);
      setTypes(nextTypes);
      setSelectedId(current => current || nextTypes.find(item => item.isActive)?.id || "");
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const selected = types.find(item => item.id === selectedId);

  const createType = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const normalizedFields = newFields.map((field, index) => ({
        key: field.key.trim(), label: field.label.trim(), type: field.type,
        isRequired: field.isRequired, isLocalized: field.isLocalized, sortOrder: (index + 1) * 10,
        ...(fieldConfig(field) ? { config: fieldConfig(field) } : {}),
      }));
      const created = await cmsApi.createContentType({ key: typeKey.trim(), name: typeName.trim(), description: description.trim(), fields: normalizedFields });
      setTypeKey(""); setTypeName(""); setDescription("");
      setNewFields([{ ...emptyField(), key: "body", label: "Body", type: "RICH_TEXT", isRequired: true }]);
      await load(); setSelectedId(created.id); setNotice(t("Content type created"));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  };
  const addField = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await cmsApi.addField(selected.id, {
        key: fieldDraft.key.trim(), label: fieldDraft.label.trim(), type: fieldDraft.type,
        isRequired: fieldDraft.isRequired, isLocalized: fieldDraft.isLocalized, sortOrder: (selected.fields?.length ?? 0) * 10 + 10,
        ...(fieldConfig(fieldDraft) ? { config: fieldConfig(fieldDraft) } : {}),
      });
      setFieldDraft(emptyField()); await load(); setNotice(t("Field added to content type"));
    } catch (cause) { setError(errorMessage(cause)); }
    finally { setSaving(false); }
  };
  const toggleType = async (type: CmsContentType) => {
    setBusyId(type.id); setError(""); setNotice("");
    try { await cmsApi.updateContentType(type.id, { isActive: !type.isActive }); await load(); setNotice(t("Content type settings updated")); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusyId(""); }
  };
  const toggleFieldActive = async (field: CmsField) => {
    if (!selected || !field.id) return;
    setBusyId(field.id); setError(""); setNotice("");
    try { await cmsApi.updateField(selected.id, field.id, { isActive: field.isActive === false }); await load(); setNotice(t("Field settings updated")); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusyId(""); }
  };
  const toggleFieldFlag = async (field: CmsField, key: "isRequired" | "isLocalized") => {
    if (!selected || !field.id) return;
    setBusyId(field.id); setError(""); setNotice("");
    try { await cmsApi.updateField(selected.id, field.id, { [key]: !field[key] }); await load(); setNotice(t("Field settings updated")); }
    catch (cause) { setError(errorMessage(cause)); }
    finally { setBusyId(""); }
  };

  return <div className="page-content" dir={i18n.language === "fa" || i18n.language === "ar" ? "rtl" : "ltr"}>
    <Container fluid>
      <Row className="align-items-center mb-4"><Col><h4 className="mb-1">{t("Content types and fields")}</h4><p className="text-muted mb-0">{t("Build reusable content schemas without creating a new frontend form for every type")}</p></Col><Col xs="auto"><Link className="btn btn-light" href="/apps-cms/content">{t("Back to content")}</Link></Col></Row>
      {error && <Alert color="danger" toggle={() => setError("")}>{error}</Alert>}
      {notice && <Alert color="success" toggle={() => setNotice("")}>{notice}</Alert>}
      <Row>
        <Col xl={7}>
          <Card><CardHeader><h5 className="card-title mb-0">{t("Defined content types")}</h5></CardHeader><CardBody>
            <div className="table-responsive"><Table responsive hover className="align-middle"><thead className="table-light"><tr><th>{t("Type")}</th><th>{t("Fields")}</th><th>{t("Records")}</th><th>{t("Status")}</th><th>{t("Action")}</th></tr></thead><tbody>
              {loading && <tr><td colSpan={5} className="text-center py-4"><Spinner size="sm" className="me-2" />{t("Loading")}</td></tr>}
              {!loading && types.map(type => <tr key={type.id} className={type.id === selectedId ? "table-active" : ""}>
                <td><button type="button" className="btn btn-link p-0 text-start fw-medium" onClick={() => setSelectedId(type.id)}>{type.name}</button><small className="d-block text-muted"><code>{type.key}</code></small></td>
                <td>{type.fields.length}</td><td>{type._count?.contents ?? 0}</td><td><span className={`badge bg-${type.isActive ? "success" : "secondary"}`}>{t(type.isActive ? "Active" : "Inactive")}</span></td>
                <td><Button size="sm" color={type.isActive ? "warning" : "success"} outline disabled={busyId === type.id} onClick={() => void toggleType(type)}>{t(type.isActive ? "Disable" : "Enable")}</Button></td>
              </tr>)}
              {!loading && types.length === 0 && <tr><td colSpan={5} className="text-center text-muted py-4">{t("No content types yet")}</td></tr>}
            </tbody></Table></div>
          </CardBody></Card>
          {selected && <Card><CardHeader><h5 className="card-title mb-0">{t("Fields of")} {selected.name}</h5><small className="text-muted">{t("Fields with stored values should be disabled or migrated, not deleted.")}</small></CardHeader><CardBody>
            <div className="table-responsive"><Table responsive className="align-middle"><thead className="table-light"><tr><th>{t("Field")}</th><th>{t("Type")}</th><th>{t("Required")}</th><th>{t("Translated")}</th><th>{t("Status")}</th><th>{t("Actions")}</th></tr></thead><tbody>
              {selected.fields.map(field => <tr key={field.id}>
                <td><div className="fw-medium">{field.label}</div><small><code>{field.key}</code></small></td><td>{field.type}</td>
                <td><Input type="checkbox" checked={field.isRequired} disabled={busyId === field.id} onChange={() => void toggleFieldFlag(field, "isRequired")} /></td>
                <td><Input type="checkbox" checked={field.isLocalized} disabled={busyId === field.id} onChange={() => void toggleFieldFlag(field, "isLocalized")} /></td>
                <td><span className={`badge bg-${field.isActive !== false ? "success" : "secondary"}`}>{t(field.isActive !== false ? "Active" : "Inactive")}</span></td>
                <td><Button size="sm" color={field.isActive !== false ? "warning" : "success"} outline disabled={busyId === field.id} onClick={() => void toggleFieldActive(field)}>{t(field.isActive !== false ? "Disable" : "Enable")}</Button></td>
              </tr>)}
            </tbody></Table></div>
            <hr /><h6 className="mb-3">{t("Add field")}</h6>
            <Form onSubmit={addField}>
              <FieldDraftForm field={fieldDraft} onChange={setFieldDraft} onRemove={() => setFieldDraft(emptyField())} canRemove={false} />
              <Button type="submit" color="primary" disabled={saving}>{saving ? <Spinner size="sm" className="me-2" /> : null}{t("Add field")}</Button>
            </Form>
          </CardBody></Card>}
        </Col>
        <Col xl={5}>
          <Card><CardHeader><h5 className="card-title mb-0">{t("Create content type")}</h5></CardHeader><CardBody>
            <Form onSubmit={createType}>
              <div className="mb-3"><Label>{t("Machine key")} *</Label><Input required maxLength={64} pattern="[a-z][a-z0-9_-]{0,63}" value={typeKey} onChange={event => setTypeKey(event.target.value)} placeholder="article" /></div>
              <div className="mb-3"><Label>{t("Display name")} *</Label><Input required maxLength={100} value={typeName} onChange={event => setTypeName(event.target.value)} placeholder={t("Article")} /></div>
              <div className="mb-3"><Label>{t("Description")}</Label><Input type="textarea" rows={2} value={description} onChange={event => setDescription(event.target.value)} maxLength={1000} /></div>
              <hr /><div className="d-flex justify-content-between align-items-center mb-3"><h6 className="mb-0">{t("Initial fields")}</h6><Button type="button" color="light" size="sm" onClick={() => setNewFields(current => [...current, emptyField()])}><i className="ri-add-line me-1" />{t("Add field")}</Button></div>
              {newFields.map((field,index) => <div key={index} className="border rounded p-3 mb-3">
                <div className="d-flex justify-content-between mb-2"><strong>{t("Field")} {index+1}</strong>{newFields.length>1 && <Button type="button" size="sm" color="danger" outline onClick={() => setNewFields(current => current.filter((_,i)=>i!==index))}>{t("Remove")}</Button>}</div>
                <FieldDraftForm field={field} onChange={next => setNewFields(current => current.map((item,i)=>i===index?next:item))} onRemove={() => setNewFields(current => current.filter((_,i)=>i!==index))} canRemove={false} />
              </div>)}
              <Button type="submit" color="primary" block disabled={saving}>{saving ? <Spinner size="sm" className="me-2" /> : null}{t("Create type")}</Button>
            </Form>
          </CardBody></Card>
          <Alert color="warning">{t("The current field system supports typed JSON-backed fields. Media relations, repeaters and visual page-builder blocks are planned for later increments.")}</Alert>
        </Col>
      </Row>
    </Container>
  </div>;
}
