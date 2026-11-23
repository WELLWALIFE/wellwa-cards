// The Jewellery guide (owner, 23 Nov 2026): a public page a partner can send to a jeweller before they buy, and the shop's staff
// read to learn the counter. Hinglish, as the owner writes. Matches what is live (phase 1); the later phases are listed as coming.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/help/jewellery", {
  title: "Jewellery shop software — rate, GST bill, purana sona | Shubhora",
  description: "Jewellers ke liye: aaj ka rate ek baar, vazan se GST bill aur estimate, purane sone ka exchange touch se, payment aur udhaar, bill customer ke WhatsApp par — website, WhatsApp AI aur CRM ke saath.",
});

const FLOW = [
  { name: "Aaj ka rate", note: "Subah ek baar 24K aur chandi" },
  { name: "Item chunein", note: "Anguthi, chain, haar…" },
  { name: "Vazan daalein", note: "Gross, nag — net apne aap" },
  { name: "Purana sona", note: "Touch % se, usi bill mein" },
  { name: "Payment", note: "Cash, UPI, card — ya udhaar" },
  { name: "WhatsApp", note: "Bill customer ke phone par", accent: true },
];

const STEPS: [string, string][] = [
  ["Settings", "Dukaan ka naam, pata, GSTIN, BIS, bank/UPI aur shartein. Kaunsi purity bechte hain (22K, 18K, silver 925…), har item ki making (₹/g, % ya ₹/piece) aur wastage."],
  ["Aaj ka rate", "24K aur chandi ka rate 10 gram ka daalein — 22K, 18K apne aap ban jaate hain (badal bhi sakte hain). WhatsApp par rate share karne ka button bhi."],
  ["Naya bill", "Item chunein → purity → gross aur nag ka vazan. Net vazan, rate, making, wastage, nag ka daam, 3% GST (CGST/SGST ya IGST) sab turant. HUID bill par chhapta hai."],
  ["Purana sona", "Gross, kam (nag/mail), touch % — shuddh vazan aur daam apne aap; bill mein se ghat jaata hai. Rate: aaj ke 24K se aapka set kiya % kam, ya alag khareed rate."],
  ["Payment aur udhaar", "Kai tareeke ek saath (cash + UPI + card). Baaki rehta hai to udhaar, tareekh ke saath; baad mein payment lene par balance apne aap kam."],
  ["Estimate", "Customer ko daam ka estimate — WhatsApp par link. Pasand aaye to ek tap mein bill."],
  ["Order aur repair", "Naya order: design, andaaz vazan, advance, chahein to aaj ka rate lock, karigar. Ready par customer ko WhatsApp; dene par bill order se bhara hua khulta hai, advance ghata hua. Repair: aate waqt vazan likha jaata hai, charge le kar wapas."],
  ["Karigar ka khata", "Sona diya (gross × touch = fine), maal wapas aaya, wastage maaf, mazdoori aur diye paise — har karigar ke paas kitna fine sona hai, ek nazar mein. Galat entry delete nahi, 'void' hoti hai."],
  ["Stock aur tag", "Har piece chadhaate hi tag number (jaise RI00017) — barcode label print karein (95×12 mm jewellery tag ya 50×25 mm sticker). Bill mein tag scan karein: vazan, purity, HUID apne aap; bikte hi piece 'sold', bill radd ho to wapas stock mein. Pasand ke liye bahar diya, galaya, supplier ko wapas — sab note ke saath."],
  ["Report aur day close", "Aaj / kal / mahina / vitt varsh: bikri, GST (CGST/SGST/IGST, HSN, B2B), aaye paise mode ke hisaab se (order ke advance bhi), purana sona, purity ka vazan. Day close WhatsApp par; Excel (CSV) mein bikri register, HSN, B2B — CA ko dene ke liye."],
  ["Gold scheme (switch se)", "Owner Settings mein kanooni note padh kar chalu kare. Plan: har mahine ₹X, N mahine, dukaan ka bonus (aakhri bill par chhoot). Member, kisht, WhatsApp passbook; poora hone par 'bill mein lagayein' — jama advance, bonus chhoot. Koi byaaj/return ka vaada nahi."],
  ["Girvi (switch se)", "Sirf saahukari license number daal kar chalu. Saman ka vazan, touch → fine, keemat (aaj ke khareed rate se), loan (keemat ka tay % tak). Byaaj roz ke hisaab se, kam se kam din; payment pehle byaaj phir mool. Yaad dilana, tareekh ke baad notice, 14 din baad hi neelami darj."],
  ["Bill bhejna / print", "Save karte hi customer ke WhatsApp par bill ka link (dukaan ke number se). A4/A5 print ya PDF. Bill kabhi delete nahi hota — sirf karan likhkar rad."],
];

