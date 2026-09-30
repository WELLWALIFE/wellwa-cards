"use client";
// The plain-words permission note shown right above every "Connect" button (owner's call, 30 Sep 2026): what we will
// access, what we will never touch, and that Disconnect is always one tap away. Facebook / Google show their own
// "Allow" screen after this; WhatsApp has none (it links with a code), so here the note IS the consent.
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { useT } from "@/lib/poster-i18n";

export type ConsentKind = "facebook" | "instagram" | "google" | "whatsapp";

const TEXT: Record<ConsentKind, { en: [string, string]; hi: [string, string] }> = {
  facebook: {
    en: ["By connecting you allow Shubhora to post your posters and videos on your Facebook Page, read its comments and reviews, and — only when you ask — make and start ads on your own ad account.", "We never see your password, friends or personal messages."],
    hi: ["Connect करने पर Shubhora आपके Facebook Page पर poster/video post करेगा, उसके comments और reviews पढ़ेगा, और — सिर्फ़ आपके कहने पर — आपके अपने ad account से ads बनाएगा।", "आपका password, friends या personal messages हम कभी नहीं देखते।"],
  },
  instagram: {
    en: ["By connecting you allow Shubhora to post your posters and videos on your Instagram account and read comments on them.", "We never see your password, followers' data or DMs."],
    hi: ["Connect करने पर Shubhora आपके Instagram पर poster/video post करेगा और उन पर आए comments पढ़ेगा।", "आपका password, followers का data या DMs हम कभी नहीं देखते।"],
  },
  google: {
    en: ["By connecting you allow Shubhora to post updates on your Google Business Profile, read and answer its reviews, and read its insights.", "We never touch your Gmail, Drive or other Google data."],
    hi: ["Connect करने पर Shubhora आपकी Google Business Profile पर updates post करेगा, उसके reviews पढ़ेगा/जवाब देगा और insights देखेगा।", "आपका Gmail, Drive या बाकी Google data हम कभी नहीं छूते।"],
  },
  whatsapp: {
    en: ["By linking, the customer messages that arrive on this number are read by the Shubhora assistant so it can reply for you, and each customer is saved as a lead — your customers' data stays yours.", "Personal chats are not part of this; you can unlink from Connections any time."],
    hi: ["Link करने पर इस नंबर पर आने वाले customer messages Shubhora assistant पढ़ेगा ताकि आपकी तरफ़ से जवाब दे सके, और हर customer एक lead की तरह save होगा — आपके customers का data आपका ही रहता है।", "Personal chats इसका हिस्सा नहीं; Connections से कभी भी unlink कर सकते हैं।"],
  },
};

export function ConnectConsent({ kind, className = "" }: { kind: ConsentKind; className?: string }) {
  const { lang } = useT(); const en = lang === "en";
  const [a, b] = en ? TEXT[kind].en : TEXT[kind].hi;
  return (
    <p className={`flex items-start gap-2 rounded-lg bg-surface2 px-3 py-2 text-left text-[11px] leading-snug text-muted ${className}`}>
      <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-good" />
      <span>{a} {b} <Link href="/privacy#connections" target="_blank" className="underline">{en ? "Privacy" : "Privacy"}</Link> · <Link href="/poster/connect" className="underline">{en ? "Disconnect any time" : "कभी भी Disconnect"}</Link></span>
    </p>
  );
}
