"use client";
// Reviews inbox: FB/IG comments + Page reviews + Google reviews in one list,
// AI-drafted replies you can edit and send, per-account auto-reply toggles.
import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Sparkles, Send, Check, Star, RefreshCw } from "lucide-react";
import { api } from "@/lib/poster-client";
import { ProviderIcon, startConnect, invalidateSocialAccounts } from "@/components/poster/social-connect";
import { useT } from "@/lib/poster-i18n";
import { Guide } from "@/components/poster/guide";

type Item = { provider: "facebook" | "instagram" | "google"; kind: "comment" | "review"; id: string; account_row: string; author: string; text: string; rating: number | null; created_at: string; post_text: string; replied: string | null; link: string | null };
type Data = { items: Item[]; needs: { provider: "facebook" | "instagram"; permission: string; why: string }[]; errors: string[]; configured: boolean; google_configured: boolean; google: { connected: boolean; title: string; status: string }; accounts: { id: string; provider: "facebook" | "instagram"; name: string; auto_reply: boolean }[] };

const Badge = ({ p }: { p: Item["provider"] }) => p === "google"
  ? <span className="h-5 w-5 rounded-full bg-white border border-border grid place-items-center text-[11px] font-black text-[#4285F4]">G</span>
  : <ProviderIcon provider={p} className="h-5 w-5" />;

