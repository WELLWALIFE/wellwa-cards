// The owner's unpublished V-Card shown as the desktop website, inside the "Website" preview on
// /poster/card/build (an iframe, so the real desktop layout renders even on a phone). Never indexed.
import type { Metadata } from "next";
import { PreviewSite } from "./view";

export const metadata: Metadata = {
  title: "Website preview",
  robots: { index: false, follow: false },
};

export default function PreviewSitePage() {
  return <PreviewSite />;
}
