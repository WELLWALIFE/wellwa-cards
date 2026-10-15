"use client";
// Rank — current rank, next rank with progress, all ranks and reward payments. Data: /api/business/rank (partner handler app-api/rank.ts).
import { Check, Lock } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, dayOf, rupee, useBiz } from "@/components/business/kit";

type RankRow = { level: number; name: string; renewalPairs: number; greenDirects: number; rewardPaise: number; instalments: number };
type Res = {
  disabled?: boolean; current: { level: number; name: string } | null; next: RankRow | null; pairs: number; directs: number; ownGreen: boolean; topReached: boolean;
  ranks: (RankRow & { earnedOn: string | null })[];
  instalments: { level: number; rankName: string; seq: number; dueOn: string; paise: number; status: string }[];
};
const STATUS: Record<string, [string, string, string]> = {
  paid: ["Paid", "मिल गया", "bg-good/15 text-good"], pending: ["Upcoming", "आने वाला", "bg-brand/10 text-brand-ink"],
  awaiting_approval: ["Being checked", "जाँच में", "bg-surface2 text-muted"], skipped: ["Missed (ID not active)", "छूट गया (ID active नहीं)", "bg-danger/10 text-danger"], cancelled: ["Cancelled", "रद्द", "bg-danger/10 text-danger"],
};

export default function RankPage() {
  const { lang } = useT(); const en = lang === "en";
  const { data, error, loading, reload } = useBiz<Res>("rank");
  return (
    <BizShell title="Rank">
      <BizState loading={loading} error={error} onRetry={reload}>
        {data?.disabled && <p className={`${CARD} text-center text-sm text-muted`}>{en ? "This page is not open right now." : "यह page अभी बंद है।"}</p>}
        {data && !data.disabled && (() => {
          const nx = data.next;
          const pct = nx ? Math.min(100, Math.round((Math.min(data.pairs, nx.renewalPairs) / Math.max(1, nx.renewalPairs)) * 100)) : 100;
          const Need = ({ ok, text }: { ok: boolean; text: string }) => <p className={`flex items-center gap-1.5 text-xs ${ok ? "text-[#7ee2a8]" : "text-white/70"}`}>{ok ? <Check className="h-3.5 w-3.5" /> : <span className="mx-1 h-1.5 w-1.5 rounded-full bg-white/50" />}{text}</p>;
          return (
            <>
              <section className="rounded-2xl bg-[#12144a] p-4 text-white">
                <p className="text-xs text-white/70">{en ? "Your rank" : "आपका rank"}</p>
                <p className="text-2xl font-bold">{data.current?.name ?? (en ? "Not ranked yet" : "अभी कोई rank नहीं")}</p>
                {nx ? (
                  <>
                    <p className="mt-3 text-sm text-white/80">{en ? "Next" : "अगला"}: <b className="text-white">{nx.name}</b> · {en ? "reward" : "इनाम"} <b className="text-white">{rupee(nx.rewardPaise)}</b>{nx.instalments > 1 ? (en ? ` in ${nx.instalments} monthly parts` : ` ${nx.instalments} महीनों में`) : ""}</p>
                    <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-white" style={{ width: `${pct}%` }} /></div>
                    <div className="mt-3 space-y-1">
                      <Need ok={data.pairs >= nx.renewalPairs} text={`${en ? "Renewal pairs" : "Renewal pair"} ${data.pairs.toLocaleString("en-IN")} / ${nx.renewalPairs.toLocaleString("en-IN")}`} />
                      {nx.greenDirects > 0 && <Need ok={data.directs >= nx.greenDirects} text={`${en ? "Green people you introduced" : "आपके बुलाए Green लोग"} ${data.directs} / ${nx.greenDirects}`} />}
                      <Need ok={data.ownGreen} text={en ? "Your ID is Green and plan is active" : "आपकी ID Green और plan active"} />
                    </div>
                  </>
                ) : <p className="mt-3 text-sm text-white/80">{en ? "You have reached the top rank. Congratulations!" : "आप सबसे ऊँचे rank पर हैं। बधाई!"}</p>}
              </section>

              <section className={`${CARD} space-y-2 text-xs text-muted`}>
                <p className="text-sm font-semibold text-ink">{en ? "How ranks work" : "Rank कैसे मिलता है"}</p>
                <p>{en ? "Ranks come from renewal pairs: customers in your team who keep their plan month after month." : "Rank renewal pair से मिलता है: आपकी team के वे लोग जो हर महीने plan चालू रखते हैं।"}</p>
                <p>{en ? "Each reward is paid once into your wallet, after TDS. Big rewards come in monthly parts, and a part is paid only if your ID is active that month." : "हर इनाम एक बार wallet में आता है, TDS के बाद। बड़े इनाम महीने-महीने हिस्सों में आते हैं, और हिस्सा तभी मिलता है जब उस महीने आपकी ID active हो।"}</p>
                <p>{en ? "Rewards come from a monthly pool. If it is used up, your payment moves to the next days. These are the most you can get, not a promise." : "इनाम महीने के pool से मिलते हैं। pool खत्म हो जाए तो आपका भुगतान अगले दिनों में जाता है। ये ज़्यादा से ज़्यादा रकम है, वादा नहीं।"}</p>
              </section>

              <section className="space-y-2">
                <p className="text-sm font-semibold">{en ? "All ranks" : "सभी rank"}</p>
                {data.ranks.map((k) => (
                  <div key={k.level} className={`${CARD} space-y-1 ${k.earnedOn ? "" : "opacity-80"}`}>
                    <div className="flex items-center justify-between"><span className="font-semibold">{k.name}</span>
                      {k.earnedOn ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-good"><Check className="h-4 w-4" />{dayOf(k.earnedOn)}</span> : <span className="inline-flex items-center gap-1 text-xs text-faint"><Lock className="h-3.5 w-3.5" />{en ? "Locked" : "बंद"}</span>}</div>
                    <p className="text-xs text-muted">{en ? "Renewal pairs" : "Renewal pair"} {k.renewalPairs.toLocaleString("en-IN")}{k.greenDirects > 0 ? ` · ${en ? "Green people you introduced" : "बुलाए Green लोग"} ${k.greenDirects}` : ""}</p>
                    <p className="text-xs"><b>{rupee(k.rewardPaise)}</b> · {k.instalments > 1 ? (en ? `${k.instalments} monthly parts of ${rupee(Math.floor(k.rewardPaise / k.instalments))}` : `${k.instalments} महीनों में ${rupee(Math.floor(k.rewardPaise / k.instalments))}`) : en ? "One payment" : "एक बार में"}</p>
                  </div>
                ))}
              </section>

              {data.instalments.length > 0 && (
                <section className={CARD}>
                  <p className="text-sm font-semibold">{en ? "My reward payments" : "मेरे इनाम के भुगतान"}</p>
                  <ul className="mt-2 divide-y divide-border text-sm">
                    {data.instalments.map((i, x) => {
                      const s = STATUS[i.status];
                      return (
                        <li key={x} className="flex items-center justify-between gap-2 py-2">
                          <span><span className="font-semibold">{i.rankName}</span> · #{i.seq}<span className="block text-[11px] text-muted">{en ? "Due" : "तारीख"} {dayOf(i.dueOn)}</span></span>
                          <span className="text-right"><b>{rupee(i.paise)}</b><span className={`mt-0.5 block rounded-full px-2 py-0.5 text-[10px] font-bold ${s?.[2] ?? ""}`}>{s ? (en ? s[0] : s[1]) : i.status}</span></span>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
            </>
          );
        })()}
      </BizState>
    </BizShell>
  );
}
