"use client";
// Business > Subscription (+ the panel's "activate": send proof of a manual payment). Data from partner handler `p.subscription`
// (shapes: shubhora-partner src/server/app-api/subscription.ts). Every invoice has a signed link (invoiceUrl) that opens exactly that invoice in a new tab.
import { useRef, useState } from "react";
import Link from "next/link";
import { LoaderCircle } from "lucide-react";
import { useT } from "@/lib/poster-i18n";
import { BizShell, BizState, CARD, InvoiceLink, bizAct, bizUpload, dayOf, rupee, useBiz, useBizMsg } from "@/components/business/kit";

type Hist = { id: number; kind: string; paidOn: string; from: string; to: string; delayDays: number | null; totalPaise: number; invoice: string | null; invoiceUrl: string | null; status: string };
type Req = { id: number; sentAt: string; paidOn: string; forHandle: string; kind: string; method: string; reference: string; amountPaise: number; status: "pending" | "approved" | "rejected"; rejectReason: string | null; invoice: string | null; invoiceUrl: string | null; hasFile: boolean };
type View = {
  disabled?: boolean;
  id: { handle: string; status: "red" | "green" };
  subscription: { state: "none" | "active" | "due soon" | "lapsed"; validTill: string | null; daysLeft: number | null; activatedOn: string | null; lastRenewal: { paidOn: string; delayDays: number | null } | null; renewalsCount: number; lateCount: number };
  history: Hist[];
  package?: "standard" | "premium";
  upgrade?: { pricePaise: number; bv: number; premiumCapPaise: number; standardCapPaise: number };
  price: { basePaise: number; gstBp: number; gstPaise: number; totalPaise: number };
  onlinePay: boolean;
  payTo: { upiId: string | null; upiLink: string | null; qr: string | null; bank: { name: string; accountNo: string; ifsc: string; bankName: string } | null };
  target: string;
  requests: Req[];
};

const METHODS: [string, string, string][] = [["upi", "UPI", "UPI"], ["bank", "Bank transfer", "Bank transfer"], ["cash", "Cash", "नकद (Cash)"], ["cheque", "Cheque", "Cheque"]];
const RSTATUS: Record<Req["status"], [string, string, string]> = {
  pending: ["Waiting for approval", "मंज़ूरी का इंतज़ार", "bg-amber-soft text-amber"],
  approved: ["Approved", "मंज़ूर", "bg-good/15 text-good"],
  rejected: ["Rejected", "नामंज़ूर", "bg-danger/10 text-danger"],
};
const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10); // IST date, like the panel
// "1 day", "2 days" — one is never "1 days".
const days = (n: number) => `${n} ${n === 1 ? "day" : "days"}`;
const field = "mt-1 w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-base";

