"use client";
// /poster/site/order — after the payment (owner, 13 Nov 2026 — lib/site-order.ts): "Thank you for your payment. Our team is working on
// your website. We will deliver it within 24–48 hours." The page stays the same every time it is opened until the website is live; it
// never offers "Make my website" or the payment again. Behind it the website is made once, by the server, in the plan that was paid:
// this page only asks the server to start (a build already running or finished is left alone).
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, MessageCircle } from "lucide-react";
import { SiteProgress } from "@/components/poster/website-plan";
import { api, isLoggedIn } from "@/lib/poster-client";
import { useT } from "@/lib/poster-i18n";
import { rupees } from "@/lib/billing";
import { readyText } from "@/lib/site-ready";
import type { OrderState } from "@/lib/site-order";

export default function SiteOrderPage() {
  const router = useRouter();
  const { lang } = useT(); const hi = lang !== "en";
  const T = (en: string, h: string) => (hi ? h : en);
  const [o, setO] = useState<OrderState | null>(null);
  const started = useRef(false);
  useEffect(() => {
    let stop = false; let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      if (!(await isLoggedIn())) { router.replace("/login?next=/poster/site/order"); return; }
      let r = await api<OrderState>("/api/site/order").catch(() => null);
      if (stop) return;
      // Paid and not made yet: the server is asked to make it — once from this page; a failed build is tried again on a later visit.
      if (r?.ok && r.data.stage === "queued" && !started.current) {
        started.current = true;
        r = await api<OrderState>("/api/site/order", { method: "POST", json: { op: "start" } }).catch(() => r);
        if (stop) return;
      }
      if (r?.ok) {
        const st = r.data;
        if (st.stage === "none" || st.stage === "pay") { router.replace("/poster/site/plans"); return; }
        setO(st);
        try { sessionStorage.setItem("shubhora.order-seen", "1"); } catch { /* */ }
        if (st.stage === "queued" || st.stage === "building") timer = setTimeout(load, 15_000);
      } else timer = setTimeout(load, 15_000);
    };
    void load();
    return () => { stop = true; if (timer) clearTimeout(timer); };
  }, [router]);
  if (!o) return <div className="grid place-items-center py-24"><LoaderCircle className="h-6 w-6 animate-spin text-muted" /></div>;
  const live = o.stage === "live";
  const when = o.readyAt ? readyText(new Date(o.readyAt), hi) : "";
  const paidOn = o.receipt ? new Date(o.receipt.paidAt).toLocaleDateString(hi ? "hi-IN" : "en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "";
  const planName = o.receipt?.label ?? (o.pkg === "site_premium" ? "Website Premium" : o.pkg === "site_standard" ? "Website Standard" : o.pkg === "custom" ? "Custom Solutions" : "");
  return (
    <div className="mx-auto w-full max-w-md space-y-4 px-4 pb-10 pt-5">
      <section className="relative overflow-hidden rounded-3xl grad-brand p-6 text-center text-white shadow-float">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/20"><CheckCircle2 className="h-9 w-9" /></span>
        <h1 className="mt-3 text-2xl font-extrabold">{live ? T("Your website is live", "आपकी website live है") : T("Thank you for your payment", "Payment के लिए धन्यवाद")}</h1>
        <p className="mt-1 text-sm text-white/90">{live
          ? T("Thank you. Open it, share it, and change anything you like.", "धन्यवाद। खोलें, share करें, और जो चाहें बदलें।")
          : T("Our team is working on your website. We will deliver it within 24–48 hours.", "हमारी team आपकी website पर काम कर रही है। 24–48 घंटे में आपको मिल जाएगी।")}</p>
      </section>
      <section className="rounded-3xl border border-border bg-surface shadow-card">
        <dl className="divide-y divide-border text-sm">
          {planName && <div className="flex justify-between px-4 py-2.5"><dt className="text-muted">{T("Plan", "Plan")}</dt><dd className="font-semibold">{planName}</dd></div>}
          {o.receipt && <div className="flex justify-between px-4 py-2.5"><dt className="text-muted">{T("Paid", "Paid")}</dt><dd className="font-semibold">{rupees(o.receipt.amount)}</dd></div>}
          {o.receipt && <div className="flex justify-between gap-3 px-4 py-2.5"><dt className="text-muted">{T("Payment ID", "Payment ID")}</dt><dd className="truncate text-xs font-semibold tabular-nums">{o.receipt.paymentId}</dd></div>}
          {paidOn && <div className="flex justify-between px-4 py-2.5"><dt className="text-muted">{T("Date", "तारीख")}</dt><dd className="font-semibold">{paidOn}</dd></div>}
        </dl>
      </section>
      {!live && (
        <section className="rounded-3xl border border-border bg-surface p-4 shadow-card">
          <p className="mb-3 text-sm font-bold">{T("What happens now", "अब आगे क्या होगा")}</p>
          <SiteProgress hi={hi} stage={1} when={when || undefined} />
          <p className="mt-3 flex items-start gap-1.5 text-xs text-muted"><MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {T("You do not have to do anything. We will WhatsApp you the moment your website is live.", "आपको कुछ नहीं करना है। Website live होते ही WhatsApp पर बता देंगे।")}</p>
        </section>
      )}
      {live
        ? <Link href="/poster/site" className="inline-flex w-full items-center justify-center rounded-2xl grad-brand py-3.5 text-base font-semibold text-white">{T("Open my website", "मेरी website खोलें")}</Link>
        : <Link href="/poster" className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-surface py-3.5 text-sm font-semibold">{T("Go to the app", "App खोलें")}</Link>}
    </div>
  );
}
