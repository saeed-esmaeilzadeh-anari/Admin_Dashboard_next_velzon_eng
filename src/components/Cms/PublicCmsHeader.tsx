import React from "react";
import type { CmsPublicMenu, CmsPublicMenuItem } from "@/helpers/cmsApi";

function safeMenuHref(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const candidate = value.trim();
  if (candidate.startsWith("/") && !candidate.startsWith("//") && !/[\\r\\n\\\\]/.test(candidate)) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" && !url.username && !url.password ? url.toString() : null;
  } catch {
    return null;
  }
}

function renderMenuItems(items: CmsPublicMenuItem[]): React.ReactNode {
  if (!items.length) return null;
  return <ul style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, listStyle: "none", padding: 0, margin: 0 }}>
    {items.map(item => {
      const href = safeMenuHref(item.href);
      return <li key={item.id}>
        {href
          ? <a href={href} target={item.targetBlank ? "_blank" : undefined}
              rel={item.targetBlank ? "noopener noreferrer" : undefined}
              style={{ display: "inline-block", padding: "6px 9px", borderRadius: 8, color: "inherit", textDecoration: "none", fontSize: 14 }}>{item.label}</a>
          : <span style={{ display: "inline-block", padding: "6px 9px", color: "var(--vz-secondary-color, #74788d)", fontSize: 14 }}>{item.label}</span>}
        {item.children?.length
          ? <div style={{ paddingInlineStart: 12, marginTop: 4, borderInlineStart: "1px solid var(--vz-border-color, #e9ebec)" }}>{renderMenuItems(item.children)}</div>
          : null}
      </li>;
    })}
  </ul>;
}

export default function PublicCmsHeader({ menu, localeCode }: { menu: CmsPublicMenu | null; localeCode: string }) {
  if (!menu) return null;
  const siteName = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || menu.name;
  const language = localeCode.toLowerCase();
  const navLabel = language.startsWith("fa") ? "ناوبری اصلی"
    : language.startsWith("ar") ? "التنقل الرئيسي"
    : "Main navigation";
  return <header style={{ maxWidth: 1120, margin: "0 auto 24px", padding: "14px 18px", border: "1px solid var(--vz-border-color, #e9ebec)", borderRadius: 14, background: "var(--vz-card-bg, #fff)" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
      <span style={{ fontWeight: 700, color: "inherit", fontSize: 18 }}>{siteName}</span>
      <nav aria-label={navLabel}>{renderMenuItems(menu.items)}</nav>
    </div>
  </header>;
}
