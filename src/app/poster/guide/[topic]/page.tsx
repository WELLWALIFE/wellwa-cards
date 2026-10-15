"use client";
// Step-by-step help: create a Facebook Page / make Instagram professional / link them.
import { useParams, useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { goBack } from "@/lib/nav-back";
const GUIDES = {
  facebook: {
    hi: { title: "Facebook Page कैसे बनाएँ", steps: ["Facebook app खोलें → Menu (☰) → Pages → Create", "Page का नाम (दुकान/business का नाम) और category (जैसे Product/Service) डालें", "Bio में अपना नंबर और पता डालें, profile photo में logo लगाएँ", "Create दबाएँ — Page तैयार", "Shubhora → सोशल → Facebook → 'Facebook Page जोड़ें' → login → अपना Page चुनें"] },
    en: { title: "How to create a Facebook Page", steps: ["Open the Facebook app → Menu (☰) → Pages → Create", "Enter the Page name (your shop/business) and a category", "Add your number and address in the bio, your logo as the profile photo", "Tap Create — the Page is ready", "Shubhora → Social → Facebook → 'Connect Facebook Page' → log in → pick your Page"] },
  },
  instagram: {
    hi: { title: "Instagram को Professional बनाएँ और Page से जोड़ें", steps: ["Instagram app → Profile → ☰ → Settings → Account type and tools → Switch to professional account", "Business चुनें, category चुनें", "Settings → Business tools and controls → Connect a Facebook Page → अपना Facebook Page चुनें", "Shubhora → सोशल → Instagram → 'Instagram जोड़ें' → login → account चुनें", "अगर account नहीं दिखे तो Page और Instagram दोनों एक ही Facebook login से जुड़े होने चाहिए"] },
    en: { title: "Make Instagram professional & link it to your Page", steps: ["Instagram app → Profile → ☰ → Settings → Account type and tools → Switch to professional account", "Choose Business and a category", "Settings → Business tools and controls → Connect a Facebook Page → pick your Page", "Shubhora → Social → Instagram → 'Connect Instagram' → log in → pick the account", "If it doesn't show up, the Page and Instagram must be linked under the same Facebook login"] },
  },
  whatsapp: {
    hi: { title: "WhatsApp AI कैसे चालू करें", steps: ["Shubhora → लीड्स → WhatsApp AI tab", "QR code दिखेगा — अपने phone के WhatsApp में Linked devices → Link a device → QR scan करें", "Connect होते ही bot आपके card की जानकारी से जवाब देने लगेगा", "आप खुद जवाब दें तो bot 15 min चुप रहता है", "सोशल → Status → 'रोज़ Status पर लगाओ' ON करें"] },
    en: { title: "How to turn on WhatsApp AI", steps: ["Shubhora → Leads → WhatsApp AI tab", "A QR code appears — on your phone: WhatsApp → Linked devices → Link a device → scan", "Once connected the bot replies using your card's details", "If you reply yourself the bot stays quiet for 15 minutes", "Social → Status → turn on 'Post to Status daily'"] },
  },
} as const;
export default function GuidePage() {
  const { topic } = useParams<{ topic: string }>(); const { lang } = useT();
  const router = useRouter();
  const g = GUIDES[topic as keyof typeof GUIDES]?.[lang === "en" ? "en" : "hi"];
  // Opened from Me (Help), Social (a tab's "how to make one?") and Home: Back = the screen the owner was just on, at the top and at the bottom alike.
  // Opened fresh, the place where that account is connected (Facebook / Instagram: its Social tab; WhatsApp: Connections).
  const back = () => goBack(router, topic === "instagram" ? "/poster/social?tab=instagram" : topic === "whatsapp" ? "/poster/connect" : "/poster/social?tab=facebook");
  const backLabel = lang === "en" ? "Back" : "पीछे";
  if (!g) return (
    <div className="space-y-4">
      <button type="button" onClick={back} className="text-muted" aria-label={backLabel}><ChevronLeft className="h-5 w-5" /></button>
      <p className="text-sm text-muted">{lang === "en" ? "Not found" : "यह पेज नहीं मिला"}</p>
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2"><button type="button" onClick={back} className="text-muted" aria-label={backLabel}><ChevronLeft className="h-5 w-5" /></button><h1 className="text-lg font-bold">{g.title}</h1></div>
      <ol className="space-y-2">{g.steps.map((s, i) => <li key={i} className="flex gap-3 rounded-xl border border-border p-3 text-sm"><span className="h-6 w-6 shrink-0 rounded-full grad-brand text-white grid place-items-center text-xs font-bold">{i + 1}</span><span>{s}</span></li>)}</ol>
      <button type="button" onClick={back} className="block w-full text-center rounded-xl grad-brand px-4 py-3 text-sm font-semibold text-white">{backLabel}</button>
    </div>
  );
}
