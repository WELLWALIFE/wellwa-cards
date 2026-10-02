"use client";
// Connections — every outside account in ONE place (owner's call, 24 Sep 2026: "people can't find where to connect
// WhatsApp, Facebook, Instagram, Google"). Each row shows whether it is connected right now and opens the exact
// screen that connects it. Reached from Home, Me, the top-right menu, Create and Leads.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight, LoaderCircle, MessageCircle, Globe, Star, Radio, Link2, Unplug } from "lucide-react";
import { api, isLoggedIn } from "@/lib/poster-client";
import { fetchSocialAccounts, invalidateSocialAccounts, ProviderIcon, type SocialAccount } from "@/components/poster/social-connect";
import { useT } from "@/lib/poster-i18n";

type State = "on" | "off" | "fix" | "paid" | "loading";
/** `off`: how to disconnect this one (owner's call, 30 Sep 2026: "sab ka connect hai, disconnect nahi") — the
 *  confirmation text says what stops; the call removes it; rows without one (Google reviews rides on the Google
 *  Business connection) show no button. */
type Row = { key: string; icon: React.ReactNode; title: string; what: string; href: string; state: State; detail?: string; off?: { ask: string; run: () => Promise<void> }; /** Switches under the row (what runs on this connection). */ extra?: React.ReactNode };

