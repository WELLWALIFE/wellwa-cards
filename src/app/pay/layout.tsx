import type { Metadata } from "next";
import { UiLangProvider } from "@/lib/poster-i18n";

export const metadata: Metadata = { title: "Payment — Shubhora", robots: { index: false, follow: false } };

export default function PayLayout({ children }: { children: React.ReactNode }) {
  return <UiLangProvider>{children}</UiLangProvider>;
}
