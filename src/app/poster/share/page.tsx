"use client";
// /poster/share — the card link and the LEFT / RIGHT join links, each with WhatsApp, copy, share and QR.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { ShareLinks } from "@/components/poster/share-links";

export default function SharePage() {
  const router = useRouter();
  const { lang } = useT(); const en = lang === "en";
  useEffect(() => { isLoggedIn().then((ok) => { if (!ok) router.push("/login?next=/poster/share"); }); }, [router]);
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">{en ? "Share my links" : "मेरे links share करें"}</h1>
      <p className="text-sm text-muted">{en ? "Your card link is for your customers. To build a team, partners also get a Left link and a Right link." : "Card का link आपके customers के लिए है। Team बनाने के लिए partners को Left और Right link भी मिलते हैं।"}</p>
      <ShareLinks />
    </div>
  );
}
