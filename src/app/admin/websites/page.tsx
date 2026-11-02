"use client";
// Super Admin → Websites (owner, 2 Nov 2026): every website still in its 24-hour wait goes live by itself (lib/site-ready.ts, hourly
// /api/cron/site-live). Here: "Live now" shows one at once (and tells the owner), "Pause" holds one for visitors (the card shows), "Resume"
// lets it show again. Made live in the last 7 days are listed too, so a mistake can be paused.
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Globe, Pause, Play, Rocket } from "lucide-react";
import { adminApi, fmtDate } from "@/lib/admin-client";
import { Badge, Btn, Card, Empty, ErrorBox, PageHeader, Spinner, Table, Tabs, td, toast, useConfirm } from "@/components/admin/ui";

type Row = { id: string; username: string; business: string; owner: string; ownerId: string; readyAt: string | null; advancedReadyAt: string | null; liveAt: string | null; premium: boolean; status: "waiting" | "paused" | "live" };
type TabKey = "waiting" | "paused" | "live" | "all";

function left(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.parse(iso) - Date.now();
  if (!(ms > 0)) return "due now";
  const h = Math.floor(ms / 3600e3), m = Math.floor((ms % 3600e3) / 60e3);
  return h ? `in ${h} h ${m} m` : `in ${m} min`;
}

export default function WebsitesPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [pauseReady, setPauseReady] = useState(true);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<TabKey>("waiting");
  const [busy, setBusy] = useState("");
  const [confirm, dialog] = useConfirm();
  const load = useCallback(async () => {
    const r = await adminApi<{ websites: Row[]; pauseReady: boolean }>("/api/admin/v2/websites");
    if (r.ok) { setRows(r.data.websites); setPauseReady(r.data.pauseReady); setErr(""); } else setErr(r.data.error || "Could not load.");
  }, []);
  useEffect(() => { void load(); }, [load]);
  const count = (k: TabKey) => (rows ?? []).filter((x) => k === "all" || x.status === k).length;
  const shown = useMemo(() => (rows ?? []).filter((x) => tab === "all" || x.status === tab), [rows, tab]);

  async function act(r: Row, action: "live" | "pause" | "resume") {
    const ask = action === "live"
      ? { title: `Make ${r.business} live now?`, body: "Visitors see the website at once, and the owner gets the “your website is live” message on WhatsApp.", ok: "Live now" }
      : action === "pause"
        ? { title: `Pause ${r.business}'s website?`, body: "Visitors see only the card until you tap Resume. The 24-hour clock will not make it live meanwhile.", ok: "Pause", danger: true }
        : { title: `Resume ${r.business}'s website?`, body: "It shows again — at once if its time has passed, else at its time.", ok: "Resume" };
    if (!(await confirm(ask))) return;
    setBusy(r.id);
    const x = await adminApi<{ told?: boolean }>("/api/admin/v2/websites", { method: "POST", json: { id: r.id, action } });
    setBusy("");
    if (!x.ok) { toast(x.data.error || "Could not save.", "err"); return; }
    toast(action === "live" ? (x.data.told ? "Live — the owner was told." : "Live. (The WhatsApp message could not be sent.)") : action === "pause" ? "Paused." : "Resumed.");
    void load();
  }

  return (
    <div className="space-y-5">
      {dialog}
      <PageHeader title="Websites" sub="New websites go live by themselves 24 hours after they are made. Make one live sooner, or pause one." />
      {!pauseReady && <ErrorBox>Pause needs migration 0085 (cards.site_paused) in Supabase. Live now works without it.</ErrorBox>}
      <Tabs tabs={[{ key: "waiting", label: "Waiting", count: count("waiting") }, { key: "paused", label: "Paused", count: count("paused") }, { key: "live", label: "Live (7 days)", count: count("live") }, { key: "all", label: "All", count: count("all") }]} value={tab} onChange={setTab} />
      {err && <ErrorBox>{err}</ErrorBox>}
      {!rows ? <Spinner /> : shown.length === 0 ? <Empty icon={Globe} title={tab === "waiting" ? "No website is waiting" : tab === "paused" ? "Nothing paused" : "Nothing here"} sub="A website made in the app appears here for its first 24 hours." /> : (
        <Card pad={false}>
          <Table head={["Business", "Owner", "Status", "Goes live", ""]} minW={760}>
            {shown.map((r) => {
              const due = r.readyAt ?? r.advancedReadyAt;
              return (
                <tr key={r.id} className="hover:bg-surface2/50">
                  <td className={td}><span className="font-semibold">{r.business}</span>{r.premium && <Badge tone="violet">Premium</Badge>}<span className="block font-mono text-[11px] text-faint">/{r.username}</span></td>
                  <td className={td}><Link href={`/admin/users/${r.ownerId}`} className="hover:text-brand-ink">{r.owner || "User"}</Link></td>
                  <td className={td}><Badge tone={r.status === "waiting" ? "warn" : r.status === "paused" ? "danger" : "good"} dot>{r.status === "waiting" ? "Waiting" : r.status === "paused" ? "Paused" : "Live"}</Badge></td>
                  <td className={`${td} text-muted`}>{r.status === "live" ? (r.liveAt ? `Live since ${fmtDate(r.liveAt, true)}` : "Live") : due ? <>{fmtDate(due, true)}<span className="block text-[11px] text-faint">{r.status === "paused" ? "on hold" : left(due)}</span></> : "—"}</td>
                  <td className={`${td} text-right`}>
                    <span className="inline-flex flex-wrap items-center justify-end gap-1.5">
                      {r.status === "waiting" && <Btn size="sm" variant="primary" icon={Rocket} loading={busy === r.id} onClick={() => act(r, "live")}>Live now</Btn>}
                      {r.status === "paused" && <Btn size="sm" variant="primary" icon={Play} loading={busy === r.id} onClick={() => act(r, "resume")}>Resume</Btn>}
                      {r.status !== "paused" && pauseReady && <Btn size="sm" icon={Pause} disabled={busy === r.id} onClick={() => act(r, "pause")}>Pause</Btn>}
                      <a href={`/c/${r.username}`} target="_blank" rel="noreferrer" className="rounded-lg p-1.5 text-muted hover:bg-surface2 hover:text-ink" title="Open"><ExternalLink className="h-4 w-4" /></a>
                    </span>
                  </td>
                </tr>
              );
            })}
          </Table>
        </Card>
      )}
    </div>
  );
}
