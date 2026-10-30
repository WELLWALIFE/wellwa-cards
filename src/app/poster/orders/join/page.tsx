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
  const [state, setState] = useState<"busy" | "done" | "error" | "nocode">("busy");
  const [err, setErr] = useState("");
  useEffect(() => { (async () => {
    const code = (new URLSearchParams(location.search).get("code") || "").trim().toUpperCase();
    if (!code) { setState("nocode"); return; }
    if (!(await isLoggedIn())) { router.replace(`/login?next=${encodeURIComponent(`/poster/orders/join?code=${code}`)}`); return; }
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
      {state === "nocode" && <p className="text-sm text-muted">{T("Open the invite link the shop sent you.", "दुकान ने जो invite link भेजा है वह खोलें।")}</p>}
      {state !== "busy" && state !== "done" && <Link href="/poster" className="inline-block rounded-xl border border-border px-4 py-2 text-sm">{T("Home", "Home")}</Link>}
    </div>
  );
}
