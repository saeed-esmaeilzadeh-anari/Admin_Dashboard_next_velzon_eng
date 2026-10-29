"use client";

import React, { useEffect, useState } from "react";
import { Alert, Input, Label, Spinner } from "reactstrap";
import { useTranslation } from "react-i18next";
import { cmsApi, CmsContent, CmsField } from "@/helpers/cmsApi";

function errorMessage(error: unknown): string {
  const value = error as { response?: { data?: { message?: string | string[] } }; message?: string };
  const message = value?.response?.data?.message ?? value?.message;
  return Array.isArray(message) ? message.join(", ") : message ?? "Unable to load related content.";
}

export default function RelationField({ field, value, localeCode, onChange }: {
  field: CmsField;
  value: unknown;
  localeCode: string;
  onChange: (value: string | string[]) => void;
}) {
  const { t } = useTranslation();
  const [items, setItems] = useState<CmsContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const targetTypeKey = typeof field.config?.targetTypeKey === "string" ? field.config.targetTypeKey : "";

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    cmsApi.contents({ page: 1, limit: 100, ...(targetTypeKey ? { typeKey: targetTypeKey } : {}) })
      .then(result => { if (active) setItems(result.data); })
      .catch(cause => { if (active) setError(errorMessage(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [targetTypeKey]);

  const labelFor = (item: CmsContent) => {
    const translation = item.translations.find(entry => entry.locale?.code === localeCode) ?? item.translations[0];
    return `${translation?.title ?? item.contentType.name} · ${item.contentType.key} · ${item.id.slice(0, 8)}`;
  };
  const selected: string | string[] = Array.isArray(value) ? value.map(String) : String(value ?? "");

  return <div className="cms-relation-field">
    <Label for={`relation-${field.key}`}>{field.label}{field.isRequired ? <span className="text-danger ms-1">*</span> : null}</Label>
    <Input
      id={`relation-${field.key}`}
      type="select"
      multiple={field.type === "RELATION_MULTIPLE"}
      value={selected}
      disabled={loading || Boolean(error)}
      required={field.isRequired && field.type === "RELATION"}
      onChange={event => {
        if (field.type === "RELATION_MULTIPLE") {
          onChange(Array.from((event.currentTarget as unknown as HTMLSelectElement).selectedOptions).map(option => option.value));
        } else {
          onChange(event.target.value);
        }
      }}
    >
      {field.type === "RELATION" && <option value="">{t("Choose related content")}</option>}
      {items.map(item => <option key={item.id} value={item.id}>{labelFor(item)}</option>)}
    </Input>
    {loading && <div className="small text-muted mt-1"><Spinner size="sm" className="me-1" />{t("Loading related content")}</div>}
    {error && <Alert color="warning" className="mt-2 mb-0">{error}</Alert>}
    {!loading && !error && items.length === 0 && <div className="small text-muted mt-1">{t("No related content available")}</div>}
    {field.type === "RELATION_MULTIPLE" && <div className="small text-muted mt-1">{t("Use Ctrl or Command to select multiple records.")}</div>}
  </div>;
}