export default function SubscriptionPage() {
  const { lang } = useT(); const en = lang === "en";
  const tr = useBizMsg();
  const { data: v, error, loading, reload } = useBiz<View>("subscription");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [forCode, setForCode] = useState("");
  const [method, setMethod] = useState("upi");
  const [reference, setReference] = useState("");
  const [paidOn, setPaidOn] = useState(today());
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!v || busy) return;
    setBusy(true); setMsg(null);
    let fileId = "";
    if (file) {
      const up = await bizUpload(file, "payment");
      if (!up.id) { setBusy(false); setMsg({ ok: false, text: tr(up.error) }); return; }
      fileId = up.id;
    }
    const r = await bizAct<{ message?: string }>("subscription", {
      op: "payment_request", for_code: forCode.trim() || v.target, method, reference, paid_on: paidOn,
      amount: amount || String(v.price.totalPaise / 100), file: fileId, note,
    });
    setBusy(false);
    if (r.ok) { setMsg({ ok: true, text: tr(r.data.message ?? "OK") }); setReference(""); setNote(""); setAmount(""); setFile(null); if (fileInput.current) fileInput.current.value = ""; reload(); }
    else setMsg({ ok: false, text: tr(r.error) });
  }

  const s = v?.subscription;
  const tone = s?.state === "lapsed" ? "text-danger" : s?.state === "due soon" ? "text-amber" : "text-good";
  const green = v?.id.status === "green";
  return (
    <BizShell title={en ? "Subscription" : "Subscription (सदस्यता)"}>
      <BizState loading={loading} error={error} onRetry={reload}>
        {v?.disabled ? <p className={`${CARD} text-sm text-muted`}>{en ? "This page is not open right now." : "यह page अभी बंद है।"}</p> : v && s && (
          <>
            <section className="rounded-2xl bg-[#12144a] p-4 text-white">
              <p className="text-xs opacity-75">{en ? "Valid till" : "इस तारीख तक चालू"}</p>
              <p className="mt-1 text-2xl font-extrabold">{s.validTill ? dayOf(s.validTill) : en ? "Not started yet" : "अभी शुरू नहीं हुई"}</p>
              {s.daysLeft !== null && <p className="text-sm opacity-90">{s.daysLeft > 0 ? (en ? `${days(s.daysLeft)} left` : `${s.daysLeft} दिन बाकी`) : s.daysLeft === 0 ? (en ? "Ends today" : "आज खत्म हो रही है") : (en ? `Ended ${days(-s.daysLeft)} ago` : `${-s.daysLeft} दिन पहले खत्म हुई`)}</p>}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded-xl bg-white/10 p-2"><p className="opacity-75">{en ? "Started" : "शुरू"}</p><p className="font-bold">{s.activatedOn ? dayOf(s.activatedOn) : "—"}</p></div>
                <div className="rounded-xl bg-white/10 p-2"><p className="opacity-75">{en ? "Renewals" : "Renewal"}</p><p className="font-bold">{s.renewalsCount}</p></div>
                <div className="rounded-xl bg-white/10 p-2"><p className="opacity-75">{en ? "Late" : "देर से"}</p><p className="font-bold">{s.lateCount}</p></div>
              </div>
            </section>

            {(s.state === "lapsed" || s.state === "due soon") && (
              <p className={`rounded-xl p-3 text-sm font-medium ${s.state === "lapsed" ? "bg-danger/10 text-danger" : "bg-amber-soft text-amber"}`}>
                {s.state === "lapsed"
                  ? (en ? "Your subscription has ended. Renew to earn renewal income again." : "आपकी subscription खत्म हो गई है। Renewal की कमाई फिर पाने के लिए renew करें।")
                  : (en ? `${s.daysLeft === 0 ? "It ends today" : `It ends in ${days(s.daysLeft ?? 0)}`}. Renew early. The new month starts after this one ends, so you lose nothing.` : `${s.daysLeft === 0 ? "यह आज खत्म हो रही है" : `यह ${s.daysLeft} दिन में खत्म होगी`}। जल्दी renew करें। नया महीना इसके बाद शुरू होता है, कुछ नहीं जाता।`)}
              </p>
            )}

            <section className={CARD}>
              <h2 className="font-bold">{green ? (en ? "Renew" : "Renew करें") : (en ? "Turn your ID green" : "अपनी ID Green करें")}</h2>
              <p className="mt-1 text-sm text-muted">{en ? "One month of Shubhora Business Suite." : "Shubhora Business Suite का एक महीना।"}</p>
              <div className="mt-2 space-y-1 text-sm">
                <div className="flex justify-between text-muted"><span>{en ? "Subscription" : "Subscription"}</span><span>{rupee(v.price.basePaise)}</span></div>
                <div className="flex justify-between text-muted"><span>GST {v.price.gstBp / 100}%</span><span>{rupee(v.price.gstPaise)}</span></div>
                <div className="flex justify-between border-t border-border pt-1 font-bold"><span>{en ? "Total" : "कुल"}</span><span>{rupee(v.price.totalPaise)}</span></div>
              </div>
              <Link href="/poster/plan" className="mt-3 flex w-full items-center justify-center rounded-xl grad-brand py-2.5 text-sm font-semibold text-white">{en ? "Pay online (Razorpay)" : "Online भरें (Razorpay)"}</Link>
              <p className="mt-1.5 text-xs text-muted">{en ? "This is the fastest way. Or pay by UPI or bank and send the proof below." : "यह सबसे तेज़ तरीका है। या UPI / bank से भरकर नीचे सबूत भेजें।"}</p>
            </section>

            {/* Plan v3: a running Standard ID can become Premium for the difference — daily limit doubles, 1 PV more goes up the tree. */}
            {v.upgrade && (v.package === "premium" ? (
              <p className={`${CARD} text-sm`}><b>Premium</b> · {en ? `Daily limit ${rupee(v.upgrade.premiumCapPaise)}` : `रोज़ की limit ${rupee(v.upgrade.premiumCapPaise)}`}</p>
            ) : green && (
              <section className={`${CARD} border-brand`}>
                <h2 className="font-bold">{en ? `Upgrade to Premium · ${rupee(v.upgrade.pricePaise)}` : `Premium बनें · ${rupee(v.upgrade.pricePaise)}`}</h2>
                <p className="mt-1 text-sm text-muted">{en
                  ? `You are on Standard (daily limit ${rupee(v.upgrade.standardCapPaise)}). Premium doubles it to ${rupee(v.upgrade.premiumCapPaise)}, adds ${v.upgrade.bv.toLocaleString("en-IN")} BV to your upline's tree, and gives your introducer credits. One-time; your monthly renewal stays the same.`
                  : `आप Standard पर हैं (रोज़ की limit ${rupee(v.upgrade.standardCapPaise)})। Premium में limit दोगुनी ${rupee(v.upgrade.premiumCapPaise)}, आपके upline की tree में ${v.upgrade.bv.toLocaleString("en-IN")} BV और, और आपके introducer को credits। एक बार; महीने का renewal वही रहता है।`}</p>
                <Link href="/poster/site/advanced" className="mt-3 flex w-full items-center justify-center rounded-xl grad-brand py-2.5 text-sm font-semibold text-white">{en ? "Upgrade now" : "अभी upgrade करें"}</Link>
                <p className="mt-1.5 text-xs text-muted">{en ? "Pays online (Razorpay). You also get the advanced website that comes with Premium." : "Online (Razorpay)। Premium के साथ आने वाली advanced website भी मिलती है।"}</p>
              </section>
            ))}

            <section className={CARD}>
              <h2 className="font-bold">{en ? "Paid by UPI or bank? Send the proof" : "UPI / bank से भरा? सबूत भेजें"}</h2>
              <p className="mt-1 text-xs text-muted">{en ? "1. Pay the total to the company account below. 2. Fill this form with the UTR number and a screenshot. 3. The company checks it, usually the same day, and turns your ID green or renews it." : "1. नीचे के company खाते में पैसे भरें। 2. UTR number और screenshot के साथ यह form भरें। 3. कंपनी जाँचकर आमतौर पर उसी दिन ID Green या renew कर देती है।"}</p>
              {v.payTo.upiId || v.payTo.bank ? (
                <div className="mt-3 space-y-2 text-sm">
                  {v.payTo.qr && (
                    <div className="text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={v.payTo.qr} alt="UPI QR" className="mx-auto h-40 w-40 rounded-xl border border-border bg-white p-1.5" />
                      <p className="mt-1 text-[11px] text-muted">{en ? `Scan with any UPI app and enter ${rupee(v.price.totalPaise)}` : `किसी भी UPI app से scan करें और ${rupee(v.price.totalPaise)} डालें`}</p>
                    </div>
                  )}
                  {v.payTo.upiId && <p>UPI: <b className="select-all font-mono">{v.payTo.upiId}</b></p>}
                  {v.payTo.upiLink && <a href={v.payTo.upiLink} className="block rounded-xl border border-border py-2 text-center font-semibold">{en ? "Open UPI app" : "UPI app खोलें"}</a>}
                  {v.payTo.bank && (
                    <div className="rounded-xl bg-black/[.04] p-3">
                      <p className="font-semibold">{en ? "Bank transfer" : "Bank transfer"}</p>
                      <p>{v.payTo.bank.name}</p>
                      <p className="select-all font-mono">A/c {v.payTo.bank.accountNo}</p>
                      <p className="select-all font-mono">IFSC {v.payTo.bank.ifsc}</p>
                      {v.payTo.bank.bankName && <p className="text-muted">{v.payTo.bank.bankName}</p>}
                    </div>
                  )}
                  <p className="text-xs text-muted">{en ? "Write" : "Payment की remark में लिखें:"} <b className="font-mono">{v.target}</b>{en ? " in the payment remark." : ""}</p>
                </div>
              ) : <p className="mt-3 rounded-xl bg-amber-soft p-3 text-sm text-amber">{en ? "The company has not added bank or UPI details yet. Ask your sponsor or support, pay, then send the proof here." : "कंपनी ने अभी bank / UPI की जानकारी नहीं डाली। अपने sponsor या support से पूछें, पैसे भरें, फिर यहाँ सबूत भेजें।"}</p>}

              <form onSubmit={send} className="mt-4 space-y-3 border-t border-border pt-4">
                <label className="block text-sm font-semibold">{en ? "For which ID" : "किस ID के लिए"}
                  <input value={forCode} onChange={(e) => setForCode(e.target.value)} placeholder={v.target} autoCapitalize="characters" className={`${field} font-mono`} />
                  <span className="mt-1 block text-xs font-normal text-muted">{en ? "Leave empty for your own ID. Or type the ID of someone in your team." : "अपनी ID के लिए खाली छोड़ें। या अपनी team के किसी की ID लिखें।"}</span>
                </label>
                <label className="block text-sm font-semibold">{en ? "Paid by" : "कैसे भरा"}
                  <select value={method} onChange={(e) => setMethod(e.target.value)} className={field}>{METHODS.map(([k, e1, h]) => <option key={k} value={k}>{en ? e1 : h}</option>)}</select>
                </label>
                <label className="block text-sm font-semibold">{method === "cash" ? (en ? "Receipt number or name of person paid" : "रसीद का number या जिसे दिया उसका नाम") : (en ? "UTR / transaction number" : "UTR / transaction number")}
                  <input value={reference} onChange={(e) => setReference(e.target.value)} required placeholder="426318975544" className={`${field} font-mono`} />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block text-sm font-semibold">{en ? "Amount paid (₹)" : "भरी रकम (₹)"}
                    <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder={String(v.price.totalPaise / 100)} className={field} />
                  </label>
                  <label className="block text-sm font-semibold">{en ? "Date paid" : "भरने की तारीख"}
                    <input type="date" value={paidOn} max={today()} onChange={(e) => setPaidOn(e.target.value)} required className={field} />
                  </label>
                </div>
                <label className="block text-sm font-semibold">{en ? "Screenshot of the payment" : "Payment का screenshot"}{method === "cash" ? (en ? " (optional)" : " (ज़रूरी नहीं)") : ""}
                  <input ref={fileInput} type="file" accept="image/*,application/pdf" required={method !== "cash"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="mt-1 block w-full text-sm" />
                  <span className="mt-1 block text-xs font-normal text-muted">{en ? "A photo that shows the amount and the UTR." : "ऐसी photo जिसमें रकम और UTR दिखे।"}</span>
                </label>
                <label className="block text-sm font-semibold">{en ? "Note (optional)" : "Note (ज़रूरी नहीं)"}
                  <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={field} />
                </label>
                <button disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-xl grad-brand py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                  {busy && <LoaderCircle className="h-4 w-4 animate-spin" />}{en ? "Send payment details" : "Payment की जानकारी भेजें"}
                </button>
                {msg && <p className={`rounded-xl p-3 text-sm ${msg.ok ? "bg-good/10 text-good" : "bg-danger/10 text-danger"}`}>{msg.text}</p>}
              </form>
            </section>

            <section className={CARD}>
              <h2 className="font-bold">{en ? "My payment proofs" : "मेरे भेजे सबूत"}</h2>
              {v.requests.length === 0 ? <p className="mt-2 text-sm text-muted">{en ? "None sent yet." : "अभी कोई नहीं भेजा।"}</p> : (
                <ul className="mt-2 divide-y divide-border">
                  {v.requests.map((r) => (
                    <li key={r.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                      <div className="min-w-0">
                        <p className="font-semibold">{rupee(r.amountPaise)} · <span className="font-mono">{r.forHandle}</span></p>
                        <p className="text-xs text-muted">{dayOf(r.sentAt)} · {r.method.toUpperCase()} · <span className="font-mono">{r.reference}</span></p>
                        {r.rejectReason && <p className="text-xs text-danger">{r.rejectReason}</p>}
                        {r.invoice && <p className="text-xs text-muted">{en ? "Invoice" : "Invoice"} {r.invoice} <InvoiceLink url={r.invoiceUrl} /></p>}
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${RSTATUS[r.status]?.[2] ?? ""}`}>{RSTATUS[r.status] ? RSTATUS[r.status][en ? 0 : 1] : r.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className={CARD}>
              <h2 className="font-bold">{en ? "Payments so far" : "अब तक के भुगतान"}</h2>
              {v.history.length === 0 ? <p className="mt-2 text-sm text-muted">{en ? "No payments yet." : "अभी कोई भुगतान नहीं।"}</p> : (
                <ul className="mt-2 divide-y divide-border">
                  {v.history.map((h) => (
                    <li key={h.id} className="py-2.5 text-sm">
                      <div className="flex justify-between gap-3">
                        <p className="font-semibold capitalize">{h.kind === "renewal" ? (en ? "Renewal" : "Renewal") : h.kind === "activation" ? (en ? "Activation" : "Activation") : h.kind}</p>
                        <p className="font-bold">{rupee(h.totalPaise)}</p>
                      </div>
                      <p className="text-xs text-muted">{dayOf(h.paidOn)} · {dayOf(h.from)} – {dayOf(h.to)}</p>
                      <p className="text-xs">
                        {h.status !== "paid" ? <span className="font-semibold text-danger">{en ? "Refunded" : "वापस किया गया"}</span>
                          : h.delayDays === null ? null
                          : h.delayDays > 0 ? <span className="font-semibold text-danger">{en ? `${days(h.delayDays)} late` : `${h.delayDays} दिन देर से`}</span>
                          : <span className="text-good">{h.delayDays < 0 ? (en ? `${days(-h.delayDays)} early` : `${-h.delayDays} दिन पहले`) : (en ? "On time" : "समय पर")}</span>}
                        {h.invoice ? <span className="text-muted"> · {en ? "Invoice" : "Invoice"} {h.invoice} <InvoiceLink url={h.invoiceUrl} /></span> : null}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              {v.history.some((h) => h.invoiceUrl) && <p className="mt-2 text-xs text-muted">{en ? "Tap “View invoice” to open the invoice. You can print it or save it as a PDF there." : "“Invoice देखें” दबाकर invoice खोलें। वहाँ से print या PDF save कर सकते हैं।"}</p>}
              <p className={`mt-1 text-xs ${tone}`}>{s.state === "none" ? "" : s.state === "active" ? (en ? "Subscription is active." : "Subscription चालू है।") : ""}</p>
            </section>
          </>
        )}
      </BizState>
    </BizShell>
  );
}
