import type { MetadataRoute } from "next";

// The Shubhora app = this website installed from the browser (PWA, Chrome's "Install app"). Owner's call, 24 Sep 2026:
// no APK any more — one install button on the site, the new logo, always the latest version.
// `id` stays "/dashboard" (what the earlier manifest's start_url made it) so phones that already installed it are still
// recognised as installed; the app itself now opens on /poster, the phone app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/dashboard",
    name: "Shubhora",
    short_name: "Shubhora",
    description: "Your digital card, daily posters, WhatsApp AI, leads and team — in one app.",
    start_url: "/poster",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#2f5bf5",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/app-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/app-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
