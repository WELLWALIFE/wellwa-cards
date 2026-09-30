import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { AdminReturnBar } from "@/components/admin-return-bar";
import { AccountGuard } from "@/components/account-guard";
import { OG_IMAGE } from "@/lib/site-brand";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com"),
  title: "Shubhora — Software that runs your business online",
  description:
    "Shubhora Business Suite: website, daily posters, social media posting, WhatsApp AI assistant and lead CRM in one subscription. Plus custom AI software and automation.",
  openGraph: {
    title: "Shubhora — Software that runs your business online",
    description: "Website, daily posters, social posting, WhatsApp AI and CRM for your business, in one subscription.",
    type: "website",
    siteName: "Shubhora",
    images: [OG_IMAGE],
  },
  twitter: { card: "summary_large_image", images: [OG_IMAGE.url] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive">
          {`try{var t=localStorage.getItem('wellwa-theme');if(t){document.documentElement.dataset.theme=t;}}catch(e){}`}
        </Script>
        {/* "Install app" (PWA): keep Chrome's install signal for our button. Chrome's own pop-up still shows too. */}
        <Script id="pwa-install" strategy="beforeInteractive">
          {`window.__bip=null;window.addEventListener('beforeinstallprompt',function(e){window.__bip=e;window.dispatchEvent(new Event('bip-ready'));});window.addEventListener('appinstalled',function(){window.__bip=null;try{localStorage.setItem('shubhora.installed','1')}catch(x){}});`}
        </Script>
        {children}
        <AdminReturnBar />
        <AccountGuard />
      </body>
    </html>
  );
}
