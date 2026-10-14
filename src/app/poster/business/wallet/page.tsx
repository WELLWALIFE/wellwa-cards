"use client";
// Business > Wallet. Data from the partner handler `p.wallet` (see shubhora-partner src/server/app-api/wallet.ts for the shapes).
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, bizAct, dayOf, rupee, rupeeExact, useBiz } from "@/components/business/kit";

type Wd = { id: number; amountPaise: number | null; status: "requested" | "approved" | "paid" | "rejected"; utr: string | null; rejectReason: string | null; requestedAt: string };
type Led = { id: number; entry: string; label: string; note: string; amountPaise: number | null; at: string };
type View = {
  show: boolean; balancePaise: number | null; pendingPaise: number | null;
  totals: { incomePaise: number; tdsPaise: number; withdrawnPaise: number } | null;
  withdraw: { state: "ok" | "paused" | "hold" | "kyc"; minPaise: number };
  withdrawals: Wd[]; ledger: Led[]; hasMore: boolean; next: number | null;
};

const STATUS: Record<Wd["status"], [string, string, string]> = {
  requested: ["Asked", "माँगा गया", "bg-brand/10 text-brand"],
  approved: ["Approved", "मंज़ूर", "bg-amber-soft text-amber"],
  paid: ["Paid", "भुगतान हो गया", "bg-good/15 text-good"],
  rejected: ["Rejected", "मना किया", "bg-danger/10 text-danger"],
};

