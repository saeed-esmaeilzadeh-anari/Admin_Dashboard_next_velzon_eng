"use client";

import React, { useMemo } from "react";
import { Button, Col, Input, Label, Row } from "reactstrap";
import { useTranslation } from "react-i18next";
import { CmsField } from "@/helpers/cmsApi";

type RepeaterChild = {
  key: string; label?: string; type: string; isRequired?: boolean;
  config?: Record<string, unknown>; options?: unknown[];
};
type RepeatRow = Record<string, unknown>;

function childInitialValue(field: RepeaterChild): unknown {
  if (field.type === "BOOLEAN") return false;
  if (field.type === "MULTISELECT") return [];
  return "";
}
function makeRow(fields: RepeaterChild[]): RepeatRow {
  return Object.fromEntries(fields.map(field => [field.key, childInitialValue(field)]));
}
function childOptions(field: RepeaterChild): Array<{ value: string; label: string }> {
  const source = Array.isArray(field.config?.options) ? field.config.options : Array.isArray(field.options) ? field.options : [];
  return source.map(value => typeof value === "string"
    ? { value, label: value }
    : typeof value === "object" && value !== null && "value" in value && typeof value.value === "string"
      ? { value: value.value, label: "label" in value && typeof value.label === "string" ? value.label : value.value }
      : null).filter((value): value is { value: string; label: string } => Boolean(value));
}
function inputType(type: string): string {
  if (type === "INTEGER" || type === "DECIMAL") return "number";
  if (type === "DATE") return "date";
  if (type === "DATETIME") return "datetime-local";
  if (type === "EMAIL") return "email";
  if (type === "URL") return "url";
  return "text";
}

export default function RepeaterField({ field, value, onChange }: {
  field: CmsField;
  value: unknown;
  onChange: (value: RepeatRow[]) => void;
}) {
  const { t } = useTranslation();
  const definitions = useMemo(() => {
    const source = Array.isArray(field.config?.fields) ? field.config.fields : [];
    return source.filter((item): item is RepeaterChild =>
      typeof item === "object" && item !== null &&
      typeof (item as RepeaterChild).key === "string" &&
      typeof (item as RepeaterChild).type === "string"
    );
  }, [field.config]);
  const rows: RepeatRow[] = Array.isArray(value)
    ? value.filter((item): item is RepeatRow => typeof item === "object" && item !== null && !Array.isArray(item))
    : [];

  const update = (rowIndex: number, key: string, nextValue: unknown) => {
    onChange(rows.map((row, index) => index === rowIndex ? { ...row, [key]: nextValue } : row));
  };
  const renderChild = (child: RepeaterChild, row: RepeatRow, rowIndex: number) => {
    const current = row[child.key] ?? childInitialValue(child);
    const id = `repeater-${field.key}-${rowIndex}-${child.key}`;
    const choices = childOptions(child);
    const required = child.isRequired === true;
    return <Col md={child.type === "TEXTAREA" || child.type === "RICH_TEXT" || child.type === "MARKDOWN" ? 12 : 6} key={child.key}>
      <div className="mb-3">
        <Label for={id}>{child.label ?? child.key}{required && <span className="text-danger ms-1">*</span>}</Label>
        {child.type === "BOOLEAN"
          ? <div className="form-check form-switch"><Input id={id} className="form-check-input" type="switch" checked={Boolean(current)} onChange={event => update(rowIndex, child.key, event.target.checked)} /><Label check for={id}>{t("Enabled")}</Label></div>
          : child.type === "SELECT"
            ? <Input id={id} type="select" required={required} value={String(current)} onChange={event => update(rowIndex, child.key, event.target.value)}><option value="">{t("Select an option")}</option>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</Input>
            : child.type === "MULTISELECT"
              ? <Input id={id} type="select" multiple value={Array.isArray(current) ? current.map(String) : []} onChange={event => update(rowIndex, child.key, Array.from((event.currentTarget as unknown as HTMLSelectElement).selectedOptions).map(option => option.value))}>{choices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</Input>
              : child.type === "TEXTAREA" || child.type === "RICH_TEXT" || child.type === "MARKDOWN"
                ? <Input id={id} type="textarea" rows={3} required={required} value={String(current)} onChange={event => update(rowIndex, child.key, event.target.value)} />
                : <Input id={id} type={inputType(child.type)} required={required} value={current == null ? "" : String(current)} step={child.type === "DECIMAL" ? "any" : child.type === "INTEGER" ? "1" : undefined} onChange={event => {
                    const raw = event.target.value;
                    update(rowIndex, child.key, raw === "" ? "" : child.type === "INTEGER" ? Number.parseInt(raw, 10) : child.type === "DECIMAL" ? Number(raw) : raw);
                  }} />}
      </div>
    </Col>;
  };

  return <div className="cms-repeater border rounded-3 p-3">
    <div className="d-flex justify-content-between align-items-center gap-2 mb-3">
      <div><strong>{field.label}</strong><div className="small text-muted">{t("Repeatable field group")}</div></div>
      <Button type="button" color="light" size="sm" disabled={rows.length >= 100 || definitions.length === 0} onClick={() => onChange([...rows, makeRow(definitions)])}><i className="ri-add-line me-1" />{t("Add item")}</Button>
    </div>
    {definitions.length === 0 && <div className="text-muted small">{t("This repeater has no nested field schema. Configure fields in Content Types.")}</div>}
    {rows.map((row, rowIndex) => <div key={rowIndex} className="border rounded-3 p-3 mb-3">
      <div className="d-flex justify-content-between align-items-center mb-3"><strong>{t("Item")} {rowIndex + 1}</strong><Button type="button" color="danger" outline size="sm" onClick={() => onChange(rows.filter((_, index) => index !== rowIndex))}>{t("Remove")}</Button></div>
      <Row className="g-3">{definitions.map(child => renderChild(child, row, rowIndex))}</Row>
    </div>)}
    {rows.length === 0 && definitions.length > 0 && <div className="text-muted small">{t("No items yet. Add an item to begin.")}</div>}
  </div>;
}
