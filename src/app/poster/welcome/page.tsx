"use client";
// The first screen after sign-up, kept simple (owner's call, 7 Oct 2026: "ye form simple banao"): congratulations,
// your registration is done, and two buttons. Start opens the set-up; Later opens the app's home — a minimal
// profile is made on the way (the app needs one), and the "Finish your setup" bar brings them back any time.
import Link from "next/link";
import { useEffect, useState } from "react";
import { PartyPopper, ArrowRight, Clock } from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { useT } from "@/lib/poster-i18n";
import { PROFILE_STEPS } from "@/components/poster/profile-steps";

export default function WelcomePage() {
  const { lang } = useT();
  const hi = lang === "hi";
  const [name, setName] = useState("");
  useEffect(() => {
    getBrowserSupabase()?.auth.getUser().then(({ data }) => {
      const m = (data.user?.user_metadata ?? {}) as { display_name?: string; full_name?: string };
      setName((m.display_name || m.full_name || "").trim().split(" ")[0]);
    }).catch(() => undefined);
  }, []);
  return (
    <div className="mx-auto max-w-md space-y-8 py-10 text-center">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-full grad-brand text-white shadow-float"><PartyPopper className="h-9 w-9" /></span>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">{hi ? `बधाई हो${name ? `, ${name}` : ""}!` : `Congratulations${name ? `, ${name}` : ""}!`}</h1>
        <p className="text-base font-semibold">{hi ? "आपका registration हो गया है।" : "Your registration is done."}</p>
        <p className="text-sm text-muted">{/* Owner, 13 Nov 2026: no "5 minutes", no free card — the website is made by the team and delivered within 24–48 hours of the payment. */}
          {hi ? "कुछ details भरिए। Plan चुनने के बाद हमारी team आपकी website और digital business card 24 घंटे में बनाकर देगी।" : "Fill in a few details. After you choose a plan, our team makes your website and digital business card and delivers them within 24 hours."}</p>
      </div>
      <div className="space-y-2">
        <Link href={PROFILE_STEPS[0].href} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-4 text-base font-semibold text-white">
          {/* Owner, 13 Nov 2026: the button says what happens next — a few details are asked — not "Make my card now". */}
          {hi ? "कुछ details भरें" : "Fill in a few details"} <ArrowRight className="h-5 w-5" />
        </Link>
        <Link href="/poster/onboard?skip=1" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3.5 text-sm font-semibold text-muted">
          <Clock className="h-4 w-4" /> {hi ? "बाद में" : "Later"}
        </Link>
        <p className="text-[11px] text-muted">{hi ? "बाद में चुनें तो home खुलेगा — वहाँ से कभी भी शुरू कर सकते हैं।" : "Later opens the home screen — you can start from there any time."}</p>
      </div>
    </div>
  );
}
