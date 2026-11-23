// The printable gold scheme passbook and girvi receipt: the shop's copy (staff pages) and the customer's (/js, /jg links).
import { inr, grams, type JwSetup } from "@/lib/jewellery";
import type { GirviRow, GirviState, SchemeRow, SchemeState } from "@/lib/jewellery-finance";

const day = (d: string) => new Date(d.length === 10 ? `${d}T00:00:00` : d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const MODE: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank: "Bank", cheque: "Cheque", other: "Other" };

function Head({ setup, shop, title, code, sub }: { setup: JwSetup; shop: string; title: string; code: string; sub: string }) {
  return (
    <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-3">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight">{setup.shopName || shop}</h1>
        {setup.address && <p className="whitespace-pre-line">{setup.address}</p>}
        <p>{[setup.phone && `Ph: ${setup.phone}`, setup.gstin && `GSTIN: ${setup.gstin}`].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="shrink-0 text-right"><p className="text-base font-bold uppercase">{title}</p><p><b>{code}</b></p><p>{sub}</p></div>
    </header>
  );
}

export function SchemePassbook({ s, st, setup, shop }: { s: SchemeRow; st: SchemeState; setup: JwSetup; shop: string }) {
  return (
    <article className="jw-doc mx-auto max-w-[800px] space-y-3 bg-white p-6 text-[12px] text-black">
      <Head setup={setup} shop={shop} title="Gold Scheme Passbook" code={s.code} sub={`From ${day(s.start_day)}`} />
      <div className="grid grid-cols-2 gap-2">
        <div><p className="text-[10px] uppercase text-neutral-500">Member</p><p className="font-semibold">{s.customer_name}</p><p>{s.customer_phone}</p>{s.nominee && <p>Nominee: {s.nominee}</p>}</div>
        <div className="text-right"><p className="text-[10px] uppercase text-neutral-500">Plan</p><p className="font-semibold">{s.plan.name}</p><p>{inr(s.plan.monthlyPaise)} × {s.plan.months} months</p><p>Maturity: {day(st.maturity)}</p></div>
      </div>
      <table className="w-full border-collapse"><thead><tr className="border-y border-black text-left"><th className="py-1">#</th><th>Date</th><th>Mode</th><th className="text-right">Amount</th></tr></thead>
        <tbody>{(s.payments ?? []).map((p, i) => <tr key={i} className="border-b border-neutral-200"><td className="py-1">{i + 1}</td><td>{day(p.at)}</td><td>{MODE[p.mode] ?? p.mode}</td><td className="text-right">{inr(p.paise, true)}</td></tr>)}</tbody></table>
      <div className="ml-auto w-64 space-y-0.5">
        <p className="flex justify-between"><span>Deposited</span><b>{inr(st.paid, true)}</b></p>
        <p className="flex justify-between"><span>Instalments</span><span>{st.installments} / {s.plan.months}</span></p>
        {s.plan.bonusPaise > 0 && <p className="flex justify-between"><span>Shop bonus at maturity*</span><span>{inr(s.plan.bonusPaise)}</span></p>}
        {st.nextDue && <p className="flex justify-between"><span>Next instalment</span><span>{day(st.nextDue)}</span></p>}
        <p className="flex justify-between font-semibold"><span>Status</span><span>{s.status === "redeemed" ? "Used on a bill" : s.status === "closed" ? "Closed" : st.complete ? "Complete" : st.behind ? `${st.behind} behind` : "Running"}</span></p>
      </div>
      <p className="text-[10px] text-neutral-600">The deposits are taken off a jewellery purchase from this shop. *The bonus is the shop&apos;s discount on that bill, given only when every instalment is paid and the plan has run its months. No interest or cash return is promised.</p>
      <p className="text-center text-[10px] text-neutral-500">Made with Shubhora · shubhora.com</p>
    </article>
  );
}

export function GirviReceipt({ g, st, setup, shop, licence }: { g: GirviRow; st: GirviState; setup: JwSetup; shop: string; licence: string }) {
  return (
    <article className="jw-doc mx-auto max-w-[800px] space-y-3 bg-white p-6 text-[12px] text-black">
      <Head setup={setup} shop={shop} title="Girvi Receipt" code={g.code} sub={day(g.start_day)} />
      {licence && <p>Money-lender licence: <b>{licence}</b></p>}
      <div className="grid grid-cols-2 gap-2">
        <div><p className="text-[10px] uppercase text-neutral-500">Borrower</p><p className="font-semibold">{g.customer_name}</p><p>{g.customer_phone}</p>{g.customer_address && <p>{g.customer_address}</p>}{g.id_proof && <p>ID: {g.id_proof}</p>}</div>
        <div className="text-right"><p>Loan: <b>{inr(g.loan_paise)}</b></p><p>Interest: {(g.rate_bp / 100).toFixed(2)}% a month (simple, by the day{g.min_days ? `, at least ${g.min_days} days` : ""})</p><p>Due: <b>{day(g.due_day)}</b></p><p>Valuation: {inr(g.valuation_paise)}</p></div>
      </div>
      <table className="w-full border-collapse"><thead><tr className="border-y border-black text-left"><th className="py-1">#</th><th>Item</th><th>Pcs</th><th className="text-right">Gross</th><th className="text-right">Net</th><th className="text-right">Touch</th><th className="text-right">Fine</th></tr></thead>
        <tbody>{g.items.map((it, i) => <tr key={i} className="border-b border-neutral-200"><td className="py-1">{i + 1}</td><td>{it.desc} ({it.metal})</td><td>{it.pieces}</td><td className="text-right">{grams(it.grossMg)}</td><td className="text-right">{grams(it.netMg)}</td><td className="text-right">{(it.touchBp / 100).toFixed(2)}%</td><td className="text-right">{grams(it.fineMg)}</td></tr>)}</tbody></table>
      {(g.payments ?? []).length > 0 && (
        <table className="w-full border-collapse"><thead><tr className="border-y border-black text-left"><th className="py-1">Paid on</th><th>Mode</th><th className="text-right">Amount</th><th className="text-right">Interest</th><th className="text-right">Principal</th></tr></thead>
          <tbody>{g.payments.map((p, i) => <tr key={i} className="border-b border-neutral-200"><td className="py-1">{day(p.at)}</td><td>{MODE[p.mode] ?? p.mode}</td><td className="text-right">{inr(p.paise, true)}</td><td className="text-right">{inr(p.interest, true)}</td><td className="text-right">{inr(p.principal, true)}</td></tr>)}</tbody></table>
      )}
      <div className="ml-auto w-64 space-y-0.5">
        {g.status === "open" ? <>
          <p className="flex justify-between"><span>Principal left</span><b>{inr(st.principal, true)}</b></p>
          <p className="flex justify-between"><span>Interest till today</span><span>{inr(st.interest, true)}</span></p>
          <p className="flex justify-between border-t border-black pt-0.5 font-bold"><span>To release today</span><span>{inr(st.due, true)}</span></p>
        </> : <p className="flex justify-between font-semibold"><span>Status</span><span>{g.status === "closed" ? "Released" : "Auctioned"}</span></p>}
      </div>
      {g.close_note && <p>{g.close_note}</p>}
      <p className="text-[10px] text-neutral-600">The pieces above are kept in safe custody and returned on payment of the principal and interest. Bring this receipt and ID to release them. Interest is simple, by the day, at the rate above.</p>
      <div className="flex justify-between pt-6 text-[11px]"><span>Borrower&apos;s signature</span><span>For {setup.shopName || shop}</span></div>
      <p className="text-center text-[10px] text-neutral-500">Made with Shubhora · shubhora.com</p>
    </article>
  );
}
