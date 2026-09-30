"use client";
// One-tap buttons under a poster: always shows Facebook, Instagram and
// WhatsApp Status — connected ones post directly (with an "already posted"
// guard), unconnected ones link to Social → connect.
import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Check, Link2Off } from "lucide-react";
import { api } from "@/lib/poster-client";
import { fetchSocialAccounts, ProviderIcon, type SocialAccount } from "@/components/poster/social-connect";
import { useT } from "@/lib/poster-i18n";

type Provider = "facebook" | "instagram" | "whatsapp";
const ORDER: Provider[] = ["facebook", "instagram", "whatsapp"];

export function SocialPostButton({ posterId }: { posterId: string; caption?: string }) {
  const [accounts, setAccounts] = useState<SocialAccount[] | null>(null);
  const [posted, setPosted] = useState<Record<string, string>>({});
  const [state, setState] = useState<Record<Provider, "busy" | "" | string>>({ facebook: "", instagram: "", whatsapp: "" });
  const { lang } = useT(); const hi = lang !== "en";

  useEffect(() => {
    fetchSocialAccounts().then((c) => setAccounts(c.accounts.filter((a) => a.is_active))).catch(() => setAccounts([]));
    api<{ posted?: Record<string, string> }>(`/api/social/post-status?poster_id=${posterId}`).then((r) => { if (r.ok) setPosted(r.data.posted ?? {}); }).catch(() => {});
  }, [posterId]);

  if (accounts === null) return null;
  const byProvider = Object.fromEntries(accounts.map((a) => [a.provider, a])) as Partial<Record<Provider, SocialAccount>>;

  async function post(a: SocialAccount) {
    const already = posted[a.provider];
    if (already) {
      const when = new Date(already).toLocaleString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
      const ask = `This poster was already posted on ${when}. Post it again?`;
      if (!window.confirm(ask)) return;
    }
    setState((s) => ({ ...s, [a.provider]: "busy" }));
    const r = await api<{ ok: boolean; results: { ok: boolean; error?: string }[]; error?: string }>("/api/social/post", { method: "POST", json: { poster_id: posterId, caption: "", account_ids: [a.id] } });
    const ok = r.ok && r.data.ok;
    setState((s) => ({ ...s, [a.provider]: ok ? "done" : (r.data.results?.[0]?.error ?? r.data.error ?? (hi ? "Post नहीं हुआ।" : "Post failed.")) }));
    if (ok) setPosted((p) => ({ ...p, [a.provider]: new Date().toISOString() }));
    if (ok) setTimeout(() => setState((s) => ({ ...s, [a.provider]: "" })), 4000);
  }

  const providerLabel = (p: Provider) => p === "facebook" ? "Facebook" : p === "instagram" ? "Instagram" : (hi ? "WhatsApp Status" : "WhatsApp Status");
  const actionLabel = (p: Provider) => p === "whatsapp" ? (hi ? "Status पर लगाओ" : "Put on Status") : (hi ? "Post करो" : "Post");
  const color = (p: Provider) => p === "facebook" ? "bg-[#1877F2]" : p === "instagram" ? "bg-[#d6249f]" : "bg-[#128C7E]";

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-muted">{hi ? "इस poster को यहाँ भी लगाएँ" : "Also post this poster to"}</p>
      {ORDER.map((p) => {
        const a = byProvider[p];
        const s = state[p];
        if (!a) {
          return (
            <Link key={p} href={`/poster/social?tab=${p}`} className="flex items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm text-muted">
              <ProviderIcon provider={p} className="h-4 w-4 opacity-60" /> <span className="flex-1">{providerLabel(p)} — {hi ? "जुड़ा नहीं है" : "not connected"}</span> <Link2Off className="h-3.5 w-3.5" />
            </Link>
          );
        }
        return (
          <div key={p}>
            <button type="button" onClick={() => post(a)} disabled={s === "busy"} className={`w-full inline-flex items-center justify-center gap-2 rounded-xl ${color(p)} px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-80`}>
              {s === "busy" ? <LoaderCircle className="h-4 w-4 animate-spin" /> : s === "done" ? <Check className="h-4 w-4" /> : <ProviderIcon provider={p} className="h-4 w-4" />}
              {s === "done" ? (hi ? "Post हो गया ✓" : "Posted ✓") : posted[p] ? `${providerLabel(p)} — ${hi ? "फिर से post करें" : "post again"}` : `${providerLabel(p)} पर ${actionLabel(p)}`}
            </button>
            {posted[p] && s !== "busy" && s !== "done" && <p className="text-[11px] text-good mt-1 flex items-center gap-1"><Check className="h-3 w-3" /> {hi ? "पहले से post हो चुका है" : "Already posted"}</p>}
            {s && s !== "busy" && s !== "done" && <p className="text-[11px] text-danger mt-1">{s}</p>}
          </div>
        );
      })}
      <p className="text-[11px] text-muted text-center">{hi ? "Caption AI अपने-आप लिखता है (product, नंबर, hashtags)।" : "The caption is written automatically by AI (product, number, hashtags)."}</p>
    </div>
  );
}
