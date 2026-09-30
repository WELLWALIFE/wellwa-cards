"use client";
import { SITE_HOST, SITE_URL } from "@/lib/site-url";

// Super Admin → White label. A reseller (Wellwa Life, say) runs the platform
// under their own domain and name: they add one wildcard DNS record, and every
// member who signs up under them gets <name>.theirdomain.com automatically.

import { useCallback, useEffect, useState } from "react";
import {
  Building2, Plus, Trash2, X, LoaderCircle, Check, Copy, AlertCircle, Globe, KeyRound,
} from "lucide-react";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Brand = {
  id: string; slug: string; name: string; base_domain: string;
  logo_url: string | null; theme_color: string; support_email: string | null;
  hide_platform_branding: boolean; active: boolean; last_error: string | null;
  admins?: { userId: string; email: string }[];
  fb_pixel_id?: string | null; ga4_id?: string | null;
  google_ads_id?: string | null; ads_conversion_label?: string | null;
  bot_persona?: string | null; bot_knowledge?: string | null; bot_faq?: string | null;
};

async function adminHeaders(): Promise<Record<string, string>> {
  const h: Record<string, string> = { "content-type": "application/json" };
  try { h["x-admin-key"] = sessionStorage.getItem("ne-admin-key") ?? ""; } catch { /* ignore */ }
  try {
    const sb = getBrowserSupabase();
    const { data } = (await sb?.auth.getSession()) ?? { data: { session: null } };
    if (data.session?.access_token) h["x-owner-token"] = data.session.access_token;
  } catch { /* ignore */ }
  return h;
}

const EMPTY: Partial<Brand> = {
  name: "", base_domain: "", theme_color: "#0e9e90", hide_platform_branding: true,
};