export default function WalletPage() {
  const { lang } = useT(); const en = lang === "en";
  const { data, error, loading, reload } = useBiz<View>("wallet");
  const [more, setMore] = useState<Led[]>([]);
  const [next, setNext] = useState<number | null | undefined>(undefined); // undefined = use data.next
  const [busy, setBusy] = useState(false);
  const [amount, setAmount] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const cursor = next === undefined ? data?.next ?? null : next;
  const money = (v: number | null) => (v === null ? "••••" : rupeeExact(v));

  async function loadMore() {
    if (cursor === null) return;
    setBusy(true);
    const r = await bizAct<{ ledger?: Led[]; next?: number | null }>("wallet", { op: "view", before: cursor });
    setBusy(false);
    if (r.ok) { setMore((m) => [...m, ...(r.data.ledger ?? [])]); setNext(r.data.next ?? null); }
    else setMsg({ ok: false, text: r.error ?? "" });
  }

  async function withdraw(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setMsg(null);
    const r = await bizAct<{ message?: string }>("wallet", { op: "withdraw", amount });
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: r.data.message ?? "OK" }); setAmount(""); setMore([]); setNext(undefined); reload(); }
    else setMsg({ ok: false, text: r.error ?? "" });
  }

  const v = data;
  const w = v?.withdraw;
  return (
    <BizShell title={en ? "Wallet" : "Wallet (बटुआ)"}>
      <BizState loading={loading} error={error} onRetry={reload}>
        {v && w && (
          <>
            <section className="rounded-2xl bg-[#12144a] p-4 text-white">
              <p className="text-xs opacity-75">{en ? "You can withdraw" : "आप निकाल सकते हैं"}</p>
              <p className="mt-1 text-3xl font-extrabold">{money(v.balancePaise)}</p>
              {!v.show && <p className="mt-1 text-xs opacity-75">{en ? "Your balance is hidden. You can show it in your profile." : "आपका balance छिपा है। Profile में दिखा सकते हैं।"}</p>}
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-xl bg-white/10 p-2"><p className="opacity-75">{en ? "Waiting to be paid" : "भुगतान का इंतज़ार"}</p><p className="font-bold">{money(v.pendingPaise)}</p></div>
                <div className="rounded-xl bg-white/10 p-2"><p className="opacity-75">{en ? "Total earned" : "कुल कमाई"}</p><p className="font-bold">{v.totals ? rupee(v.totals.incomePaise) : "••••"}</p></div>
                <div className="rounded-xl bg-white/10 p-2"><p className="opacity-75">{en ? "Tax cut (TDS)" : "टैक्स कटा (TDS)"}</p><p className="font-bold">{v.totals ? rupee(v.totals.tdsPaise) : "••••"}</p></div>
                <div className="rounded-xl bg-white/10 p-2"><p className="opacity-75">{en ? "Already withdrawn" : "पहले निकाला"}</p><p className="font-bold">{v.totals ? rupee(v.totals.withdrawnPaise) : "••••"}</p></div>
              </div>
            </section>

            <section className={CARD}>
              <h2 className="font-bold">{en ? "Withdraw money" : "पैसे निकालें"}</h2>
              <p className="mt-1 text-xs text-muted">{en
                ? "Income is added after each night's closing, with TDS already cut. When you ask, the amount is kept aside. It leaves your wallet when the company pays your bank, and then you see the bank number (UTR)."
                : "हर रात के closing के बाद कमाई जुड़ती है, TDS पहले ही कटा होता है। आप माँगते हैं तो रकम अलग रख दी जाती है। कंपनी जब आपके bank में भेजती है तब वह wallet से जाती है, और आपको bank number (UTR) दिखता है।"}</p>
              {w.state === "paused" && <p className="mt-3 text-sm text-muted">{en ? "Withdrawals are paused right now." : "अभी निकासी बंद है।"}</p>}
              {w.state === "hold" && <p className="mt-3 text-sm text-muted">{en ? "Withdrawals are on hold for this ID. Please contact support." : "इस ID की निकासी रुकी है। Support से बात करें।"}</p>}
              {w.state === "kyc" && <p className="mt-3 rounded-xl bg-amber-soft p-3 text-sm text-amber">{en ? "Complete your KYC first. You need approved KYC to withdraw." : "पहले अपना KYC पूरा करें। निकासी के लिए KYC मंज़ूर होना ज़रूरी है।"} <a href="/poster/business/kyc" className="font-semibold underline">{en ? "Go to KYC" : "KYC पर जाएँ"}</a></p>}
              {w.state === "ok" && (
                <form onSubmit={withdraw} className="mt-3 space-y-2">
                  <label className="block text-sm font-semibold">{en ? "Amount in rupees" : "रकम (रुपये में)"}
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="numeric" required placeholder="500" className="mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base" />
                  </label>
                  <p className="text-xs text-muted">{en ? `Minimum ${rupee(w.minPaise)}. It is paid to your KYC bank account.` : `कम से कम ${rupee(w.minPaise)}। रकम आपके KYC वाले bank खाते में जाएगी।`}</p>
                  <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                    {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{en ? "Request withdrawal" : "निकासी माँगें"}
                  </button>
                </form>
              )}
              {msg && <p className={`mt-3 rounded-xl p-3 text-sm ${msg.ok ? "bg-good/10 text-good" : "bg-danger/10 text-danger"}`}>{msg.text}</p>}
            </section>

            <section className={CARD}>
              <h2 className="font-bold">{en ? "My withdrawal requests" : "मेरी निकासी की माँगें"}</h2>
              {v.withdrawals.length === 0 ? <p className="mt-2 text-sm text-muted">{en ? "No requests yet." : "अभी कोई माँग नहीं।"}</p> : (
                <ul className="mt-2 divide-y divide-border">
                  {v.withdrawals.map((x) => (
                    <li key={x.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                      <div>
                        <p className="font-semibold">{money(x.amountPaise)}</p>
                        <p className="text-xs text-muted">{dayOf(x.requestedAt)}{x.utr ? ` · UTR ${x.utr}` : ""}</p>
                        {x.rejectReason && <p className="text-xs text-danger">{x.rejectReason}</p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS[x.status]?.[2] ?? ""}`}>{STATUS[x.status] ? STATUS[x.status][en ? 0 : 1] : x.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={CARD}>
              <h2 className="font-bold">{en ? "Every rupee in and out" : "हर रुपये का हिसाब"}</h2>
              {v.ledger.length + more.length === 0 ? <p className="mt-2 text-sm text-muted">{en ? "No wallet entries yet." : "अभी कोई entry नहीं।"}</p> : (
                <ul className="mt-2 divide-y divide-border">
                  {[...v.ledger, ...more].map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold">{l.label}</p>
                        {l.note && <p className="text-xs text-muted">{l.note}</p>}
                        <p className="text-xs text-muted">{dayOf(l.at)}</p>
                      </div>
                      <p className={`shrink-0 font-bold ${l.amountPaise === null ? "" : l.amountPaise < 0 ? "text-danger" : "text-good"}`}>
                        {l.amountPaise === null ? "••••" : `${l.amountPaise < 0 ? "−" : "+"}${rupeeExact(Math.abs(l.amountPaise))}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {cursor !== null && (
                <button type="button" onClick={loadMore} disabled={busy} className="mt-3 w-full rounded-xl border border-border bg-surface py-2.5 text-sm font-semibold disabled:opacity-60">
                  {busy ? <LoaderCircle className="mx-auto h-4 w-4 animate-spin" /> : en ? "Show older" : "और पुराने दिखाएँ"}
                </button>
              )}
            </section>
          </>
        )}
      </BizState>
    </BizShell>
  );
}
