"use client";
// Business → Team. Data from the partner handler `team` (handles only, no names). Response shapes (mirror src/server/app-api/team.ts):
//  Summary  { counts, me: { handle, status } } | { disabled: true }
//  list     { rows: Row[], hasMore }       (op "list", tab, offset)
//  node     { node: Node, children: Kid[] } | { error }  (op "node", handle)
import { useCallback, useEffect, useState } from "react";
import { ChevronRight, LoaderCircle } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, bizAct, dayOf, useBiz } from "@/components/business/kit";

type Status = "green" | "red";
type Side = "L" | "R";
type Summary = {
  disabled?: boolean;
  counts: { left: number; right: number; leftGreen: number; rightGreen: number; directs: number; directsGreen: number };
  me: { handle: string; status: Status };
};
type Row = { handle: string; status: Status; side: Side; joined: string; lapsed: boolean };
type ListRes = { rows: Row[]; hasMore: boolean };
type Kid = { handle: string; status: Status; side: Side; joined: string; hasKids: boolean };
type NodeRes = { node?: { handle: string; status: Status; side: Side | null; joined: string }; children?: Kid[]; error?: string };

type Tab = "directs" | "left" | "right";

export default function TeamPage() {
  const { lang } = useT();
  const en = lang === "en";
  const { data, error, loading, reload } = useBiz<Summary>("team", { op: "summary" });
  const [view, setView] = useState<"list" | "tree">("list");

  return (
    <BizShell title={en ? "My team" : "मेरी team"}>
      <BizState loading={loading} error={error} onRetry={reload}>
        {data?.disabled ? (
          <p className={`${CARD} text-sm text-muted`}>{en ? "This page is not open right now." : "यह page अभी बंद है।"}</p>
        ) : data ? (
          <>
            <section className="rounded-2xl bg-[#12144a] p-4 text-white">
              <p className="text-xs text-white/70">{en ? "People in your team" : "आपकी team में लोग"}</p>
              <p className="text-3xl font-bold">{data.counts.left + data.counts.right}</p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {[
                  [String(data.counts.left), en ? "Left" : "Left side", `${data.counts.leftGreen} Green`],
                  [String(data.counts.right), en ? "Right" : "Right side", `${data.counts.rightGreen} Green`],
                  [String(data.counts.directs), en ? "My directs" : "मेरे direct", `${data.counts.directsGreen} Green`],
                ].map(([v, l, h]) => (
                  <div key={l} className="rounded-xl bg-white/10 p-2.5"><p className="text-lg font-bold leading-tight">{v}</p><p className="text-[11px] text-white/70">{l}</p><p className="text-[10px] text-white/50">{h}</p></div>
                ))}
              </div>
              <p className="mt-3 text-xs text-white/75">{en ? "Green means the plan is active. Red means not active yet." : "Green मतलब plan चालू है। Red मतलब अभी चालू नहीं।"}</p>
            </section>

            <div className="flex gap-1 rounded-xl bg-surface2 p-1">
              {(["list", "tree"] as const).map((v) => (
                <button key={v} type="button" onClick={() => setView(v)} className={`flex-1 rounded-lg py-2 text-sm font-semibold ${view === v ? "bg-surface shadow-sm" : "text-muted"}`}>
                  {v === "list" ? (en ? "List" : "सूची") : (en ? "Tree" : "Tree")}
                </button>
              ))}
            </div>

            {view === "list" ? <MemberList /> : <TreeView rootHandle={data.me.handle} />}
          </>
        ) : null}
      </BizState>
    </BizShell>
  );
}