export function ReviewsPanel() {
  const { lang } = useT(); const hi = lang !== "en";
  const [data, setData] = useState<Data | null>(null);
  const [gAuto, setGAuto] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [loadErr, setLoadErr] = useState("");

  const load = useCallback(async () => {
    const r = await api<Data & { error?: string }>("/api/social/reviews");
    if (r.ok) setData(r.data); else setLoadErr(r.data.error || `Could not load (${r.status})`);
    const g = await api<{ auto_reply?: boolean }>("/api/google/status"); setGAuto(!!g.data.auto_reply);
  }, []);
  useEffect(() => { load(); }, [load]);

  const key = (it: Item) => `${it.provider}:${it.id}`;
  async function draft(it: Item) {
    setBusy(key(it)); setMsg("");
    const r = await api<{ reply?: string; error?: string }>("/api/social/reviews/draft", { method: "POST", json: { provider: it.provider, kind: it.kind, author: it.author, text: it.text, rating: it.rating } });
    setBusy(""); if (!r.ok) { setMsg(r.data.error ?? "AI failed"); return; }
    setDrafts((d) => ({ ...d, [key(it)]: r.data.reply ?? "" }));
  }
  async function send(it: Item, ignore = false) {
    setBusy(key(it) + "s"); setMsg("");
    const r = await api<{ ok?: boolean; error?: string; needs_permission?: string }>("/api/social/reviews", { method: "POST", json: { provider: it.provider, item_id: it.id, kind: it.kind, text: drafts[key(it)] ?? "", author: it.author, item_text: it.text, rating: it.rating, ignore } });
    setBusy("");
    if (!r.ok) { setMsg(r.data.needs_permission ? (`Reconnect ${it.provider} to allow replies (new permission: ${r.data.needs_permission})`) : (r.data.error ?? "Failed")); return; }
    setDrafts((d) => { const c = { ...d }; delete c[key(it)]; return c; }); load();
  }
  async function toggleAuto(id: string, v: boolean) { await api("/api/social/accounts", { method: "PATCH", json: { id, action: "auto_reply", value: v } }); invalidateSocialAccounts(); load(); }
  async function toggleGoogleAuto(v: boolean) { await api("/api/google/status", { method: "PATCH", json: { auto_reply: v } }); setGAuto(v); }
  async function reconnect(p: "facebook" | "instagram") { const e = await startConnect("/poster/social?tab=reviews", "Could not connect.", p); if (e) setMsg(e); }

  if (!data) return loadErr
    ? <p className="text-sm text-danger rounded-lg bg-surface2 px-3 py-2">{loadErr}</p>
    : <div className="py-12 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>;
  const items = data.items.filter((it) => !onlyOpen || it.replied === null);
  const connectedAny = data.accounts.length > 0 || data.google.connected;

  return (
    <div className="space-y-3">
      <Guide hi="Every comment/review from Facebook, Instagram and Google lands here. Tap '✨ AI reply' — the AI drafts an answer in your business's voice, edit and send. Turn 'Auto' on and the AI replies by itself (every 30 min)." en="Every comment/review from Facebook, Instagram and Google lands here. Tap '✨ AI reply' — the AI drafts an answer in your business's voice, edit and send. Turn 'Auto' on and the AI replies by itself (every 30 min)." />

      {!connectedAny && (
        <div className="rounded-xl border border-border p-4 text-center text-sm text-muted">{"Connect Facebook / Instagram / Google first — their comments and reviews will show here."}</div>
      )}

      {(data.accounts.length > 0 || data.google.connected) && (
        <section className="rounded-xl border border-border p-3 space-y-2">
          <p className="text-sm font-semibold">{hi ? "🤖 AI khud reply kare (auto)" : "🤖 Auto-reply by AI"}</p>
          {data.accounts.map((a) => (
            <label key={a.id} className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2">
              <span className="flex items-center gap-2 text-sm"><ProviderIcon provider={a.provider} className="h-4 w-4" /> {a.name}</span>
              <input type="checkbox" className="h-5 w-5" checked={a.auto_reply} onChange={(e) => toggleAuto(a.id, e.target.checked)} />
            </label>
          ))}
          {data.google.connected && (
            <label className="flex items-center justify-between rounded-lg bg-surface2 px-3 py-2">
              <span className="flex items-center gap-2 text-sm"><Badge p="google" /> {data.google.title || "Google Business"}</span>
              <input type="checkbox" className="h-5 w-5" checked={gAuto} onChange={(e) => toggleGoogleAuto(e.target.checked)} />
            </label>
          )}
          <p className="text-[11px] text-muted">{"When on: the AI writes and posts replies to new comments/reviews; for 1–3★ reviews it apologises and invites them to WhatsApp."}</p>
        </section>
      )}

      {data.needs.length > 0 && (
        <section className="rounded-xl border border-amber-400/60 bg-amber-500/10 p-3 space-y-2 text-sm">
          <p className="font-semibold">⚠️ {"Some things need a reconnect (new permissions):"}</p>
          <ul className="text-xs list-disc pl-5">{data.needs.map((n, i) => <li key={i}>{n.provider}: {n.why} <span className="text-muted">({n.permission})</span></li>)}</ul>
          <div className="flex gap-2">{[...new Set(data.needs.map((n) => n.provider))].map((p) => <button key={p} type="button" onClick={() => reconnect(p)} className="rounded-lg bg-[#1877F2] px-3 py-1.5 text-xs font-semibold text-white"><RefreshCw className="inline h-3.5 w-3.5 mr-1" />{p === "facebook" ? "Facebook" : "Instagram"} {"reconnect"}</button>)}</div>
        </section>
      )}
      {data.errors.length > 0 && <p className="text-xs text-danger">{data.errors.join(" · ")}</p>}
      {msg && <p className="text-sm rounded-lg bg-surface2 px-3 py-2">{msg}</p>}

      {connectedAny && (
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">{hi ? "Comments & reviews" : "Comments & reviews"} <span className="text-muted font-normal">({items.length})</span></p>
          <label className="text-xs flex items-center gap-1.5"><input type="checkbox" checked={onlyOpen} onChange={(e) => setOnlyOpen(e.target.checked)} /> {"unanswered only"}</label>
        </div>
      )}
      {connectedAny && items.length === 0 && <p className="text-sm text-muted">{onlyOpen ? ("Everything is answered 🎉") : ("No comments or reviews yet.")}</p>}

      {items.map((it) => {
        const k = key(it); const d = drafts[k];
        return (
          <div key={k} className="rounded-xl border border-border p-3 space-y-2">
            <div className="flex items-start gap-2">
              <Badge p={it.provider} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{it.author} <span className="text-[11px] text-muted font-normal">· {new Date(it.created_at).toLocaleString("en-IN", { day: "2-digit", month: "short" })}{it.kind === "review" ? (hi ? " · review" : " · review") : ""}</span></p>
                {it.rating !== null && <span className="inline-flex gap-0.5">{[1, 2, 3, 4, 5].map((i) => <Star key={i} className={`h-3.5 w-3.5 ${i <= (it.rating ?? 0) ? "fill-amber-400 text-amber-400" : "text-muted"}`} />)}</span>}
                {it.text && <p className="text-sm">{it.text}</p>}
                {it.post_text && <p className="text-[11px] text-muted truncate">↳ {hi ? "post:" : "on:"} {it.post_text}</p>}
              </div>
              {it.link && <a href={it.link} target="_blank" rel="noreferrer" className="text-[11px] text-brand-ink shrink-0">{hi ? "kholo" : "open"} ↗</a>}
            </div>
            {it.replied !== null ? (
              <p className="text-xs rounded-lg bg-surface2 px-3 py-2">{it.replied === "" ? (hi ? "— ignore kiya" : "— ignored") : <><Check className="inline h-3.5 w-3.5 text-good mr-1" />{it.replied}</>}</p>
            ) : d !== undefined ? (
              <div className="space-y-1.5">
                <textarea value={d} onChange={(e) => setDrafts({ ...drafts, [k]: e.target.value })} rows={3} className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => draft(it)} disabled={busy === k} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">{busy === k ? "…" : (hi ? "dusra" : "another")}</button>
                  <button type="button" onClick={() => send(it)} disabled={busy === k + "s" || !d.trim() || (it.provider === "facebook" && it.kind === "review")} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg grad-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy === k + "s" ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} {hi ? "Bhejo" : "Send"}</button>
                </div>
                {it.provider === "facebook" && it.kind === "review" && <p className="text-[11px] text-muted">{"Facebook Page reviews can only be answered on Facebook — copy this text and paste it there."}</p>}
              </div>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={() => draft(it)} disabled={busy === k} className="flex-1 inline-flex items-center justify-center gap-1 rounded-lg grad-brand px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">{busy === k ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {hi ? "AI reply" : "AI reply"}</button>
                <button type="button" onClick={() => setDrafts({ ...drafts, [k]: "" })} className="rounded-lg border border-border px-3 py-2 text-xs font-semibold">{hi ? "khud likho" : "write"}</button>
                <button type="button" onClick={() => send(it, true)} className="rounded-lg border border-border px-3 py-2 text-xs text-muted">{hi ? "ignore" : "ignore"}</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