function Badge({ s, en }: { s: State; en: boolean }) {
  const map: Record<State, [string, string]> = {
    on: ["bg-good/15 text-good", en ? "Connected" : "जुड़ा है"],
    off: ["bg-surface2 text-muted", en ? "Not connected" : "नहीं जुड़ा"],
    fix: ["bg-danger/10 text-danger", en ? "Reconnect" : "दोबारा जोड़ें"],
    paid: ["bg-amber-500/15 text-amber-700", en ? "Growth plan" : "Growth plan"],
    loading: ["bg-surface2 text-faint", "…"],
  };
  const [cls, label] = map[s];
  return <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${cls}`}>{label}</span>;
}

export default function Connections() {
  const router = useRouter();
  const { lang } = useT(); const en = lang === "en";
  const [wa, setWa] = useState<State>("loading");
  const [waNum, setWaNum] = useState("");
  // One WhatsApp link, two things that can run on it (owner's call, 2 Oct 2026: "connection ek hi, checkbox laga do"):
  // the daily Status post (social_accounts.auto_post) and the AI auto-reply (the bridge's config.enabled, Growth plan).
  const [waAi, setWaAi] = useState<boolean | null>(null);
  const [waBusy, setWaBusy] = useState("");
  const [social, setSocial] = useState<SocialAccount[] | null>(null);
  const [google, setGoogle] = useState<{ state: State; name: string }>({ state: "loading", name: "" });
  const [domain, setDomain] = useState<{ state: State; name: string }>({ state: "loading", name: "" });

  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [tick, setTick] = useState(0);
  const reload = () => { invalidateSocialAccounts(); setSocial(null); setWa("loading"); setGoogle({ state: "loading", name: "" }); setDomain({ state: "loading", name: "" }); setTick((t) => t + 1); };

  useEffect(() => {
    (async () => {
      if (!(await isLoggedIn())) { router.push("/login?next=/poster/connect"); return; }
      // WhatsApp AI (the bot on the owner's own number)
      api<{ state?: string; me?: unknown; error?: string; aiActive?: boolean }>("/api/wa/status").then((r) => {
        if (r.status === 402) return setWa("paid");
        if (!r.ok || r.data.error) return setWa("off");
        // Linked on the free plan: the number works (Status, leads) — the AI auto-reply needs Growth.
        setWa(r.data.state === "connected" ? (r.data.aiActive === false ? "paid" : "on") : "off");
        if (r.data.state === "connected") api<{ enabled?: boolean }>("/api/wa/config").then((c) => setWaAi(c.ok ? !!c.data.enabled : false)).catch(() => setWaAi(false));
        // `me` is the linked WhatsApp id, e.g. "919876543210:12@s.whatsapp.net" (or an object with an id).
        const me = typeof r.data.me === "string" ? r.data.me : String((r.data.me as { id?: string } | null)?.id ?? "");
        const digits = me.split(/[:@]/)[0].replace(/\D/g, "");
        setWaNum(digits.length >= 10 ? digits.slice(-10) : "");
      }).catch(() => setWa("off"));
      fetchSocialAccounts(true).then((c) => setSocial(c.accounts)).catch(() => setSocial([]));
      api<{ connected?: boolean; title?: string; location_name?: string }>("/api/google/status").then((r) => {
        setGoogle(r.ok && r.data.connected ? { state: "on", name: r.data.title || r.data.location_name || "" } : { state: "off", name: "" });
      }).catch(() => setGoogle({ state: "off", name: "" }));
      api<{ customDomain?: string }>("/api/site/status").then((r) => {
        const d = r.ok ? r.data.customDomain || "" : "";
        setDomain({ state: d ? "on" : "off", name: d });
      }).catch(() => setDomain({ state: "off", name: "" }));
    })();
  }, [router, tick]);

  async function disconnect(r: Row) {
    if (!r.off || !confirm(r.off.ask)) return;
    setBusy(r.key); setMsg("");
    try { await r.off.run(); setMsg(en ? `${r.title} disconnected.` : `${r.title} हटा दिया गया।`); reload(); }
    catch { setMsg(en ? "Could not disconnect — no internet? Try again." : "हटा नहीं पाए — internet देखकर फिर कोशिश करें।"); }
    finally { setBusy(""); }
  }
  const dropSocial = async (a: SocialAccount | undefined) => { if (a?.id) await api("/api/social/accounts", { method: "DELETE", json: { id: a.id } }); };

  const acct = (p: SocialAccount["provider"]) => (social ?? []).find((a) => a.provider === p && (a.is_active ?? true)) ?? (social ?? []).find((a) => a.provider === p);
  const sState = (p: SocialAccount["provider"]): State => { if (social === null) return "loading"; const a = acct(p); return !a ? "off" : a.status === "reconnect" ? "fix" : "on"; };
  const fb = acct("facebook"); const ig = acct("instagram"); const st = acct("whatsapp");

  const waLinked = wa === "on" || wa === "paid";
  const statusOn = !!st?.auto_post;
  const setStatus = async (on: boolean) => {
    setWaBusy("status"); setMsg("");
    try { await api("/api/social/accounts", { method: "PATCH", json: { action: "wa_enable", value: on } }); invalidateSocialAccounts(); setSocial(null); fetchSocialAccounts(true).then((c) => setSocial(c.accounts)).catch(() => setSocial([])); }
    catch { setMsg(en ? "Could not save — no internet? Try again." : "Save नहीं हुआ — internet देखकर फिर कोशिश करें।"); }
    finally { setWaBusy(""); }
  };
  const setAi = async (on: boolean) => {
    if (wa === "paid") { router.push("/poster/plan"); return; }
    setWaBusy("ai"); setMsg("");
    try { const r = await api<{ enabled?: boolean }>("/api/wa/config", { method: "POST", json: { enabled: on } }); if (r.status === 402) { router.push("/poster/plan"); return; } setWaAi(r.ok ? !!r.data.enabled : waAi); }
    catch { setMsg(en ? "Could not save — no internet? Try again." : "Save नहीं हुआ — internet देखकर फिर कोशिश करें।"); }
    finally { setWaBusy(""); }
  };
  const waSwitches = (
    <div className="space-y-1.5 border-t border-border px-3 py-2.5">
      <p className="text-[11px] font-semibold text-muted">{waLinked ? (en ? "What runs on this number:" : "इस number पर क्या चले:") : (en ? "Link the number first, then choose what runs on it:" : "पहले number link करें, फिर चुनें क्या चले:")}</p>
      <label className={`flex items-center gap-2.5 text-sm ${waLinked ? "" : "opacity-60"}`}>
        <input type="checkbox" className="h-4 w-4" checked={statusOn} disabled={!waLinked || waBusy === "status" || social === null} onChange={(e) => setStatus(e.target.checked)} />
        <Radio className="h-4 w-4 shrink-0 text-[#25D366]" />
        <span className="min-w-0"><span className="block font-medium">{en ? "Daily Status auto-post" : "रोज़ Status पर auto-post"}</span><span className="block text-[11px] text-muted">{en ? "AI poster + voice video on your Status every morning — 14 days free on the free plan." : "रोज़ सुबह AI poster + voice video आपके Status पर — free plan में 14 दिन फ़्री।"}</span></span>
      </label>
      <label className={`flex items-center gap-2.5 text-sm ${waLinked ? "" : "opacity-60"}`}>
        <input type="checkbox" className="h-4 w-4" checked={wa === "on" && !!waAi} disabled={!waLinked || waBusy === "ai" || (wa === "on" && waAi === null)} onChange={(e) => setAi(e.target.checked)} />
        <MessageCircle className="h-4 w-4 shrink-0 text-[#25D366]" />
        <span className="min-w-0"><span className="block font-medium">{en ? "AI auto-reply (chat bot)" : "AI auto-reply (chat bot)"}{wa === "paid" && <span className="ml-1.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Growth plan</span>}</span><span className="block text-[11px] text-muted">{en ? "Answers customers 24×7 from your number; every chat saved as a lead." : "आपके number से customers को 24×7 जवाब; हर chat lead में save।"}</span></span>
      </label>
    </div>
  );
  const rows: { group: string; items: Row[] }[] = [
    { group: "WhatsApp", items: [
      { key: "wa", icon: <MessageCircle className="h-6 w-6 text-[#25D366]" />, title: "WhatsApp", what: en ? "Link once with a code on this phone (or a QR). Status and the AI bot both run on this one link." : "इसी phone पर एक code से एक बार link करें (या QR)। Status और AI bot दोनों इसी एक link पर चलते हैं।", href: "/poster/leads?tab=wa", state: wa, detail: waNum ? `+91 ${waNum}` : undefined, extra: waSwitches,
        off: { ask: en ? "Unlink WhatsApp from Shubhora? Status posting and the AI stop, and new messages will not be saved as leads. You can link again any time with a code." : "WhatsApp को Shubhora से हटाएँ? Status post और AI बंद हो जाएँगे, नए message leads में save नहीं होंगे। कभी भी code से दोबारा जोड़ सकते हैं।", run: async () => { await api("/api/wa/logout", { method: "POST" }); } } },
    ] },
    { group: "Social media", items: [
      { key: "fb", icon: <ProviderIcon provider="facebook" className="h-6 w-6" />, title: "Facebook Page", what: en ? "Auto-post posters and videos to your Page." : "Poster और video आपके Page पर अपने-आप।", href: "/poster/social?tab=facebook", state: sState("facebook"), detail: fb?.name,
        off: { ask: en ? `Disconnect Facebook Page${fb?.name ? ` "${fb.name}"` : ""}? Auto-posting to Facebook stops and ads cannot be made until you connect it again. Nothing on Facebook itself is deleted.` : `Facebook Page${fb?.name ? ` "${fb.name}"` : ""} हटाएँ? Facebook पर auto-post और ads बंद हो जाएँगी, दोबारा जोड़ने तक। Facebook पर कुछ delete नहीं होता।`, run: async () => dropSocial(fb) } },
      { key: "ig", icon: <ProviderIcon provider="instagram" className="h-6 w-6" />, title: "Instagram", what: en ? "Needs a professional account linked to your Facebook Page." : "Professional account चाहिए, Facebook Page से जुड़ा हुआ।", href: "/poster/social?tab=instagram", state: sState("instagram"), detail: ig?.username ? `@${ig.username}` : undefined,
        off: { ask: en ? `Disconnect Instagram${ig?.username ? ` @${ig.username}` : ""}? Auto-posting to Instagram stops until you connect it again.` : `Instagram${ig?.username ? ` @${ig.username}` : ""} हटाएँ? Instagram पर auto-post बंद हो जाएगा, दोबारा जोड़ने तक।`, run: async () => dropSocial(ig) } },
    ] },
    { group: "Google", items: [
      { key: "google", icon: <Globe className="h-6 w-6 text-[#4285F4]" />, title: "Google Business Profile", what: en ? "Your shop on Google Maps & Search — posts, hours, insights." : "Google Maps और Search पर आपकी दुकान — posts, समय, insights।", href: "/poster/social?tab=google", state: google.state, detail: google.name || undefined,
        off: { ask: en ? `Disconnect Google Business Profile${google.name ? ` "${google.name}"` : ""}? Google posts and the reviews inbox stop working here. Your Google listing itself stays as it is.` : `Google Business Profile${google.name ? ` "${google.name}"` : ""} हटाएँ? यहाँ से Google posts और reviews inbox बंद हो जाएँगे। Google पर आपकी listing वैसी ही रहेगी।`, run: async () => { await api("/api/google/status", { method: "DELETE" }); } } },
      { key: "reviews", icon: <Star className="h-6 w-6 text-[#FBBC05]" />, title: en ? "Google reviews" : "Google reviews", what: en ? "See and answer reviews; ask happy customers for one." : "Reviews देखें, जवाब दें, खुश customers से review माँगें।", href: "/poster/social?tab=reviews", state: google.state === "loading" ? "loading" : google.state },
    ] },
    { group: en ? "Your address" : "आपका address", items: [
      { key: "domain", icon: <Link2 className="h-6 w-6 text-brand" />, title: en ? "Own domain (e.g. yourshop.com)" : "अपना domain (जैसे yourshop.com)", what: en ? "Open your card and website on your own web address." : "Card और website आपके अपने web address पर।", href: "/poster/card#domain", state: domain.state, detail: domain.name || undefined,
        off: { ask: en ? `Remove ${domain.name} from your card and website? It will open on shubhora.com again; you can add the domain back any time.` : `${domain.name} को card और website से हटाएँ? वे फिर shubhora.com पर खुलेंगे; domain कभी भी दोबारा जोड़ सकते हैं।`, run: async () => { await api(`/api/domains?domain=${encodeURIComponent(domain.name)}`, { method: "DELETE" }); } } },
    ] },
  ];
  const all = rows.flatMap((g) => g.items);
  const done = all.filter((r) => r.state === "on").length;
  const loading = all.some((r) => r.state === "loading");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold">{en ? "Connections" : "Connections — सब जोड़ें"}</h1>
        <p className="text-sm text-muted">{en ? "WhatsApp, Facebook, Instagram, Google and your domain — all in one place." : "WhatsApp, Facebook, Instagram, Google और आपका domain — सब एक जगह।"}</p>
      </div>
      <div className="rounded-2xl border border-border bg-surface p-3">
        <div className="flex items-center justify-between text-sm"><span className="font-semibold">{en ? "Connected" : "जुड़े हुए"}</span><span className="text-muted">{loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : `${done} / ${all.length}`}</span></div>
        <div className="mt-2 h-2 rounded-full bg-surface2 overflow-hidden"><div className="h-full grad-brand transition-all" style={{ width: `${(done / all.length) * 100}%` }} /></div>
      </div>
      {rows.map((g) => (
        <section key={g.group} className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-faint">{g.group}</p>
          {g.items.map((r) => {
            const connected = r.state === "on" || r.state === "fix" || (r.state === "paid" && r.key === "wa");
            return (
              <div key={r.key} className="rounded-2xl border border-border bg-surface">
                <Link href={r.href} className="flex items-center gap-3 p-3 active:scale-[.99]">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface2">{r.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{r.title}</span>
                    <span className="block text-xs text-muted">{r.detail ? <b className="text-ink">{r.detail}</b> : r.what}</span>
                  </span>
                  <Badge s={r.state} en={en} />
                  <ChevronRight className="h-4 w-4 shrink-0 text-faint" />
                </Link>
                {r.extra}
                {connected && r.off && (
                  <div className="flex items-center justify-end border-t border-border px-3 py-1.5">
                    <button type="button" onClick={() => disconnect(r)} disabled={busy === r.key} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:text-danger disabled:opacity-60">
                      {busy === r.key ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Unplug className="h-3.5 w-3.5" />} {en ? "Disconnect" : "Disconnect करें"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </section>
      ))}
      {msg && <p className="rounded-lg bg-surface2 px-3 py-2 text-sm">{msg}</p>}
      {wa === "paid" && <Link href="/poster/plan" className="block rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs">{en ? "Your WhatsApp is linked. The AI auto-reply comes with the Growth plan — see plans →" : "आपका WhatsApp जुड़ गया है। AI auto-reply Growth plan में है — plans देखें →"}</Link>}
      <p className="text-center text-[11px] text-faint">{en ? "You can always come back here: Me → Connections, or the menu at the top right." : "यहाँ कभी भी आ सकते हैं: Me → Connections, या ऊपर दाएँ menu से।"}</p>
    </div>
  );
}
