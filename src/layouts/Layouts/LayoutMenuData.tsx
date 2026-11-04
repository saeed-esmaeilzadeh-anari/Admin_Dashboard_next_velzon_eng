"use client";

import React, { useState } from "react";

const Navdata = () => {
  const [cmsOpen, setCmsOpen] = useState(true);

  const menuItems = [
    { label: "CMS", isHeader: true },
    {
      id: "cms-overview",
      label: "Overview",
      icon: "ri-dashboard-2-line",
      link: "/apps-cms",
    },
    {
      id: "cms",
      label: "Content management",
      icon: "ri-file-text-line",
      link: "/#",
      stateVariables: cmsOpen,
      click: (event: React.MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault();
        setCmsOpen(value => !value);
      },
      subItems: [
        { id: "cms-content", label: "Content library", link: "/apps-cms/content" },
        { id: "cms-types", label: "Content types and fields", link: "/apps-cms/content-types" },
        { id: "cms-languages", label: "Languages and locales", link: "/apps-cms/languages" },
        { id: "cms-media", label: "Media library", link: "/apps-cms/media" },
        { id: "cms-taxonomies", label: "Taxonomies and terms", link: "/apps-cms/taxonomies" },
        { id: "cms-menus", label: "Navigation menus", link: "/apps-cms/menus" },
        { id: "cms-redirects", label: "Redirect manager", link: "/apps-cms/redirects" },
        { id: "cms-forms", label: "Forms and submissions", link: "/apps-cms/forms" },
        { id: "cms-webhooks", label: "Webhooks and integrations", link: "/apps-cms/webhooks" },
        { id: "cms-import-export", label: "Import and export", link: "/apps-cms/import-export" },
      ],
    },
    { label: "Administration", isHeader: true },
    { id: "cms-users", label: "User management", icon: "ri-user-settings-line", link: "/apps-cms/users" },
    { id: "cms-permissions", label: "Role permissions", icon: "ri-shield-user-line", link: "/apps-cms/permissions" },
    { id: "cms-audit", label: "Audit log", icon: "ri-history-line", link: "/apps-cms/audit-logs" },
  ];

  return <React.Fragment>{menuItems}</React.Fragment>;
};

export default Navdata;
