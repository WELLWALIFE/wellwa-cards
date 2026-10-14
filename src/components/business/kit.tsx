"use client";
// Shared pieces of the Business screens (Team, Income, Wallet…): the data hook, the page shell with its Back, and the small formatters.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, LoaderCircle } from "lucide-react";
import { api, authHeaders, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";

export const rupee = (paise: number | null | undefined) => `₹${Math.round((paise ?? 0) / 100).toLocaleString("en-IN")}`;
export const rupeeExact = (paise: number | null | undefined) => `₹${((paise ?? 0) / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export const dayOf = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");
export const dayShort = (s: string | null | undefined) => (s ? new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "");

export function useBiz<T>(page: string, fields: Record<string, unknown> = {}) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const key = JSON.stringify(fields);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      if (!(await isLoggedIn())) { window.location.href = `/login?next=${encodeURIComponent(location.pathname)}`; return; }
      const r = await api<T & { error?: string }>(`/api/business/${page}`, { method: "POST", json: JSON.parse(key) });
      if (!r.ok) setError((r.data as { error?: string })?.error ?? "Could not open this page. Please try again.");
      else setData(r.data as T);
    } catch { setError("No internet — please try again."); } finally { setLoading(false); }
  }, [page, key]);
  useEffect(() => { void load(); }, [load]);
  return { data, error, loading, reload: load, setData };
}

/** A form action: POST to the page with an `op` and fields. Resolves { ok, error?, data }. */
export async function bizAct<T = Record<string, unknown>>(page: string, fields: Record<string, unknown>): Promise<{ ok: boolean; error?: string; data: T }> {
  try {
    const r = await api<T & { error?: string }>(`/api/business/${page}`, { method: "POST", json: fields });
    return { ok: r.ok, error: r.ok ? undefined : (r.data as { error?: string })?.error ?? "Something went wrong. Please try again.", data: r.data as T };
  } catch { return { ok: false, error: "No internet — please try again.", data: {} as T }; }
}

/** A file for a form (KYC photo, payment proof, attachment) → its id on the partner service. */
export async function bizUpload(file: File, kind: string): Promise<{ id?: string; error?: string }> {
  try {
    const fd = new FormData(); fd.append("file", file); fd.append("kind", kind);
    const h = await authHeaders(); delete h["content-type"];
    const r = await fetch("/api/business/upload", { method: "POST", headers: h, body: fd });
    const j = (await r.json().catch(() => ({}))) as { id?: string; error?: string };
    return r.ok && j.id ? { id: j.id } : { error: j.error ?? "The file could not be sent. Please try again." };
  } catch { return { error: "No internet — please try again." }; }
}

export function BizShell({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/poster/business" aria-label="Back" className="text-muted"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="flex-1 text-lg font-bold">{title}</h1>
        {right}
      </div>
      {children}
    </div>
  );
}

/** Loading / error wrapper: renders `children` once `ready`. */
export function BizState({ loading, error, onRetry, children }: { loading: boolean; error: string; onRetry: () => void; children: React.ReactNode }) {
  const { lang } = useT(); const en = lang === "en";
  if (loading) return <div className="py-20 grid place-items-center"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  if (error) return (
    <div className="rounded-2xl border border-danger/30 bg-danger/5 p-4 text-center space-y-2">
      <p className="text-sm font-semibold text-danger">{error}</p>
      <button type="button" onClick={onRetry} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-semibold">{en ? "Try again" : "दोबारा try करें"}</button>
    </div>
  );
  return <>{children}</>;
}

export const CARD = "rounded-2xl border border-border bg-surface p-4";