const COMING = [
  "Stock milaan (scanner se poora showcase ginna), supplier se khareed aur unka khata",
  "Website par aaj ke rate se live daam wala catalogue",
];

export default function JewelleryGuide() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:py-14">
      <header className="space-y-3 text-center">
        <p className="text-4xl">💍</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Jewellery shop — rate, bill, purana sona</h1>
        <p className="mx-auto max-w-xl text-[15px] text-muted">Subah ek baar rate, phir har bill 30 second mein: vazan daalo, sab hisaab apne aap, aur bill seedha customer ke WhatsApp par. Saath mein aapki website, WhatsApp AI aur customer list — ek hi login mein.</p>
      </header>

      <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
        <p className="mb-3 text-sm font-bold">Ek bill ka safar</p>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          {FLOW.map((f, i) => (
            <li key={f.name} className={`rounded-2xl border p-3 text-center ${f.accent ? "border-brand bg-brand-soft" : "border-border bg-bg"}`}>
              <p className="text-[11px] font-bold text-muted">{i + 1}</p>
              <p className="text-sm font-bold">{f.name}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted">{f.note}</p>
            </li>
          ))}
        </ol>
      </div>

      <section className="space-y-4 rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-8">
        <h2 className="text-xl font-bold">Kaise chalta hai</h2>
        <ol className="space-y-3">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="flex gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink">{i + 1}</span>
              <div className="min-w-0 flex-1 pt-0.5 text-[15px] leading-relaxed"><b className="font-semibold text-ink">{t}:</b> {d}</div>
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-3 rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-8">
        <h2 className="text-xl font-bold">Hisaab kaise banta hai</h2>
        <ul className="space-y-1.5 text-[15px]">
          {[
            "Net vazan = gross − nag ka vazan",
            "Sone ka daam = rate × net vazan; wastage (VA) = uska %",
            "Making = ₹ prati gram, ya % , ya ₹ prati piece — jaisa item ke liye set ho",
            "GST: dhatu, nag aur wastage par 3%; making par jo aapke CA bataayein (setting). Doosre state ka customer → IGST",
            "Chhoot sirf making par ya poore bill par; counter apni seema tak hi de sakta hai",
            "Purana sona: (gross − kam) × touch % = shuddh vazan × khareed rate",
          ].map((x) => <li key={x} className="flex gap-2"><Check className="mt-1 h-4 w-4 shrink-0 text-good" /> {x}</li>)}
        </ul>
      </section>

      <section className="space-y-3 rounded-3xl border border-dashed border-border bg-surface p-5 sm:p-8">
        <h2 className="text-xl font-bold">Jald aa raha hai</h2>
        <ul className="space-y-1.5 text-[15px] text-muted">{COMING.map((x) => <li key={x}>• {x}</li>)}</ul>
      </section>

      <div className="text-center">
        <Link href="/contact" className="inline-flex items-center gap-2 rounded-xl grad-brand px-5 py-3 text-sm font-semibold text-white">Apni dukaan ke liye demo <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
