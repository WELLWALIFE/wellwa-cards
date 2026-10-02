"use client";
// The first screen after sign-up (owner's call, 2 Oct 2026): congratulations, and one promise — fill your profile,
// the website and the V-Card are made from it. "Later" opens the app; the "Finish your setup" bar brings them back.
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
    <div className="mx-auto max-w-md space-y-6 py-6 text-center">
      <span className="mx-auto grid h-16 w-16 place-items-center rounded-full grad-brand text-white shadow-float"><PartyPopper className="h-8 w-8" /></span>
      <div>
        <h1 className="text-2xl font-bold">{hi ? `बधाई हो${name ? `, ${name}` : ""}!` : `Congratulations${name ? `, ${name}` : ""}!`}</h1>
        <p className="mt-2 text-sm text-muted">
          {hi ? "आपका Shubhora account बन गया। अब सिर्फ़ अपनी profile भरिए — आपकी website और V-Card अपने आप बन जाएँगे।"
            : "Your Shubhora account is ready. Now just fill your profile — your website and V-Card are made from it."}
        </p>
      </div>
      <ol className="space-y-1.5 text-left text-sm">
        {PROFILE_STEPS.map((s, i) => (
          <li key={s.key} className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink">{i + 1}</span>
            <span className="font-medium">{hi ? s.hi : s.en}</span>
          </li>
        ))}
      </ol>
      <div className="space-y-2">
        <Link href={PROFILE_STEPS[0].href} className="inline-flex w-full items-center justify-center gap-2 rounded-2xl grad-brand py-4 text-base font-semibold text-white">
          {hi ? "Profile भरें (5 मिनट)" : "Fill my profile (5 min)"} <ArrowRight className="h-5 w-5" />
        </Link>
        <Link href="/poster" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-3.5 text-sm font-semibold text-muted">
          <Clock className="h-4 w-4" /> {hi ? "बाद में" : "Later"}
        </Link>
        <p className="text-[11px] text-muted">{hi ? "बाद में करें तो भी कोई बात नहीं — \"Finish your setup\" आपको यहीं वापस लाएगा।" : "Later is fine too — \"Finish your setup\" brings you right back here."}</p>
      </div>
    </div>
  );
}
