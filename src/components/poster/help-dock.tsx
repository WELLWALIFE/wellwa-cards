"use client";
// Help, on every screen: "Call for live help" with two choices (owner, 19 Oct 2026, to keep it clear):
//   1. Admin     → the same Share Screen as a link, but as a request the Shubhora admin sees at once in the console.
//   2. Franchise → a link to send on WhatsApp to anyone (franchise, upline, a friend), who then sees the Shubhora screen, view only.
// Both are shown only after the person confirms (components/poster/share-screen.tsx).

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { CircleQuestionMark, Eye, Headset, ShieldCheck, X } from "lucide-react";
import { isLoggedIn } from "@/lib/poster-client";
import { SHARE_SCREEN_EVENT } from "@/components/poster/share-screen";
import { useT } from "@/lib/poster-i18n";

export function HelpDock() {
  const path = usePathname() ?? "/poster";
  const { lang } = useT();
  const hi = lang !== "en";
  const [open, setOpen] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  // Checked again on every screen and whenever the session changes (owner, 4 Oct 2026: the button had vanished):
  // one check at mount could run before the session was there — right after a login, or the demo reset — and
  // then the button never came.
  useEffect(() => {
    let on = true;
    const check = () => { isLoggedIn().then((v) => { if (on) setSignedIn(v); }).catch(() => { if (on) setSignedIn(false); }); };
    check();
    const sb = getBrowserSupabase();
    const { data: sub } = sb?.auth.onAuthStateChange(() => check()) ?? { data: { subscription: null } };
    const t = setTimeout(check, 1500);
    return () => { on = false; clearTimeout(t); sub.subscription?.unsubscribe(); };
  }, [path]);
  useEffect(() => { setOpen(false); }, [path]);

  /** Admin or Franchise: both are the same Share Screen (a request / a link), asked for here and confirmed in its own dialog. */
  function openShare(kind: "admin" | "link") {
    setOpen(false);
    window.dispatchEvent(new CustomEvent(SHARE_SCREEN_EVENT, { detail: { kind } }));
  }

  if (!signedIn) return null;

  return (
    <>
      {/* The Help button: same corner on every screen. */}
      <button type="button" onClick={() => setOpen(true)} aria-label={hi ? "मदद" : "Help"}
        className="fixed right-3 z-40 grid h-12 w-12 place-items-center rounded-full border border-border bg-surface text-brand shadow-xl"
        style={{ bottom: "calc(68px + env(safe-area-inset-bottom))" }}>
        <CircleQuestionMark className="h-6 w-6" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[55] flex items-end justify-center bg-black/40" onClick={() => setOpen(false)}>
          <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-surface p-5 pb-8" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <p className="flex items-center gap-2 text-lg font-bold"><Headset className="h-5 w-5 text-brand" /> {hi ? "Live help बुलाएँ" : "Call for live help"}</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-muted"><X className="h-5 w-5" /></button>
            </div>

            <div className="space-y-3">
                <button type="button" onClick={() => openShare("admin")}
                  className="flex w-full items-center gap-3 rounded-2xl grad-brand px-4 py-3.5 text-left text-white">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-bold">1</span>
                  <span className="min-w-0"><span className="block text-base font-bold">{hi ? "Admin" : "Admin"}</span>
                    <span className="block text-xs text-white/85">{hi ? "Shubhora की team आपकी screen देखकर बताएगी" : "The Shubhora team watches your screen and guides you"}</span></span>
                  <Headset className="ml-auto h-5 w-5 shrink-0" />
                </button>
                <button type="button" onClick={() => openShare("link")}
                  className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-ink">2</span>
                  <span className="min-w-0"><span className="block text-base font-bold">{hi ? "Franchise" : "Franchise"}</span>
                    <span className="block text-xs text-muted">{hi ? "एक link बनता है, उसे अपने franchise/upline या किसी को भी WhatsApp पर भेजें" : "Get a link and send it on WhatsApp to your franchise, upline or anyone you trust"}</span></span>
                  <Eye className="ml-auto h-5 w-5 shrink-0 text-brand" />
                </button>
            </div>

            <p className="mt-4 flex gap-2 rounded-xl bg-surface2 px-3 py-2.5 text-xs leading-snug text-muted">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-good" />
              <span>{hi
                ? "सिर्फ़ Shubhora screen दिखेगी: आपका कोई दूसरा app या phone की screen नहीं, और password कभी नहीं। वो सिर्फ़ देख सकते हैं, कुछ कर नहीं सकते। 15 मिनट बाद या आपके End दबाने पर बंद हो जाता है।"
                : "Only your Shubhora screen is shown: no other app, no phone screen, never a password. They can only look, never do anything. It ends after 15 minutes, or when you tap End."}</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
