"use client";
// /pay/<code> — one payment request (owner, 1 Nov 2026): what it is for, the amount, who made it, Pay. The person must be logged in
// as the account the link was made for (a stranger with the link sees the request but cannot pay it onto someone else's account);
// not logged in → the login page and straight back here. Paid → what happened and the way into the app.
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2, LoaderCircle, ShieldCheck } from "lucide-react";
import { api } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { PayRequestButton } from "@/components/poster/pay-request";
import { LogoMark } from "@/components/logo";
import { NO_LOCK_IN } from "@/lib/billing";
import { rupeesOf } from "@/lib/payments";

type Answer = {
  request: { code: string; kind: "plan" | "advance" | "custom"; tier: string | null; months: number; amount_paise: number; title: string; effect: string; note: string; status: "open" | "paid" | "cancelled" | "expired"; paid_at: string | null; created_role: string };
  for: { name: string; username: string }; mine: boolean; loggedIn: boolean; error?: string;
};

export default function PayPage() {
  const { code } = useParams<{ code: string }>();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [a, setA] = useState<Answer | null>(null);
  const [err, setErr] = useState("");
  const [paid, setPaid] = useState<string | null>(null);
  useEffect(() => { (async () => {
    const r = await api<Answer>(`/api/pay/${encodeURIComponent(code)}?lang=${hi ? "hi" : "en"}`);
    if (r.ok) setA(r.data); else setErr(r.data.error || T("This payment link does not exist.", "ये payment link नहीं मिला।"));
  })(); }, [code, hi]); // eslint-disable-line react-hooks/exhaustive-deps
  const next = `/pay/${encodeURIComponent(code)}`;
  const box = "rounded-3xl border border-border bg-surface p-5 shadow-card";
  return (
    <div className="min-h-screen" style={{ background: "var(--bg)" }}>
      <div className="mx-auto w-full max-w-md space-y-4 px-4 py-8">
        <div className="flex items-center gap-2.5"><LogoMark className="h-9 w-7" /><span className="text-[1.15rem] font-extrabold tracking-tight">Shubhora</span></div>
        {err ? <div className={`${box} text-sm text-danger`}>{err}</div> : !a ? <div className="grid place-items-center py-16"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div> : (
          <>
            <section className={`${box} space-y-3`}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted">{a.request.created_role === "self" ? T("Your payment", "आपका payment") : T("Payment request from Shubhora", "Shubhora की ओर से payment request")}</p>
              <h1 className="text-xl font-extrabold leading-tight">{a.request.title}</h1>
              <p className="text-3xl font-extrabold tracking-tight">{rupeesOf(a.request.amount_paise)}</p>
              {a.for.name && <p className="text-sm text-muted">{T("For", "किसके लिए")}: <b className="text-ink">{a.for.name}</b>{a.for.username && <span> · @{a.for.username}</span>}</p>}
              {a.request.note && <p className="rounded-xl bg-surface2 px-3 py-2 text-sm">{a.request.note}</p>}
              <p className="flex items-start gap-2 text-sm text-muted"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-good" /> {a.request.effect}</p>
              {a.request.kind === "plan" && <p className="text-xs text-muted">{hi ? NO_LOCK_IN.hi : NO_LOCK_IN.en}</p>}
            </section>

            {paid || a.request.status === "paid" ? (
              <section className={`${box} space-y-3 text-center`}>
                <CheckCircle2 className="mx-auto h-10 w-10 text-good" />
                <p className="text-lg font-bold">{T("Paid. Thank you!", "Payment हो गया। धन्यवाद!")}</p>
                <p className="text-sm text-muted">{a.request.effect}</p>
                <Link href="/poster/plan" className="inline-block rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white">{T("Open my account →", "मेरा account खोलें →")}</Link>
              </section>
            ) : a.request.status !== "open" ? (
              <section className={`${box} text-sm text-muted`}>{a.request.status === "cancelled" ? T("This payment link was cancelled.", "ये payment link cancel हो गया।") : T("This payment link has expired. Ask Shubhora for a new one.", "ये payment link expire हो गया। Shubhora से नया माँगें।")}</section>
            ) : !a.loggedIn ? (
              <section className={`${box} space-y-3`}>
                <p className="text-sm">{T("Log in to your Shubhora account to pay — the plan or advance goes onto that account.", "Pay करने के लिए अपने Shubhora account में login करें — plan या advance उसी account पर लगेगा।")}</p>
                <Link href={`/login?next=${encodeURIComponent(next)}`} className="block rounded-xl grad-brand px-4 py-3 text-center text-base font-semibold text-white">{T("Log in and pay", "Login करके pay करें")}</Link>
                <Link href={`/signup?next=${encodeURIComponent(next)}`} className="block text-center text-sm font-semibold text-brand-ink">{T("New to Shubhora? Create your account", "Shubhora पर नए हैं? Account बनाएँ")}</Link>
              </section>
            ) : !a.mine ? (
              <section className={`${box} text-sm`}>
                <p className="font-semibold text-danger">{T("This link was made for another account.", "ये link किसी और account के लिए बना है।")}</p>
                <p className="mt-1 text-muted">{T("Log in with that account to pay, or ask Shubhora for a link in your name.", "उसी account से login करके pay करें, या Shubhora से अपने नाम का link माँगें।")}</p>
              </section>
            ) : (
              <section className={`${box} space-y-3`}>
                <PayRequestButton code={a.request.code} amountPaise={a.request.amount_paise} hi={hi} onPaid={(applied) => setPaid(applied)} />
                <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted"><ShieldCheck className="h-3.5 w-3.5" /> {T("Secure payment by Razorpay · UPI, cards, net banking", "Razorpay से सुरक्षित payment · UPI, card, net banking")}</p>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