export default function AdminBrands() {
  const [rows, setRows] = useState<Brand[] | null>(null);
  const [serverIp, setServerIp] = useState("148.72.247.91");
  const [editing, setEditing] = useState<Partial<Brand> | null>(null);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    const r = await fetch("/api/admin/brands", { headers: await adminHeaders() });
    const d = await r.json();
    setRows(d.brands ?? []);
    if (d.serverIp) setServerIp(d.serverIp);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setBusy("save"); setErr("");
    const r = await fetch("/api/admin/brands", {
      method: "POST", headers: await adminHeaders(), body: JSON.stringify(editing),
    });
    const d = await r.json();
    setBusy("");
    if (!r.ok) return setErr(d.error ?? "Could not save.");
    setEditing(null); load();
  }

  async function verify(b: Brand) {
    setBusy(b.id); setErr("");
    const r = await fetch("/api/admin/brands", {
      method: "PUT", headers: await adminHeaders(), body: JSON.stringify({ base_domain: b.base_domain }),
    });
    const d = await r.json();
    setBusy("");
    if (!r.ok) setErr(d.error ?? "Verification failed.");
    load();
  }

  async function remove(b: Brand) {
    if (!confirm(`Remove ${b.name}? Their members' cards stay live on ${SITE_HOST} links.`)) return;
    await fetch(`/api/admin/brands?id=${b.id}`, { method: "DELETE", headers: await adminHeaders() });
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">White label</h1>
          <p className="text-muted mt-1">
            Let a partner run the whole platform on their own domain and branding.
          </p>
        </div>
        <button onClick={() => setEditing({ ...EMPTY })}
          className="inline-flex items-center gap-1.5 rounded-lg bg-ink text-bg px-3 py-2 text-sm font-medium">
          <Plus className="h-4 w-4" /> Add partner
        </button>
      </div>

      {err && (
        <p className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {err}
        </p>
      )}

      {rows === null ? (
        <div className="p-10 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-10 text-center shadow-card">
          <Building2 className="h-6 w-6 mx-auto text-faint" />
          <p className="font-medium mt-2">No white-label partners yet</p>
          <p className="text-sm text-muted mt-1 max-w-md mx-auto">
            Add one to give a reseller their own domain — their members get
            <span className="mono"> name.theirdomain.com</span> without touching DNS themselves.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((b) => (
            <div key={b.id} className="rounded-xl border border-border bg-surface p-4 shadow-card">
              <div className="flex items-start gap-3">
                <span className="h-9 w-9 rounded-lg grid place-items-center shrink-0 text-white font-semibold"
                  style={{ background: b.theme_color }}>
                  {b.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium flex items-center gap-2">
                    {b.name}
                    {b.active
                      ? <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-good"><Check className="h-3 w-3" /> LIVE</span>
                      : <span className="text-[11px] font-semibold text-amber">SETUP PENDING</span>}
                  </p>
                  <p className="mono text-xs text-muted">*.{b.base_domain}</p>
                  {b.last_error && <p className="text-xs text-danger mt-1">{b.last_error}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!b.active && (
                    <button onClick={() => verify(b)} disabled={busy === b.id}
                      className="rounded-lg bg-ink text-bg px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                      {busy === b.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : "Verify DNS"}
                    </button>
                  )}
                  <button onClick={() => setEditing(b)}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface2">Edit</button>
                  <button onClick={() => remove(b)} className="ed-icon" aria-label="Remove">
                    <Trash2 className="h-4 w-4 text-danger" />
                  </button>
                </div>
              </div>

              {!b.active && <DnsCard domain={b.base_domain} ip={serverIp} />}
              <PartnerLogins brand={b} reload={load} />
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setEditing(null)}>
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-5 shadow-float space-y-3"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{editing.id ? "Edit partner" : "Add white-label partner"}</h2>
              <button onClick={() => setEditing(null)} className="ed-icon"><X className="h-4 w-4" /></button>
            </div>

            <label className="block">
              <span className="text-[13px] font-medium mb-1 block text-muted">Partner name</span>
              <input className="ed-input" placeholder="Wellwa Life" value={editing.name ?? ""}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[13px] font-medium mb-1 block text-muted">Their domain</span>
              <input className="ed-input mono" placeholder="wellwalife.com" value={editing.base_domain ?? ""}
                onChange={(e) => setEditing({ ...editing, base_domain: e.target.value })} />
              <span className="text-xs text-faint mt-1 block">
                Members get <span className="mono">name.{editing.base_domain || "theirdomain.com"}</span>
              </span>
            </label>
            <label className="block">
              <span className="text-[13px] font-medium mb-1 block text-muted">Logo URL</span>
              <input className="ed-input" placeholder="https://…/logo.png" value={editing.logo_url ?? ""}
                onChange={(e) => setEditing({ ...editing, logo_url: e.target.value })} />
            </label>
            <div className="flex gap-3">
              <label className="block flex-1">
                <span className="text-[13px] font-medium mb-1 block text-muted">Brand colour</span>
                <input type="color" className="h-10 w-full rounded-lg border border-border bg-surface"
                  value={editing.theme_color ?? "#0e9e90"}
                  onChange={(e) => setEditing({ ...editing, theme_color: e.target.value })} />
              </label>
              <label className="block flex-1">
                <span className="text-[13px] font-medium mb-1 block text-muted">Support email</span>
                <input className="ed-input" placeholder="care@wellwalife.com" value={editing.support_email ?? ""}
                  onChange={(e) => setEditing({ ...editing, support_email: e.target.value })} />
              </label>
            </div>
            <div className="rounded-lg border border-border bg-surface2/50 p-3 space-y-2">
              <p className="text-[13px] font-medium">AI training for this brand</p>
              <p className="text-xs text-muted">
                Shared by <em>every</em> member card. Put the products, prices and specs here once
                instead of asking each member to retype them. A member&apos;s own notes still win
                where they disagree.
              </p>
              <input className="ed-input text-sm" placeholder="Persona — e.g. Friendly water advisor, never pushy"
                value={editing.bot_persona ?? ""}
                onChange={(e) => setEditing({ ...editing, bot_persona: e.target.value })} />
              <textarea className="ed-input min-h-28 resize-y text-sm"
                placeholder="Products, prices, specs, company details…"
                value={editing.bot_knowledge ?? ""}
                onChange={(e) => setEditing({ ...editing, bot_knowledge: e.target.value })} />
              <textarea className="ed-input min-h-24 resize-y text-sm"
                placeholder={"Q: Kaunsa model lein?\nA: Family size par depend karta hai…"}
                value={editing.bot_faq ?? ""}
                onChange={(e) => setEditing({ ...editing, bot_faq: e.target.value })} />
              <p className="text-[11px] text-faint">
                Write the answers in any language — the assistant translates them into whatever
                language the customer writes in.
              </p>
            </div>

            <div className="rounded-lg border border-border bg-surface2/50 p-3 space-y-2">
              <p className="text-[13px] font-medium">Network-wide ads tracking</p>
              <p className="text-xs text-muted">
                Optional. These fire on <em>every</em> member card, so the partner can run one
                campaign for the whole network. Members can still add their own IDs as well.
              </p>
              <div className="grid grid-cols-2 gap-2">
                <input className="ed-input mono text-sm" placeholder="FB Pixel ID"
                  value={editing.fb_pixel_id ?? ""}
                  onChange={(e) => setEditing({ ...editing, fb_pixel_id: e.target.value.trim() })} />
                <input className="ed-input mono text-sm" placeholder="G-XXXXXXX"
                  value={editing.ga4_id ?? ""}
                  onChange={(e) => setEditing({ ...editing, ga4_id: e.target.value.trim() })} />
                <input className="ed-input mono text-sm" placeholder="AW-123456789"
                  value={editing.google_ads_id ?? ""}
                  onChange={(e) => setEditing({ ...editing, google_ads_id: e.target.value.trim() })} />
                <input className="ed-input mono text-sm" placeholder="Conversion label"
                  value={editing.ads_conversion_label ?? ""}
                  onChange={(e) => setEditing({ ...editing, ads_conversion_label: e.target.value.trim() })} />
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={editing.hide_platform_branding !== false}
                onChange={(e) => setEditing({ ...editing, hide_platform_branding: e.target.checked })} />
              Hide &ldquo;Powered by Shubhora&rdquo; on their members&apos; cards
            </label>

            <button onClick={save} disabled={busy === "save"}
              className="w-full rounded-lg bg-ink text-bg py-2.5 text-sm font-medium disabled:opacity-50">
              {busy === "save" ? "Saving…" : "Save partner"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Who can sign in and run this partner account.
 *
 * Without at least one, the brand exists but nobody can reach /partner — the
 * wallet and activations would be unusable.
 */
function PartnerLogins({ brand, reload }: { brand: Brand; reload: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<{ email: string; password?: string } | null>(null);
  const [err, setErr] = useState("");

  async function add() {
    setBusy(true); setErr(""); setCreated(null);
    const r = await fetch("/api/admin/brands?do=add-admin", {
      method: "POST", headers: await adminHeaders(),
      body: JSON.stringify({ brandId: brand.id, email }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? "Could not add.");
    setEmail(""); setCreated({ email: d.email, password: d.password }); reload();
  }

  async function drop(userId: string) {
    await fetch("/api/admin/brands?do=remove-admin", {
      method: "POST", headers: await adminHeaders(),
      body: JSON.stringify({ brandId: brand.id, userId }),
    });
    reload();
  }

  return (
    <div className="mt-3 rounded-lg border border-border bg-surface2/50 p-3">
      <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
        <KeyRound className="h-3.5 w-3.5 text-muted" /> Partner login
      </p>

      {(brand.admins ?? []).length === 0 ? (
        <p className="text-[11px] text-amber mb-2">
          No login yet — add one, or nobody can open the partner panel.
        </p>
      ) : (
        <div className="space-y-1 mb-2">
          {brand.admins!.map((a) => (
            <div key={a.userId} className="flex items-center gap-2 text-xs">
              <span className="mono truncate">{a.email}</span>
              <button onClick={() => drop(a.userId)} className="ml-auto text-danger hover:underline">Remove</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input className="ed-input flex-1 text-sm" placeholder="partner@wellwalife.com" value={email}
          onChange={(e) => setEmail(e.target.value)} />
        <button onClick={add} disabled={!email || busy}
          className="shrink-0 rounded-lg bg-ink text-bg px-3 py-2 text-xs font-medium disabled:opacity-50">
          {busy ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : "Give access"}
        </button>
      </div>

      {err && <p className="mt-1.5 text-[11px] text-danger">{err}</p>}

      {created && (
        <div className="mt-2 rounded-lg border border-good/40 bg-good/10 p-2.5">
          <p className="text-[11px] font-medium text-good">Access granted — send these details:</p>
          <p className="mono text-[11px] mt-1">Login: {SITE_URL}/login</p>
          <p className="mono text-[11px]">Email: {created.email}</p>
          {created.password
            ? <p className="mono text-[11px]">Password: <strong>{created.password}</strong> (shown once)</p>
            : <p className="text-[11px] text-muted">They already had an account — their existing password still works.</p>}
        </div>
      )}
    </div>
  );
}

/** The one DNS record the partner has to add. */
function DnsCard({ domain, ip }: { domain: string; ip: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 rounded-lg border border-border bg-surface2/50 p-3">
      <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
        <Globe className="h-3.5 w-3.5 text-muted" /> Ask {domain} to add this one record:
      </p>
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 mono text-[11px]">
        <span className="text-faint">Type</span><span>A</span><span />
        <span className="text-faint">Name</span><span className="break-all">*.{domain}</span><span />
        <span className="text-faint">Value</span><span>{ip}</span>
        <button onClick={() => { navigator.clipboard.writeText(ip); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
          className="inline-flex items-center gap-1 text-muted hover:text-ink">
          {copied ? <Check className="h-3 w-3 text-good" /> : <Copy className="h-3 w-3" />}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-faint">
        One record covers every member. Their existing website, email and other subdomains keep
        working — only names nobody has already claimed come here. Press Verify DNS once it&apos;s added.
      </p>
    </div>
  );
}
