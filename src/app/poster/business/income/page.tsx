"use client";
// Income — totals, per-kind breakdown, statement and pair/carry details. Data: /api/business/income (partner handler app-api/income.ts).
import { useCallback, useEffect, useState } from "react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, bizAct, dayOf, rupee, useBiz } from "@/components/business/kit";

type Totals = Record<string, { total: number; last: number }>;
type Row = { kind: string; paise: number; held: boolean; day: string; from: string | null };
type Line = { day: string; bin: "new" | "renewal"; openL: number; openR: number; inL: number; inR: number; pairs: number; paidPairs: number; flushedPairs: number; closeL: number; closeR: number; paise: number; reason: string | null };
type View = { carryL: number; carryR: number; totalL: number; totalR: number; firstPair: boolean; pairs: number; todayL: number; todayR: number };
type Res = { totals: Totals; grandTotal: number; lastTotal: number; lastClosing: string | null; t: string; offset: number; limit: number; more: boolean; rows?: Row[]; lines?: Line[]; binary?: { new: View; renewal: View } };

const KINDS = ["direct", "match_new", "match_renewal", "sponsor", "rank_reward"] as const;
const KIND: Record<string, [string, string]> = {
  direct: ["Direct sale", "सीधी बिक्री"], match_new: ["Pair (new)", "Pair (नया)"], match_renewal: ["Pair (renewal)", "Pair (renewal)"], sponsor: ["Sponsor", "Sponsor"], rank_reward: ["Rank reward", "Rank reward"],
};
const WHAT: Record<string, [string, string]> = {
  direct: ["Someone you introduced buys a plan. You get a bonus at once.", "आपके बुलाए व्यक्ति ने plan लिया। आपको तुरंत bonus मिलता है।"],
  match_new: ["One new person on your left and one on your right make a pair. Each pair pays you.", "बायीं और दायीं side पर एक-एक नया व्यक्ति मिलकर एक pair बनाता है। हर pair का पैसा मिलता है।"],
  match_renewal: ["Same pair idea, but when people in your team renew their plan.", "वही pair, पर तब जब आपकी team के लोग plan renew करते हैं।"],
  sponsor: ["A small bonus from the sales of the people you introduced.", "आपके बुलाए लोगों की बिक्री पर छोटा bonus।"],
  rank_reward: ["A reward you get when you reach a new rank.", "नया rank मिलने पर इनाम।"],
};
const REASON: Record<string, [string, string]> = {
  red: ["ID was red", "ID Red थी"], "daily cap": ["Above daily limit", "रोज़ की limit से ऊपर"], blocked: ["ID blocked", "ID blocked"], complimentary: ["Free ID", "Free ID"],
  "own subscription not active": ["Your plan was not active", "आपका plan active नहीं था"], "subscription lapsed too long": ["Plan ended too long ago", "Plan बहुत पहले खत्म हुआ"],
};
const TABS: [string, string, string][] = [["all", "All", "सब"], ...KINDS.map((k) => [k, KIND[k][0], KIND[k][1]] as [string, string, string]), ["closings", "Pair details", "Pair details"]];

