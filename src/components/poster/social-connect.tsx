"use client";
// "Connect Facebook / Instagram" block (settings) + the connected-accounts list.
import { ConnectConsent } from "@/components/poster/connect-consent";
import { useCallback, useEffect, useState } from "react";
import { LoaderCircle, Plus, Trash2, RefreshCw } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

export type SocialAccount = { id: string; provider: "facebook" | "instagram" | "whatsapp"; account_id: string; name: string; username: string; picture: string | null; status: "ok" | "reconnect"; connected_at: string; is_active?: boolean; auto_post?: boolean; auto_post_profile?: string | null };

export function ProviderIcon({ provider, className = "h-5 w-5" }: { provider: "facebook" | "instagram" | "whatsapp"; className?: string }) {
  if (provider === "whatsapp") return <span className={`${className} rounded-full bg-[#25D366] inline-block`} />;
  return provider === "facebook" ? (
    <svg viewBox="0 0 24 24" className={className} aria-hidden><circle cx="12" cy="12" r="12" fill="#1877F2" /><path fill="#fff" d="M15.6 12.9l.4-3h-2.9V8c0-.8.4-1.6 1.7-1.6H16V3.8s-1.2-.2-2.3-.2c-2.4 0-3.9 1.4-3.9 4v2.3H7.1v3h2.7V20h3.3v-7.1h2.5z" /></svg>
  ) : (
    <svg viewBox="0 0 24 24" className={className} aria-hidden><defs><radialGradient id="ig" cx="30%" cy="107%" r="150%"><stop offset="0" stopColor="#fdf497" /><stop offset=".45" stopColor="#fd5949" /><stop offset=".6" stopColor="#d6249f" /><stop offset=".9" stopColor="#285AEB" /></radialGradient></defs><rect width="24" height="24" rx="7" fill="url(#ig)" /><rect x="5.5" y="5.5" width="13" height="13" rx="4" fill="none" stroke="#fff" strokeWidth="1.6" /><circle cx="12" cy="12" r="3.2" fill="none" stroke="#fff" strokeWidth="1.6" /><circle cx="16" cy="8" r=".9" fill="#fff" /></svg>
  );
}

function Avatar({ src }: { src: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="h-7 w-7 rounded-full object-cover" />;
}

let cache: { at: number; configured: boolean; accounts: SocialAccount[] } | null = null;
export async function fetchSocialAccounts(force = false) {
  if (!force && cache && Date.now() - cache.at < 60_000) return cache;
  const r = await api<{ configured?: boolean; accounts?: SocialAccount[] }>("/api/social/accounts");
  cache = { at: Date.now(), configured: !!r.data.configured, accounts: r.data.accounts ?? [] };
  return cache;
}
export function invalidateSocialAccounts() { cache = null; }

export async function startConnect(returnTo: string, fallback = "Could not connect.", provider: "facebook" | "instagram" = "facebook"): Promise<string | null> {
  const r = await api<{ url?: string; message?: string }>("/api/social/connect", { method: "POST", json: { return_to: returnTo, provider } });
  if (r.ok && r.data.url) { window.location.assign(r.data.url); return null; }
  return r.data.message ?? fallback;
}

export function SocialConnect({ returnTo = "/poster/settings" }: { returnTo?: string }) {
  const [list, setList] = useState<SocialAccount[] | null>(null);
  const [configured, setConfigured] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const { t } = useT();

  const load = useCallback(async (force = false) => {
    const c = await fetchSocialAccounts(force);
    setList(c.accounts); setConfigured(c.configured);
  }, []);
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    const s = q.get("social");
    if (s === "ok") setMsg(t.connected(q.get("n") ?? ""));
    else if (s === "error") setMsg(t.connectFail(q.get("reason") ?? ""));
    load(s === "ok");
  }, [load, t]);

  async function connect() {
    setBusy(true); setMsg("");
    const err = await startConnect(returnTo, t.connectErr);
    if (err) { setMsg(err); setBusy(false); }
  }
  async function remove(id: string) {
    if (!confirm(t.removeAcct)) return;
    await api("/api/social/accounts", { method: "DELETE", json: { id } });
    invalidateSocialAccounts(); load(true);
  }

  return (
    <section className="rounded-xl border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold flex items-center gap-1.5"><ProviderIcon provider="facebook" className="h-4 w-4" /><ProviderIcon provider="instagram" className="h-4 w-4" /> {t.socialTitle}</p>
        {list && list.length > 0 && <button type="button" onClick={() => load(true)} className="text-muted"><RefreshCw className="h-4 w-4" /></button>}
      </div>
      <p className="text-xs text-muted">{t.socialHint}</p>
      {list === null ? <LoaderCircle className="h-4 w-4 animate-spin text-muted" /> : list.length > 0 && (
        <ul className="space-y-1.5">
          {list.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-lg bg-surface2 px-2.5 py-2">
              {a.picture ? <Avatar src={a.picture} /> : <ProviderIcon provider={a.provider} className="h-7 w-7" />}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate flex items-center gap-1.5"><ProviderIcon provider={a.provider} className="h-3.5 w-3.5" /> {a.name}</p>
                <p className="text-[11px] text-muted truncate">{a.provider === "instagram" ? `@${a.username}` : t.fbPage}{a.status === "reconnect" ? ` · ${t.reconnect}` : ""}</p>
              </div>
              <button type="button" onClick={() => remove(a.id)} className="text-muted p-1" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
            </li>
          ))}
        </ul>
      )}
      <ConnectConsent kind="facebook" />
      <button type="button" onClick={connect} disabled={busy || !configured}
        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#1877F2] px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        {list && list.length ? t.addMore : t.connectFbIg}
      </button>
      {!configured && <p className="text-[11px] text-faint">{t.socialSoon}</p>}
      {msg && <p className="text-xs text-ink">{msg}</p>}
    </section>
  );
}
