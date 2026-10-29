import ClientProviders from "@/components/ClientProviders";
import { Metadata } from "next";
import React from "react";
import { hkGrotesk, iransansweb } from '@/config/fonts';
import "../assets/scss/themes.scss";
// ApexCharts default styles
import "apexcharts/dist/apexcharts.css";
// Swiper styles
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

const siteName = process.env.NEXT_PUBLIC_SITE_NAME?.trim() || "Velzon CMS";

export const metadata: Metadata = {
  title: {
    default: siteName + " | Multilingual CMS",
    template: "%s | " + siteName,
  },
  description: "Multilingual content management with editorial workflow, media library and localized publishing.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa" dir="rtl" className={iransansweb.variable}>
      <body
        suppressHydrationWarning={true}
      >
        <ClientProviders>{children}</ClientProviders>
      </body>
    </html>
  );
}
