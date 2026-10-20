"use client";
// Plan — the partner plan in plain words, with the member's own place in it (package, pairs, next reward, royalty).
// Data: /api/business/plan (partner handler app-api/plan.ts). Every number comes from the partner service's plan settings, never typed here.
import Link from "next/link";
import { Check, Lock } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, dayOf, rupee, useBiz } from "@/components/business/kit";

type Pkg = { pricePaise?: number; firstPaise?: number; thenPaise?: number; pv: number; bv: number; capPaise: number; capPairs: number };
type Reward = { level: number; name: string; pairs: number; rewardPaise: number; earnedOn: string | null };
type Res = {
  disabled?: boolean;
  packages: { standard: Pkg; premium: Pkg };
  upgrade: { pricePaise: number; bv: number };
  pair: { bv: number; incomePaise: number; firstPairRatio: string };
  direct: { pct: number; asCredits: boolean; creditPaise: number; standardCredits: number; premiumCredits: number };
  royalty: { pct: number; pairs: number };
  oneBinary: boolean; graceDays: number;
  rewards: Reward[];
  me: {
    package: "standard" | "premium"; capPaise: number; capPairs: number; status: string; subActive: boolean; pairs: number;
    carryL: number; carryR: number; carryRenewalL: number; carryRenewalR: number; firstPairDone: boolean;
    royaltyQualified: boolean; royaltyPairsLeft: number; nextReward: { name: string; pairs: number; rewardPaise: number; pairsLeft: number } | null;
  };
};

const num = (v: number) => v.toLocaleString("en-IN");