function StatusPill({ status, lapsed }: { status: Status; lapsed?: boolean }) {
  const { lang } = useT(); const en = lang === "en";
  const green = status === "green";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${green ? "bg-good/15 text-good" : "bg-danger/10 text-danger"}`}>
      {green ? "Green" : "Red"}{lapsed ? ` · ${en ? "ended" : "खत्म"}` : ""}
    </span>
  );
}

function MemberList() {
  const { lang } = useT(); const en = lang === "en";
  const [tab, setTab] = useState<Tab>("directs");
  const [rows, setRows] = useState<Row[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");

  const load = useCallback(async (t: Tab, offset: number) => {
    setBusy(true); setErr("");
    const r = await bizAct<ListRes>("team", { op: "list", tab: t, offset, limit: 30 });
    if (!r.ok) setErr(r.error ?? "");
    else { setRows((old) => (offset ? [...old, ...r.data.rows] : r.data.rows)); setHasMore(r.data.hasMore); }
    setBusy(false);
  }, []);
  useEffect(() => { void load(tab, 0); }, [tab, load]);

  const tabs: [Tab, string][] = [["directs", en ? "My directs" : "मेरे direct"], ["left", en ? "Left" : "Left side"], ["right", en ? "Right" : "Right side"]];
  return (
    <section className="space-y-3">
      <div className="flex gap-2">
        {tabs.map(([k, l]) => (
          <button key={k} type="button" onClick={() => { setRows([]); setTab(k); }} className={`flex-1 rounded-xl border py-2 text-sm font-semibold ${tab === k ? "border-brand bg-brand-soft text-brand-ink" : "border-border bg-surface text-muted"}`}>{l}</button>
        ))}
      </div>
      {err && <p className="text-sm font-semibold text-danger">{err}</p>}
      {!busy && !err && rows.length === 0 && <p className={`${CARD} text-center text-sm text-muted`}>{en ? "Nobody here yet." : "यहाँ अभी कोई नहीं।"}</p>}
      {rows.length > 0 && (
        <div className="divide-y divide-border rounded-2xl border border-border bg-surface">
          {rows.map((r) => (
            <div key={r.handle} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{r.handle}</p>
                <p className="text-[11px] text-muted">{r.side === "L" ? (en ? "Left" : "Left side") : (en ? "Right" : "Right side")} · {en ? "joined" : "जुड़े"} {dayOf(r.joined)}</p>
              </div>
              <StatusPill status={r.status} lapsed={r.lapsed} />
            </div>
          ))}
        </div>
      )}
      {busy && <div className="py-4 grid place-items-center"><LoaderCircle className="h-5 w-5 animate-spin text-muted" /></div>}
      {hasMore && !busy && (
        <button type="button" onClick={() => load(tab, rows.length)} className="w-full rounded-xl border border-border bg-surface py-2.5 text-sm font-semibold">{en ? "Show more" : "और दिखाएँ"}</button>
      )}
    </section>
  );
}

/** One person with their two spots below; tap an arrow to open the next level. */
function TreeView({ rootHandle }: { rootHandle: string }) {
  const { lang } = useT(); const en = lang === "en";
  return (
    <section className="space-y-2">
      <p className="text-xs text-muted">{en ? "Tap the arrow to see who is below a person." : "किसी के नीचे कौन है, देखने के लिए arrow दबाएँ।"}</p>
      <div className={CARD}><TreeNode handle={rootHandle} status={null} side={null} root /></div>
    </section>
  );
}

function TreeNode({ handle, status, side, root }: { handle: string; status: Status | null; side: Side | null; root?: boolean }) {
  const { lang } = useT(); const en = lang === "en";
  const [open, setOpen] = useState(!!root);
  const [res, setRes] = useState<NodeRes | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || res) return;
    let live = true;
    (async () => {
      setBusy(true);
      const r = await bizAct<NodeRes>("team", { op: "node", handle });
      if (live) { setRes(r.ok ? r.data : { error: r.error }); setBusy(false); }
    })();
    return () => { live = false; };
  }, [open, res, handle]);

  const kids = res?.children ?? [];
  const sides: Side[] = ["L", "R"];
  const st = status ?? res?.node?.status ?? null;
  return (
    <div>
      <div className="flex items-center gap-2 py-1.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close" : "Open"} className="grid h-6 w-6 place-items-center rounded-lg border border-border">
          <ChevronRight className={`h-4 w-4 transition-transform ${open ? "rotate-90" : ""}`} />
        </button>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{root ? (en ? "You" : "आप") : handle}</span>
        {side && <span className="text-[11px] text-muted">{side === "L" ? "L" : "R"}</span>}
        {st && <StatusPill status={st} />}
      </div>
      {open && (
        <div className="ml-3 border-l border-border pl-3">
          {busy && <LoaderCircle className="my-2 h-4 w-4 animate-spin text-muted" />}
          {res?.error && <p className="py-1 text-xs text-danger">{res.error}</p>}
          {res && !res.error && sides.map((s) => {
            const k = kids.find((x) => x.side === s);
            return k
              ? (k.hasKids ? <TreeNode key={s} handle={k.handle} status={k.status} side={s} /> : (
                <div key={s} className="flex items-center gap-2 py-1.5 pl-8">
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">{k.handle}</span>
                  <span className="text-[11px] text-muted">{s}</span>
                  <StatusPill status={k.status} />
                </div>))
              : <p key={s} className="py-1.5 pl-8 text-xs text-faint">{s === "L" ? (en ? "Left: empty spot" : "Left: खाली जगह") : (en ? "Right: empty spot" : "Right: खाली जगह")}</p>;
          })}
        </div>
      )}
    </div>
  );
}
