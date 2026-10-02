import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pictures are resized and converted to WebP by our own server (sharp) and cached on disk under .next/cache/images.
  // Only our own files and the Supabase storage bucket may be fetched by the optimiser (see src/components/pic.tsx).
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/render/image/public/**" },
    ],
    // Replaced uploads keep their address (the slot number), so a resized copy must not outlive the upload for long.
    minimumCacheTTL: 60 * 60,
  },
  async redirects() {
    return [
      { source: "/solutions/mlm-software", destination: "/solutions", permanent: true },
      // The APK is gone (owner's call, 24 Sep 2026) — every old download link now opens the "Install app" page.
      { source: "/poster/Shubhora.apk", destination: "/app", permanent: false },
      { source: "/poster/:file(.*\\.apk)", destination: "/app", permanent: false },
    ];
  },
  async headers() {
    return [
      // The app manifest and the service worker: always fresh, so a new icon or a new worker reaches phones at once.
      { source: "/manifest.webmanifest", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/poster/manifest.json", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      {
      // Every page refuses to be framed — except /preview/*, which the "Website" tab on /poster/card/build shows
      // in a same-origin iframe (DENY there = "refused to connect").
      source: "/((?!preview/).*)",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "DENY" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(self), payment=(self)" },
        { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
      ],
    }, {
      // The public card may sit in a same-origin frame: the installed app shows it in a sheet with a close button
      // instead of navigating away (30 Sep 2026). Other sites still cannot frame it.
      source: "/c/:path*",
      headers: [
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
      ],
    }, {
      source: "/preview/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Robots-Tag", value: "noindex" },
      ],
    }];
  },
};

export default nextConfig;
