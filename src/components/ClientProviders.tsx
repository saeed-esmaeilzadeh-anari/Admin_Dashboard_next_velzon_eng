"use client";

import React, { useEffect } from "react";
import i18n from "@common/data/i18n";
import { Providers } from "@/providers";
import { Toaster } from "react-hot-toast";
import FakeBackendProvider from "./providers/FakeBackendProvider";

export default function ClientProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    const applyDirection = (language?: string) => {
      const activeLanguage = language || i18n.resolvedLanguage || i18n.language || "en";
      const baseLanguage = activeLanguage.toLowerCase().split("-")[0];
      document.documentElement.lang = activeLanguage;
      document.documentElement.dir = ["ar", "fa", "he", "ur"].includes(baseLanguage) ? "rtl" : "ltr";
    };
    applyDirection();
    i18n.on("languageChanged", applyDirection);
    return () => { i18n.off("languageChanged", applyDirection); };
  }, []);
  return (
    <FakeBackendProvider>
      <Providers>
        {children}
        <Toaster position="top-right" />
      </Providers>
    </FakeBackendProvider>
  );
}