export default function PlanPage() {
  const { lang } = useT(); const en = lang === "en";
  const { data, error, loading, reload } = useBiz<Res>("plan");
  return (
    <BizShell title={en ? "Plan" : "Plan"}>
      <BizState loading={loading} error={error} onRetry={reload}>
        {data?.disabled && <p className={`${CARD} text-center text-sm text-muted`}>{en ? "This page is not open right now." : "यह page अभी बंद है।"}</p>}
        {data && !data.disabled && (() => {
          const me = data.me, std = data.packages.standard, prm = data.packages.premium;
          const premium = me.package === "premium";
          const nx = me.nextReward;
          const pct = nx ? Math.min(100, Math.round((Math.min(me.pairs, nx.pairs) / Math.max(1, nx.pairs)) * 100)) : 100;
          const royaltyPct = Math.min(100, Math.round((Math.min(me.pairs, data.royalty.pairs) / Math.max(1, data.royalty.pairs)) * 100));
          return (
            <>
              {/* Me in the plan */}
              <section className="rounded-2xl bg-[#12144a] p-4 text-white">
                <p className="text-xs text-white/70">{en ? "Your package" : "आपका package"}</p>
                <p className="text-2xl font-bold">{premium ? "Premium" : "Standard"} <span className="text-sm font-normal text-white/70">· {me.status === "green" ? "Green" : "Red"}</span></p>
                <p className="mt-1 text-xs text-white/75">{en ? `Daily limit ${rupee(me.capPaise)} (${num(me.capPairs)} pairs a day)` : `रोज़ की limit ${rupee(me.capPaise)} (${num(me.capPairs)} pair रोज़)`}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {[[num(me.pairs), en ? "Pairs so far" : "अब तक pair"], [num(me.carryL), en ? "Left carry (BV)" : "Left carry (BV)"], [num(me.carryR), en ? "Right carry (BV)" : "Right carry (BV)"]].map(([v, l]) => (
                    <div key={l} className="rounded-xl bg-white/10 p-2.5"><p className="text-lg font-bold leading-tight">{v}</p><p className="text-[11px] text-white/70">{l}</p></div>
                  ))}
                </div>
                {!me.firstPairDone && <p className="mt-2 text-[11px] text-white/70">{en ? `Your first pair needs ${data.pair.firstPairRatio} (two on one side, one on the other). After that every 1:1 is a pair.` : `पहला pair ${data.pair.firstPairRatio} से बनता है (एक side पर दो, दूसरी पर एक)। उसके बाद हर 1:1 एक pair।`}</p>}
                {!premium && (
                  <div className="mt-3 rounded-xl bg-white/10 p-3 text-xs text-white/85">
                    <p className="font-semibold text-white">{en ? `Upgrade to Premium for ${rupee(data.upgrade.pricePaise)}` : `${rupee(data.upgrade.pricePaise)} में Premium बनें`}</p>
                    <p className="mt-1">{en ? `Your daily limit doubles to ${rupee(prm.capPaise)}, and ${num(data.upgrade.bv)} BV more goes into your upline's tree.` : `रोज़ की limit दोगुनी होकर ${rupee(prm.capPaise)}, और आपके upline की tree में ${num(data.upgrade.bv)} BV और जाता है।`}</p>
                    <Link href="/poster/business/subscription" className="mt-2 inline-block rounded-lg bg-white px-3 py-1.5 font-semibold text-[#12144a]">{en ? "Upgrade" : "Upgrade करें"}</Link>
                  </div>
                )}
              </section>

              {/* Packages */}
              <section className="space-y-2">
                <p className="text-sm font-semibold">{en ? "Two packages" : "दो package"}</p>
                <div className="grid grid-cols-2 gap-2">
                  {([["Standard", std, rupee(std.pricePaise ?? 0), en ? "every month" : "हर महीने", !premium], ["Premium", prm, rupee(prm.firstPaise ?? 0), en ? `first month, then ${rupee(prm.thenPaise ?? 0)}` : `पहला महीना, फिर ${rupee(prm.thenPaise ?? 0)}`, premium]] as const).map(([name, p, price, when, mine]) => (
                    <div key={name} className={`${CARD} space-y-1 ${mine ? "border-brand" : ""}`}>
                      <div className="flex items-center justify-between"><span className="font-semibold">{name}</span>{mine && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand-ink">{en ? "YOU" : "आप"}</span>}</div>
                      <p className="text-lg font-bold">{price}</p>
                      <p className="text-[11px] text-muted">{when}</p>
                      <p className="text-xs">{p.pv} PV · {num(p.bv)} BV</p>
                      <p className="text-xs">{en ? "Daily limit" : "रोज़ की limit"} <b>{rupee(p.capPaise)}</b></p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-faint">{en ? `1 PV = ${num(data.pair.bv)} BV. Renewals of either package are ${rupee(std.pricePaise ?? 0)} a month and add BV to the tree like a sale.` : `1 PV = ${num(data.pair.bv)} BV। दोनों package का renewal ${rupee(std.pricePaise ?? 0)} महीना, और sale की तरह tree में BV जोड़ता है।`}</p>
              </section>

              {/* How money is made */}
              <section className={`${CARD} space-y-3`}>
                <p className="text-sm font-semibold">{en ? "How you earn" : "कमाई कैसे होती है"}</p>
                <div>
                  <p className="text-sm font-semibold">{en ? "1. Direct Sale Bonus" : "1. Direct Sale Bonus"} <span className="font-normal text-muted">· {data.direct.pct}% {en ? "of BV" : "BV का"}</span></p>
                  <p className="text-xs text-muted">{data.direct.asCredits
                    ? (en ? `Paid as Shubhora AI credits: ${data.direct.standardCredits} credits on a Standard sale, ${data.direct.premiumCredits} on Premium (1 credit = ${rupee(data.direct.creditPaise)}).` : `Shubhora AI credits में: Standard sale पर ${data.direct.standardCredits} credits, Premium पर ${data.direct.premiumCredits} (1 credit = ${rupee(data.direct.creditPaise)})।`)
                    : (en ? "Paid into your wallet when someone you introduced buys a plan." : "आपके बुलाए व्यक्ति के plan लेने पर wallet में।")}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{en ? "2. Matching Bonus" : "2. Matching Bonus"} <span className="font-normal text-muted">· {rupee(data.pair.incomePaise)} {en ? "per pair" : "हर pair"}</span></p>
                  <p className="text-xs text-muted">{en
                    ? `${num(data.pair.bv)} BV on your Left and ${num(data.pair.bv)} BV on your Right make one pair. New sales, upgrades and renewals all go into the same two legs. Up to your daily limit; the rest carries forward.`
                    : `Left पर ${num(data.pair.bv)} BV और Right पर ${num(data.pair.bv)} BV = एक pair। नई sale, upgrade और renewal — सब एक ही दो legs में। रोज़ की limit तक; बाकी carry forward।`}</p>
                  <p className="mt-1 text-xs text-muted">{en
                    ? `Pairs made from renewal BV are paid only while your own plan is active (${data.graceDays} days' grace). If it is not, those pairs are still matched but not paid.`
                    : `Renewal BV से बने pair तभी मिलते हैं जब आपका अपना plan active हो (${data.graceDays} दिन की छूट)। नहीं है तो वे pair match तो होंगे, पर पैसा नहीं मिलेगा।`}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{en ? "3. Monthly Royalty" : "3. Monthly Royalty"} <span className="font-normal text-muted">· {data.royalty.pct}% {en ? "of the month's BV" : "महीने के BV का"}</span></p>
                  <p className="text-xs text-muted">{en ? `Shared equally among everyone with ${num(data.royalty.pairs)} or more lifetime pairs, on the last day of the month.` : `महीने के आखिरी दिन, ${num(data.royalty.pairs)} या ज़्यादा lifetime pair वालों में बराबर बँटती है।`}</p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface2"><div className={`h-full rounded-full ${me.royaltyQualified ? "bg-good" : "bg-brand"}`} style={{ width: `${royaltyPct}%` }} /></div>
                  <p className="mt-1 text-[11px] text-muted">{me.royaltyQualified ? (en ? "You qualify for royalty." : "आप royalty के लिए qualified हैं।") : (en ? `${num(me.royaltyPairsLeft)} more pairs to qualify.` : `qualify होने में ${num(me.royaltyPairsLeft)} pair और।`)}</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{en ? "4. Lifetime rewards" : "4. Lifetime rewards"}</p>
                  <p className="text-xs text-muted">{en ? "By total pairs alone — see the ladder below." : "सिर्फ़ कुल pair से — नीचे की सीढ़ी देखें।"}</p>
                </div>
                <p className="text-[11px] text-faint">{en ? "Income is worked out at the daily closing, before TDS. Amounts here are the plan's maximums, not a promise." : "कमाई रोज़ की closing पर बनती है, TDS से पहले। ये plan की ज़्यादा से ज़्यादा रकम है, वादा नहीं।"}</p>
              </section>

              {/* Rewards ladder */}
              <section className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{en ? "Rewards ladder" : "Rewards की सीढ़ी"}</p>
                  {nx && <span className="text-xs text-muted">{en ? "Next" : "अगला"}: {nx.name} · {num(nx.pairsLeft)} {en ? "pairs to go" : "pair बाकी"}</span>}
                </div>
                {nx && <div className="h-2 overflow-hidden rounded-full bg-surface2"><div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} /></div>}
                {data.rewards.map((k) => (
                  <div key={k.level} className={`${CARD} flex items-center justify-between py-3 ${k.earnedOn ? "" : "opacity-80"}`}>
                    <div>
                      <p className="font-semibold">{k.name}</p>
                      <p className="text-xs text-muted">{num(k.pairs)} {en ? "pairs" : "pair"}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{rupee(k.rewardPaise)}</p>
                      {k.earnedOn ? <p className="inline-flex items-center gap-1 text-xs font-semibold text-good"><Check className="h-3.5 w-3.5" />{dayOf(k.earnedOn)}</p> : <p className="inline-flex items-center gap-1 text-xs text-faint"><Lock className="h-3 w-3" />{en ? "Locked" : "बंद"}</p>}
                    </div>
                  </div>
                ))}
                <p className="text-[11px] text-faint">{en ? "Reward payments and their dates are on the Rank page." : "Reward के भुगतान और तारीखें Rank page पर हैं।"}</p>
              </section>
            </>
          );
        })()}
      </BizState>
    </BizShell>
  );
}