export default function IncomePage() {
  const { lang } = useT(); const en = lang === "en";
  const [t, setT] = useState("all");
  const { data, error, loading, reload } = useBiz<Res>("income", { t });
  const [rows, setRows] = useState<Row[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const tx = (p: [string, string]) => (en ? p[0] : p[1]);

  useEffect(() => { if (data) { setRows(data.rows ?? []); setLines(data.lines ?? []); setMore(data.more); } }, [data]);
  const loadMore = useCallback(async () => {
    setBusy(true);
    const r = await bizAct<Res>("income", { t, offset: rows.length || lines.length });
    setBusy(false);
    if (r.ok) { setRows((x) => [...x, ...(r.data.rows ?? [])]); setLines((x) => [...x, ...(r.data.lines ?? [])]); setMore(r.data.more); }
  }, [t, rows.length, lines.length]);

  return (
    <BizShell title={en ? "Income" : "कमाई"}>
      <BizState loading={loading && !data} error={error} onRetry={reload}>
        {data && (
          <>
            <section className="rounded-2xl bg-[#12144a] p-4 text-white">
              <p className="text-xs text-white/70">{en ? "Total earned" : "कुल कमाई"}</p>
              <p className="text-3xl font-bold">{rupee(data.grandTotal)}</p>
              <p className="mt-1 text-xs text-white/70">{data.lastClosing ? `${en ? "Last closing" : "पिछली closing"} ${dayOf(data.lastClosing)}: ${rupee(data.lastTotal)}` : en ? "No closing yet." : "अभी कोई closing नहीं हुई।"}</p>
              <p className="mt-2 text-[11px] text-white/60">{en ? "Worked out every day at closing. Amounts are before TDS." : "हर दिन closing पर बनती है। रकम TDS से पहले की है।"}</p>
            </section>

            <section className={`${CARD} space-y-3`}>
              <p className="text-sm font-semibold">{en ? "Where your money comes from" : "पैसा कहाँ से आता है"}</p>
              {KINDS.map((k) => (
                <div key={k}>
                  <div className="flex items-center justify-between text-sm"><span className="font-semibold">{tx(KIND[k])}</span><span className="font-bold">{rupee(data.totals[k]?.total)}</span></div>
                  <p className="text-[11px] text-muted">{tx(WHAT[k])}{data.totals[k]?.last ? ` ${en ? "Last closing" : "पिछली closing"}: ${rupee(data.totals[k].last)}.` : ""}</p>
                </div>
              ))}
              <p className="text-[11px] text-faint">{en ? "Every direct sale also gives you Shubhora AI credits. Renewal pairs need your own plan to be active; if it ends, that money waits a few days and is paid only if you renew in time." : "हर direct sale पर Shubhora AI credits भी मिलते हैं। Renewal pair के लिए आपका अपना plan active होना चाहिए; खत्म हो जाए तो पैसा कुछ दिन रुकता है और समय पर renew करने पर ही मिलता है।"}</p>
            </section>

            <div className="flex flex-wrap gap-1.5">
              {TABS.map(([k, e, h]) => (
                <button key={k} type="button" onClick={() => setT(k)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${t === k ? "bg-brand text-white" : "border border-border bg-surface text-muted"}`}>{en ? e : h}</button>
              ))}
            </div>

            {t === "closings" ? (
              <>
                {data.binary && (["new", "renewal"] as const).map((b) => (
                  <section key={b} className={`${CARD} space-y-1`}>
                    <p className="text-sm font-semibold">{b === "new" ? (en ? "New sales" : "नई बिक्री") : "Renewal"}</p>
                    <div className="grid grid-cols-3 gap-2 text-center text-xs">
                      <div className="rounded-xl bg-surface2 p-2"><p className="text-muted">{en ? "Waiting" : "बचा हुआ"}</p><p className="font-bold">{data.binary![b].carryL} / {data.binary![b].carryR}</p></div>
                      <div className="rounded-xl bg-surface2 p-2"><p className="text-muted">{en ? "Today" : "आज"}</p><p className="font-bold">{data.binary![b].todayL} / {data.binary![b].todayR}</p></div>
                      <div className="rounded-xl bg-surface2 p-2"><p className="text-muted">{en ? "Pairs so far" : "अब तक pair"}</p><p className="font-bold">{data.binary![b].pairs}</p></div>
                    </div>
                    <p className="text-[11px] text-muted">{en ? "Numbers are Left / Right. The side with less decides how many pairs you get; the extra stays waiting for the next day." : "संख्या Left / Right की है। जिस side में कम है वही pair तय करती है; बाकी अगले दिन के लिए रुकता है।"}</p>
                  </section>
                ))}
                <section className="space-y-2">
                  {lines.length === 0 && <p className={`${CARD} text-center text-sm text-muted`}>{en ? "No closings for you yet." : "अभी आपकी कोई closing नहीं।"}</p>}
                  {lines.map((l, i) => (
                    <div key={i} className={`${CARD} space-y-1 text-xs`}>
                      <div className="flex items-center justify-between"><span className="font-semibold">{dayOf(l.day)} · {l.bin === "new" ? (en ? "New sale" : "नई बिक्री") : "Renewal"}</span><span className="text-sm font-bold">{rupee(l.paise)}</span></div>
                      <p className="text-muted">{en ? "Before" : "पहले"} {l.openL}/{l.openR} · {en ? "New" : "नया"} {l.inL}/{l.inR} · {en ? "Left over" : "बचा"} {l.closeL}/{l.closeR}</p>
                      <p><span className="font-semibold">{l.pairs}</span> {en ? "pairs" : "pair"}, <span className="font-semibold text-good">{l.paidPairs} {en ? "paid" : "मिले"}</span>{l.flushedPairs > 0 && <>, <span className="text-danger">{l.flushedPairs} {en ? "over the limit" : "limit से ऊपर"}</span></>}{l.reason && <span className="text-muted"> · {REASON[l.reason] ? tx(REASON[l.reason]) : l.reason}</span>}</p>
                    </div>
                  ))}
                </section>
              </>
            ) : (
              <section className={CARD}>
                {rows.length === 0 && <p className="py-4 text-center text-sm text-muted">{en ? "No income yet." : "अभी कोई कमाई नहीं।"}</p>}
                <ul className="divide-y divide-border text-sm">
                  {rows.map((r, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 py-2">
                      <span className="min-w-0"><span className="font-semibold">{KIND[r.kind] ? tx(KIND[r.kind]) : r.kind}</span>{r.held && <span className="ml-1.5 rounded bg-danger/10 px-1.5 py-0.5 text-[10px] font-bold text-danger">{en ? "On hold" : "रुका है"}</span>}
                        <span className="block text-[11px] text-muted">{dayOf(r.day)} · {r.from ?? (en ? "Your team" : "आपकी team")}</span></span>
                      <span className="font-bold">{rupee(r.paise)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            {more && <button type="button" disabled={busy} onClick={loadMore} className="w-full rounded-xl border border-border bg-surface py-2.5 text-sm font-semibold disabled:opacity-60">{busy ? "…" : en ? "Show more" : "और दिखाएँ"}</button>}
          </>
        )}
      </BizState>
    </BizShell>
  );
}
