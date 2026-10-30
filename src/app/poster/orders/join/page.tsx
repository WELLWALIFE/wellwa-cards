"use client";
// A staff invite link (/poster/orders/join?code=XXXX): log in with your own mobile, join the shop, open its Orders.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { WS_KEY } from "@/components/orders/orders-common";

export default function JoinShopPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [state, setState] = useState<"busy" | "done" | "error" | "nocode" | "login">("busy");
  const [code, setCode] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { (async () => {
    const code = (new URLSearchParams(location.search).get("code") || "").trim().toUpperCase();
    if (!code) { setState("nocode"); return; }
    setCode(code);
    // Not logged in: a new person makes an account with their mobile; someone who has one logs in. Both come back here.
    if (!(await isLoggedIn())) { setState("login"); return; }
    const r = await api<{ owner_id?: string; error?: string }>("/api/crm/team", { method: "POST", json: { join: code } });
    if (!r.ok || !r.data.owner_id) { setErr(r.data.error || ""); setState("error"); return; }
    try { localStorage.setItem(WS_KEY, r.data.owner_id); } catch { /* the link still works with ?as= */ }
    setState("done");
    setTimeout(() => router.replace(`/poster/orders?as=${r.data.owner_id}`), 1200);
  })(); }, [router]);
  return (
    <div className="mx-auto max-w-sm space-y-4 py-16 text-center">
      {state === "busy" && <><LoaderCircle className="mx-auto h-8 w-8 animate-spin text-brand" /><p className="text-sm text-muted">{T("Joining the shop…", "दुकान से जोड़ रहे हैं…")}</p></>}
      {state === "done" && <><CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" /><p className="text-lg font-bold">{T("You are in!", "आप जुड़ गए!")}</p><p className="text-sm text-muted">{T("Opening your work…", "आपका काम खोल रहे हैं…")}</p></>}
      {state === "error" && <><p className="text-lg font-bold">{T("This invite does not work", "यह invite नहीं चल रहा")}</p><p className="text-sm text-muted">{err || T("It may have been changed or stopped. Ask the shop owner for a new invite.", "शायद बदल दिया गया या बंद है। दुकान के owner से नया invite माँगें।")}</p></>}
      {state === "login" && (() => {
        const next = encodeURIComponent(`/poster/orders/join?code=${code}`);
        return (
          <div className="space-y-4 text-left">
            <div className="text-center"><p className="text-2xl">🧵</p><p className="text-lg font-bold">{T("Join your shop's Orders", "अपनी दुकान के Orders से जुड़ें")}</p><p className="text-sm text-muted">{T("Your work will show in this app, and new work comes as a notification.", "आपका काम इसी app में दिखेगा, और नया काम notification से आएगा।")}</p></div>
            <Link href={`/signup?kind=consumer&next=${next}`} className="block rounded-2xl grad-brand p-4 text-white shadow-card"><b className="block">{T("First time? Make your login", "पहली बार? अपना login बनाएँ")}</b><span className="text-xs opacity-90">{T("With your own mobile number and a password — takes a minute", "अपने mobile नंबर और password से — 1 मिनट")}</span></Link>
            <Link href={`/login?next=${next}`} className="block rounded-2xl border border-border bg-surface p-4 shadow-card"><b className="block">{T("I already have a Shubhora login", "मेरा Shubhora login पहले से है")}</b><span className="text-xs text-muted">{T("Log in with your mobile and password", "Mobile और password से login करें")}</span></Link>
            <p className="text-center text-[11px] text-muted">{T("Join code", "Join code")}: <b className="tracking-widest">{code}</b></p>
          </div>
        );
      })()}
      {state === "nocode" && <p className="text-sm text-muted">{T("Open the invite link the shop sent you.", "दुकान ने जो invite link भेजा है वह खोलें।")}</p>}
      {(state === "error" || state === "nocode") && <Link href="/poster" className="inline-block rounded-xl border border-border px-4 py-2 text-sm">{T("Home", "Home")}</Link>}
    </div>
  );
}
