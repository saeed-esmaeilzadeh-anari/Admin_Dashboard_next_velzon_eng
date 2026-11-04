// app/(with-layout)/layout.tsx
import React from "react";
import Layout from "@/layouts/Layouts";

// This route group contains authenticated administration pages. Keep it dynamic
// so session-aware middleware is evaluated before any HTML can be prerendered
// and cached for anonymous visitors.
export const dynamic = "force-dynamic";

export default function WithLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Layout>{children}</Layout>;
}
