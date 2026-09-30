"use client";
// Google Business Profile: connect (platform client, or the user's own OAuth
// client under "Advanced"), pick a location, business summary + 28-day
// insights, auto-post today's poster, custom updates, AI review auto-reply.
import { ConnectConsent } from "@/components/poster/connect-consent";
import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Plus, Send, Check, Trash2, MapPin, Star, RefreshCw, ExternalLink, ChevronDown, Phone, Globe, Navigation, Eye } from "lucide-react";
import { api, currentProfileId, type Profile, type Poster } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";

type Loc = { name: string; title: string; address: string; phone: string; maps: string };
type Ins = { days?: number; impressions?: number; website?: number; calls?: number; directions?: number; series?: { day: string; impressions: number }[] };
type Status = { configured: boolean; source: string; own_client: boolean; connected: boolean; title: string; status: string; auto_post: boolean; auto_reply: boolean; address: string; phone: string; maps_url: string; rating: number | null; review_count: number; insights: Ins; last_error: string; locations: Loc[]; location_name: string; redirect_uri: string };
const inputCls = "w-full rounded-xl border border-border bg-surface2/50 px-3 py-2 text-sm outline-none focus:border-brand";

export function GooglePanel({ onReviews }: { onReviews?: () => void }) {
  const { lang } = useT(); const hi = lang !== "en";
  const [s, setS] = useState<Status | null>(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [adv, setAdv] = useState(false);
  const [own, setOwn] = useState({ client_id: "", client_secret: "" });
  const [custom, setCustom] = useState({ open: false, text: "", image_url: "", cta: "CALL" as "CALL" | "LEARN_MORE" | "BOOK", url: "" });

  const load = useCallback(async () => { const r = await api<Status>("/api/google/status"); if (r.ok) setS(r.data); }, []);
  useEffect(() => {
    load();
    try {
      const q = new URLSearchParams(window.location.search);
      if (q.get("google") === "ok") setMsg(q.get("pick") ? ("✅ Connected — pick your location below.") : ("✅ Google Business connected."));
      if (q.get("google") === "error") setMsg(("⚠️ Could not connect: ") + (q.get("reason") ?? ""));
    } catch { /* ignore */ }
  }, [load, hi]);

  async function connect(withOwn = false) {
    setBusy("connect"); setMsg("");
    const r = await api<{ url?: string; error?: string }>("/api/google/connect", { method: "POST", json: { return_to: "/poster/social?tab=google", ...(withOwn ? own : {}) } });
    setBusy("");
    if (!r.ok || !r.data.url) { setMsg(r.data.error ?? "Failed"); return; }
    window.location.href = r.data.url;
  }
  async function patch(p: Record<string, unknown>) { setBusy("patch"); await api("/api/google/status", { method: "PATCH", json: p }); await load(); setBusy(""); }
  async function disconnect() { if (!confirm("Disconnect Google Business?")) return; await api("/api/google/status", { method: "DELETE" }); load(); }
  async function postNow() {
    setBusy("post"); setMsg("");
    const pr = await api<{ profiles: Profile[] }>("/api/poster/profiles");
    const list = pr.data.profiles ?? []; const p = list.find((x) => x.id === currentProfileId()) ?? list.find((x) => x.is_default) ?? list[0];
    if (!p) { setMsg("Create a profile first."); setBusy(""); return; }
    const td = await api<{ poster?: Poster; message?: string }>(`/api/poster/today?profile=${p.id}`);
    if (!td.data.poster) { setMsg(td.data.message ?? "Poster not ready"); setBusy(""); return; }
    const r = await api<{ ok?: boolean; error?: string }>("/api/google/post", { method: "POST", json: { poster_id: td.data.poster.id } });
    setMsg(r.ok ? ("✅ Posted to Google.") : (r.data.error ?? "Failed")); setBusy("");
  }
  async function postCustom() {
    setBusy("custom"); setMsg("");
    const r = await api<{ ok?: boolean; error?: string }>("/api/google/post", { method: "POST", json: { text: custom.text, image_url: custom.image_url || undefined, cta: custom.cta, url: custom.url || undefined } });
    setMsg(r.ok ? ("✅ Update is live on Google.") : (r.data.error ?? "Failed")); setBusy("");
    if (r.ok) setCustom({ open: false, text: "", image_url: "", cta: "CALL", url: "" });
  }

  if (!s) return <div className="py-12 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>;
  const ins = s.insights ?? {};
  const maxImp = Math.max(1, ...((ins.series ?? []).map((x) => x.impressions)));
  return (
    <div className="space-y-3">
      <Guide hi="Google Business Profile = your shop on Google Search and Maps. Once connected: the daily poster goes up as a Google update, the AI answers your Google reviews, and views / calls / directions show right here." en="Google Business Profile = your shop on Google Search and Maps. Once connected: the daily poster goes up as a Google update, the AI answers your Google reviews, and views / calls / directions show right here." />
      {msg && <p className="text-sm rounded-lg bg-surface2 px-3 py-2">{msg}</p>}

      {!s.connected ? (
        <section className="rounded-xl border border-border p-4 space-y-3">
          <div className="text-center space-y-2">
            <span className="mx-auto h-12 w-12 rounded-full bg-white border border-border grid place-items-center text-xl font-black text-[#4285F4]">G</span>
            <p className="text-sm text-muted">{"Google Business is not connected"}</p>
            <ConnectConsent kind="google" />
            <button type="button" onClick={() => connect(false)} disabled={busy === "connect" || !s.configured} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#4285F4] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
              {busy === "connect" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} {"Connect Google Business"}
            </button>
            <p className="text-[11px] text-faint">{"Log in with the Google account that owns your Business Profile. One click, no API keys."}</p>
            {!s.configured && <p className="rounded-lg bg-lead/10 px-3 py-2 text-[11px] text-lead">{"The platform's Google setup is pending (admin adds the Google Cloud client). Until then you can use your own client under Advanced."}</p>}
            <a href="https://business.google.com/" target="_blank" rel="noreferrer" className="block text-xs text-brand-ink">{"How to create a Google Business Profile (free)"} ↗</a>
          </div>
          <details open={adv} onToggle={(e) => setAdv((e.target as HTMLDetailsElement).open)} className="rounded-lg border border-dashed border-border px-3 py-2 text-xs">
            <summary className="cursor-pointer font-semibold text-muted">{"Advanced: use your own Google Cloud OAuth client"}</summary>
            <div className="mt-2 space-y-2">
              <p className="text-muted">{hi ? "Google Cloud → APIs & Services → Credentials → OAuth client (Web). Redirect URI:" : "Google Cloud → APIs & Services → Credentials → OAuth client (Web). Redirect URI:"} <code className="text-ink">{s.redirect_uri}</code>. {"Enable the Business Profile APIs and get access approval too."}</p>
              <input value={own.client_id} onChange={(e) => setOwn({ ...own, client_id: e.target.value })} placeholder="Client ID (….apps.googleusercontent.com)" className={inputCls + " mono text-xs"} />
              <input value={own.client_secret} onChange={(e) => setOwn({ ...own, client_secret: e.target.value })} placeholder="Client secret" type="password" className={inputCls + " mono text-xs"} />
              <button type="button" disabled={busy === "connect" || !own.client_id || !own.client_secret} onClick={() => connect(true)} className="w-full rounded-xl border border-border py-2 text-xs font-semibold text-ink disabled:opacity-50">{"Connect with my client"}</button>
            </div>
          </details>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-border p-3 space-y-3">
            <div className="flex items-start gap-2.5">
              <span className="h-10 w-10 shrink-0 rounded-full bg-white border border-border grid place-items-center text-lg font-black text-[#4285F4]">G</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate flex items-center gap-1.5">{s.title || "Google Business"} <Check className="h-4 w-4 text-good" /></p>
                {s.address && <p className="text-[11px] text-muted flex items-center gap-1"><MapPin className="h-3 w-3" />{s.address}</p>}
                <p className="text-[11px] text-muted flex flex-wrap items-center gap-2">
                  {s.rating !== null && <span className="inline-flex items-center gap-0.5 text-ink font-semibold"><Star className="h-3 w-3 fill-lead text-lead" />{Number(s.rating).toFixed(1)} <span className="font-normal text-muted">({s.review_count} {hi ? "reviews" : "reviews"})</span></span>}
                  {s.maps_url && <a href={s.maps_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-brand-ink">Maps <ExternalLink className="h-3 w-3" /></a>}
                  {s.status === "reconnect" && <span className="text-lead">⚠️ {"reconnect needed"}</span>}
                </p>
              </div>
              <button type="button" onClick={() => patch({ refresh: true })} className="p-1 text-muted" aria-label="Refresh"><RefreshCw className={`h-4 w-4 ${busy === "patch" ? "animate-spin" : ""}`} /></button>
              <button type="button" onClick={disconnect} className="p-1 text-muted" aria-label="Disconnect"><Trash2 className="h-4 w-4" /></button>
            </div>
            {s.locations.length > 1 && (
              <label className="flex items-center gap-2 text-xs text-muted"><span>{hi ? "Location" : "Location"}</span>
                <span className="relative flex-1"><select value={s.location_name} onChange={(e) => patch({ location_name: e.target.value })} className="w-full appearance-none rounded-lg border border-border bg-surface px-2 py-1.5 pr-7 text-xs text-ink">{s.locations.map((l) => <option key={l.name} value={l.name}>{l.title}{l.address ? ` — ${l.address}` : ""}</option>)}</select><ChevronDown className="pointer-events-none absolute right-2 top-2 h-3.5 w-3.5" /></span>
              </label>
            )}
            {s.last_error && <p className="rounded-lg bg-danger/10 px-2 py-1 text-[11px] text-danger">{s.last_error}</p>}
          </section>

          {/* insights */}
          <section className="rounded-xl border border-border p-3">
            <div className="mb-2 flex items-center justify-between text-xs"><span className="font-semibold text-ink">{hi ? "Pichle 28 din Google par" : "Last 28 days on Google"}</span>{ins.impressions === undefined && <span className="text-faint">{"loading / not available yet"}</span>}</div>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[{ l: hi ? "Views" : "Views", v: ins.impressions, I: Eye }, { l: hi ? "Website" : "Website", v: ins.website, I: Globe }, { l: hi ? "Calls" : "Calls", v: ins.calls, I: Phone }, { l: hi ? "Directions" : "Directions", v: ins.directions, I: Navigation }].map((k) => (
                <div key={k.l} className="rounded-lg bg-surface2/60 py-2"><k.I className="mx-auto h-3.5 w-3.5 text-muted" /><div className="text-base font-bold text-ink">{k.v ?? "—"}</div><div className="text-[10px] text-muted">{k.l}</div></div>
              ))}
            </div>
            {(ins.series?.length ?? 0) > 0 && <div className="mt-2 flex h-10 items-end gap-px">{ins.series!.map((d) => <div key={d.day} title={`${d.day}: ${d.impressions}`} className="flex-1 rounded-t-sm bg-[#4285F4]/60" style={{ height: `${(d.impressions / maxImp) * 100}%` }} />)}</div>}
          </section>

          <section className="rounded-xl border border-border p-3 space-y-3">
            <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5">
              <span><span className="text-sm font-medium block">{hi ? "Roz subah auto-post" : "Auto-post every morning (4 AM)"}</span><span className="text-[11px] text-muted">{"Today's poster goes up as a Google update (4 AM)."}</span></span>
              <input type="checkbox" className="h-5 w-5" checked={s.auto_post} onChange={(e) => patch({ auto_post: e.target.checked })} />
            </label>
            <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2.5">
              <span><span className="text-sm font-medium block">{hi ? "Reviews ka AI auto-reply" : "AI auto-reply to reviews"}</span><span className="text-[11px] text-muted">{"The AI answers new Google reviews by itself (every 30 min)."}</span></span>
              <input type="checkbox" className="h-5 w-5" checked={s.auto_reply} onChange={(e) => patch({ auto_reply: e.target.checked })} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={postNow} disabled={busy === "post" || s.status !== "ok"} className="inline-flex items-center justify-center gap-2 rounded-xl grad-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{busy === "post" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {"Post today's poster"}</button>
              <button type="button" onClick={() => setCustom({ ...custom, open: !custom.open })} disabled={s.status !== "ok"} className="rounded-xl border border-border px-3 py-2.5 text-sm font-semibold text-ink disabled:opacity-60">{hi ? "Apna update likhein" : "Write an update"}</button>
            </div>
            {custom.open && (
              <div className="space-y-2 rounded-lg border border-dashed border-border p-2.5">
                <textarea value={custom.text} onChange={(e) => setCustom({ ...custom, text: e.target.value })} rows={3} placeholder={hi ? "Offer, naya product, chhutti ka notice…" : "Offer, new product, holiday notice…"} className={inputCls} />
                <input value={custom.image_url} onChange={(e) => setCustom({ ...custom, image_url: e.target.value })} placeholder="Image URL (https, optional)" className={inputCls} />
                <div className="flex gap-2"><select value={custom.cta} onChange={(e) => setCustom({ ...custom, cta: e.target.value as typeof custom.cta })} className="rounded-xl border border-border bg-surface px-2 text-xs"><option value="CALL">Call button</option><option value="LEARN_MORE">Learn more (link)</option><option value="BOOK">Book (link)</option></select>{custom.cta !== "CALL" && <input value={custom.url} onChange={(e) => setCustom({ ...custom, url: e.target.value })} placeholder="https://…" className={inputCls} />}</div>
                <button type="button" disabled={busy === "custom" || !custom.text.trim()} onClick={postCustom} className="w-full rounded-xl grad-brand py-2 text-sm font-semibold text-white disabled:opacity-60">{busy === "custom" ? "Posting…" : "Post to Google"}</button>
              </div>
            )}
            {s.status === "reconnect" && <button type="button" onClick={() => connect(false)} className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold">{"Reconnect"}</button>}
            <button type="button" onClick={onReviews} className="block w-full text-left text-sm text-brand-ink">{"See & answer Google reviews →"}</button>
            {s.own_client && <button type="button" onClick={() => { if (confirm("Forget your own OAuth client? (platform client will be used)")) patch({ forget_client: true }); }} className="text-[11px] text-faint">{"Forget my own OAuth client"}</button>}
          </section>
        </>
      )}
    </div>
  );
}
