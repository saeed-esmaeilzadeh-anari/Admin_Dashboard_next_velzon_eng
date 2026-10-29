"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Alert, Badge, Button, Card, CardBody, CardHeader, Col, Container, Form, Input, Label, Row, Spinner, Table } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsMediaAsset, CmsMediaKind } from "@/helpers/cmsApi";

function getError(error: unknown): string {
  const value = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message) ? message.join(", ") : message ?? "Request failed.";
}
function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(2) + " MB";
}
const kinds: Array<CmsMediaKind | "ALL"> = ["ALL","IMAGE","VIDEO","AUDIO","DOCUMENT","OTHER"];

export default function CmsMediaLibraryPage() {
  const { t, i18n } = useTranslation();
  const [items, setItems] = useState<CmsMediaAsset[]>([]);
  const [kind, setKind] = useState<CmsMediaKind | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [caption, setCaption] = useState("");
  const [metadata, setMetadata] = useState<Record<string, {altText: string; caption: string}>>({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [apiOrigin, setApiOrigin] = useState("");

  useEffect(() => {
    try { setApiOrigin(new URL(process.env.NEXT_PUBLIC_BACKEND_API_URL ?? "http://localhost:3001/api/v1").origin); }
    catch { setApiOrigin(""); }
  }, []);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await cmsApi.media({ page: 1, limit: 100, ...(kind !== "ALL" ? { kind } : {}), ...(search.trim() ? { search: search.trim() } : {}) });
      setItems(result.data);
      setMetadata(current => {
        const next = { ...current };
        for (const item of result.data) if (!next[item.id]) next[item.id] = { altText: item.altText ?? "", caption: item.caption ?? "" };
        return next;
      });
    } catch (cause) { setError(getError(cause)); }
    finally { setLoading(false); }
  }, [kind, search]);
  useEffect(() => { void load(); }, [load]);

  const publicUrl = (asset: CmsMediaAsset) => asset.url.startsWith("http") ? asset.url : apiOrigin + asset.url;
  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) { setError(t("Choose a file first")); return; }
    setUploading(true); setError(""); setNotice("");
    try {
      await cmsApi.uploadMedia(file, altText.trim(), caption.trim());
      setFile(null); setAltText(""); setCaption("");
      const fileInput = document.getElementById("cms-media-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      setNotice(t("Media uploaded successfully"));
      await load();
    } catch (cause) { setError(getError(cause)); }
    finally { setUploading(false); }
  };

  const saveMetadata = async (asset: CmsMediaAsset) => {
    const value = metadata[asset.id] ?? { altText: asset.altText ?? "", caption: asset.caption ?? "" };
    setBusyId(asset.id); setError(""); setNotice("");
    try {
      await cmsApi.updateMedia(asset.id, value);
      setNotice(t("Media metadata saved"));
      await load();
    } catch (cause) { setError(getError(cause)); }
    finally { setBusyId(""); }
  };
  const remove = async (asset: CmsMediaAsset) => {
    if (!window.confirm(t("Delete this media asset permanently?"))) return;
    setBusyId(asset.id); setError(""); setNotice("");
    try {
      const result = await cmsApi.deleteMedia(asset.id);
      setItems(current => current.filter(item => item.id !== asset.id));
      setNotice(result.fileRemoved ? t("Media deleted") : t("Media record deleted but the physical file needs cleanup"));
    } catch (cause) { setError(getError(cause)); }
    finally { setBusyId(""); }
  };

  const totalBytes = useMemo(() => items.reduce((sum, item) => sum + item.sizeBytes, 0), [items]);

  return <div className="page-content" dir={i18n.language === "fa" || i18n.language === "ar" ? "rtl" : "ltr"}>
    <Container fluid>
      <Row className="align-items-center mb-4"><Col><h4 className="mb-1">{t("Media library")}</h4><p className="text-muted mb-0">{t("Upload and manage images, documents, audio and video for your content")}</p></Col><Col xs="auto"><Link href="/apps-cms/content" className="btn btn-light">{t("Back to content")}</Link></Col></Row>
      {error && <Alert color="danger" toggle={() => setError("")}>{error}</Alert>}
      {notice && <Alert color="success" toggle={() => setNotice("")}>{notice}</Alert>}
      <Row>
        <Col xl={4}>
          <Card><CardHeader><h5 className="card-title mb-0">{t("Upload media")}</h5></CardHeader><CardBody>
            <Form onSubmit={upload}>
              <div className="mb-3"><Label for="cms-media-file">{t("Choose file")} *</Label><Input id="cms-media-file" type="file" required onChange={event => setFile(event.target.files?.[0] ?? null)} accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf,text/plain,text/csv,audio/mpeg,audio/wav,audio/ogg,audio/mp4,video/mp4,video/webm,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" /><small className="text-muted d-block mt-1">{t("Allowed file types are validated by the API. The default maximum upload is 25 MB.")}</small></div>
              <div className="mb-3"><Label>{t("Alternative text")}</Label><Input value={altText} maxLength={500} onChange={event => setAltText(event.target.value)} /></div>
              <div className="mb-3"><Label>{t("Caption")}</Label><Input type="textarea" rows={3} value={caption} maxLength={1000} onChange={event => setCaption(event.target.value)} /></div>
              {file && <div className="small text-muted mb-3">{file.name} · {formatBytes(file.size)}</div>}
              <Button type="submit" color="primary" block disabled={uploading || !file}>{uploading ? <><Spinner size="sm" className="me-2" />{t("Uploading")}</> : t("Upload file")}</Button>
            </Form>
          </CardBody></Card>
          <Card><CardBody><div className="d-flex justify-content-between"><span className="text-muted">{t("Loaded assets")}</span><strong>{items.length}</strong></div><div className="d-flex justify-content-between mt-2"><span className="text-muted">{t("Loaded file size")}</span><strong>{formatBytes(totalBytes)}</strong></div><small className="text-muted d-block mt-3">{t("Files are stored locally under the backend upload directory. Production deployments should mount persistent storage or configure an external media origin.")}</small></CardBody></Card>
        </Col>
        <Col xl={8}>
          <Card><CardHeader><Row className="align-items-center g-2"><Col><h5 className="card-title mb-0">{t("Library assets")}</h5></Col><Col sm={5}><Input value={search} onChange={event => setSearch(event.target.value)} placeholder={t("Search by filename or alt text")} /></Col><Col sm={3}><Input type="select" value={kind} onChange={event => setKind(event.target.value as CmsMediaKind | "ALL")}>{kinds.map(value => <option key={value} value={value}>{t(value === "ALL" ? "All media types" : value)}</option>)}</Input></Col><Col xs="auto"><Button color="light" onClick={() => void load()} disabled={loading}><i className="ri-refresh-line" /></Button></Col></Row></CardHeader>
            <CardBody>
              {loading && <div className="text-center py-5"><Spinner /> {t("Loading")}</div>}
              {!loading && items.length === 0 && <div className="text-center text-muted py-5">{t("No media assets found")}</div>}
              {!loading && items.length > 0 && <div className="table-responsive"><Table responsive hover className="align-middle"><thead className="table-light"><tr><th>{t("Preview")}</th><th>{t("File details")}</th><th>{t("Metadata")}</th><th>{t("Actions")}</th></tr></thead><tbody>
                {items.map(asset => <tr key={asset.id}>
                  <td style={{width:100}}>{asset.kind === "IMAGE" ? <a href={publicUrl(asset)} target="_blank" rel="noreferrer"><img src={publicUrl(asset)} alt={metadata[asset.id]?.altText ?? asset.altText ?? ""} style={{width:76,height:64,objectFit:"cover",borderRadius:6}} /></a> : <div className="avatar-sm"><span className="avatar-title rounded bg-light text-primary"><i className={asset.kind === "VIDEO" ? "ri-video-line fs-3" : asset.kind === "AUDIO" ? "ri-music-2-line fs-3" : "ri-file-text-line fs-3"} /></span></div>}</td>
                  <td><div className="fw-medium text-break">{asset.originalName}</div><div className="small text-muted">{asset.mimeType}</div><div className="small text-muted">{formatBytes(asset.sizeBytes)}</div><div className="small"><a href={publicUrl(asset)} target="_blank" rel="noreferrer">{t("Open file")}</a></div><Badge color="light" className="text-dark mt-1">{t(asset.kind)}</Badge></td>
                  <td style={{minWidth:220}}><div className="mb-2"><Label className="small">{t("Alternative text")}</Label><Input value={metadata[asset.id]?.altText ?? ""} maxLength={500} onChange={event => setMetadata(current => ({...current,[asset.id]:{altText:event.target.value,caption:current[asset.id]?.caption ?? asset.caption ?? ""}}))} /></div><div><Label className="small">{t("Caption")}</Label><Input type="textarea" rows={2} value={metadata[asset.id]?.caption ?? ""} maxLength={1000} onChange={event => setMetadata(current => ({...current,[asset.id]:{altText:current[asset.id]?.altText ?? asset.altText ?? "",caption:event.target.value}}))} /></div></td>
                  <td><div className="d-grid gap-2"><Button size="sm" color="primary" disabled={busyId===asset.id} onClick={() => void saveMetadata(asset)}>{t("Save metadata")}</Button><Button size="sm" color="light" onClick={() => { void navigator.clipboard?.writeText(publicUrl(asset)); setNotice(t("URL copied")); }}>{t("Copy URL")}</Button><Button size="sm" color="danger" outline disabled={busyId===asset.id} onClick={() => void remove(asset)}>{t("Delete")}</Button></div></td>
                </tr>)}
              </tbody></Table></div>}
              <div className="small text-muted mt-3">{t("Showing up to 100 assets per query. Use search and kind filters for larger libraries.")}</div>
            </CardBody>
          </Card>
        </Col>
      </Row>
    </Container>
  </div>;
}
