// The Mobile Shop guide (owner, 23 Nov 2026): a public page a partner can send to a mobile / accessory shop before they buy, and
// the shop's staff read to learn the counter. Hinglish, as the owner writes. Only what is live is described; the rest is "coming".
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/help/mobile", {
  title: "Mobile aur accessory shop software — bill, stock, udhaar, IMEI | Shubhora",
  description: "Mobile aur accessory dukaan ke liye: repair job card, 10 second mein bill (naam, phone model ya barcode se), stock aur kam-stock, udhaar, IMEI se phone ki bikri, bina internet ke bhi bill — website, WhatsApp AI aur CRM ke saath.",
});

const FLOW = [
  { name: "Item khojein", note: "Naam, phone model ya scan" },
  { name: "Ginti / daam", note: "Zaroorat ho to badlein" },
  { name: "Grahak", note: "Naam, mobile (optional)" },
  { name: "Payment", note: "Cash, UPI, card ya udhaar" },
  { name: "Print", note: "Thermal parchi ya A4/A5" },
  { name: "WhatsApp", note: "Bill grahak ke phone par", accent: true },
];

const STEPS: [string, string][] = [
  ["Settings", "Dukaan ka naam, pata, phone, UPI ID aur printer ka paper (58 mm / 80 mm thermal, A5, A4). GST tabhi chalu karein jab GSTIN ho — bina GSTIN ke saada bill banta hai."],
  ["Items", "Jo bechte hain ek baar jodein: naam, category, bechne ka daam, abhi kitne hain. 'Kis phone ka hai' mein model likhein (Redmi 13, Vivo Y28) — phir bill par 'cover redmi 13' likhte hi sahi cover milta hai."],
  ["Naya bill", "Item ka naam likhein ya barcode scan karein — item jud jaata hai. Ginti, daam ya chhoot badal sakte hain. Jo cheez Items mein nahi (jaise fitting charge) use 'Custom line' se jodein."],
  ["Payment aur udhaar", "Cash / UPI / Card — ek tap. Paise baaki hain to 'Kuch / udhaar' chunein, jo mila wo likhein; baaki udhaar mein dikhta hai aur baad mein usi bill se le sakte hain."],
  ["Print aur WhatsApp", "Thermal parchi ya kaagaz par print. 'Save & WhatsApp' se bill ka link grahak ke WhatsApp par (dukaan ka WhatsApp juda ho to apne aap, warna ek button se)."],
  ["Khareed (maal aaya)", "Supplier ka naam, item, kitne aaye, ek ki laagat — stock badh jaata hai aur nayi laagat se munafa nikalta hai."],
  ["Phone bechte hain?", "Model ko 'Phone' mein jodein. Khareed mein har IMEI scan karein. Bill par bas IMEI scan karein — wahi piece bikta hai, IMEI aur warranty bill par chhapti hai, aur ek IMEI do baar nahi bik sakta."],
  ["Repair job card", "Phone repair ke liye aaya: grahak ka mobile, model, kharabi, phone ki haalat (kharonch, SIM andar…), andaaz kharch, advance. Grahak ko parchi aur WhatsApp par link milta hai jahan wo status dekh sakta hai. Lage parts stock se ghatte hain. 'Taiyaar' dabate hi grahak ko WhatsApp; phone dete waqt bill apne aap banta hai, advance ghata hua, repair warranty ke saath."],
  ["Estimate", "Grahak ko daam ka estimate dein; pasand aaye to ek tap mein bill."],
  ["Bina internet", "Network chala jaaye to bhi bill bante rehte hain — phone mein rakhe jaate hain aur network aate hi account mein chadh jaate hain. Bill number tab milta hai; WhatsApp bhejna aur IMEI khojna network aane par."],
  ["Saaman wapsi", "Grahak kuch wapas laaye to bill khol kar 'Return items' — kitne piece likhein. Stock wapas chadh jaata hai, bill par udhaar ho to pehle wo ghatta hai, baaki paisa lautaya jaata hai. Asli bill nahi badalta; wapsi ki alag parchi (credit note) banti hai."],
  ["Report aur Excel", "Aaj / kal / mahina / vitt varsh: bikri (wapsi ghata kar), aaye paise (cash, UPI, card, EMI alag), munafa, GST HSN ke hisaab se, sabse zyada bika item, repair ka kaam. Saar WhatsApp par; bikri register, HSN, item-wise aur stock list Excel (CSV) mein — CA ko dene ke liye."],
  ["Barcode label aur supplier", "Kisi bhi item ka 50×25 mm barcode sticker print karein (barcode na ho to hum bana dete hain). Khareed par supplier ko kitna diya, kitna baaki — supplier-wise dikhta hai."],
  ["EMI / finance", "Bill par 'EMI' chunein aur finance company ka naam likhein — din ke paison mein EMI alag dikhta hai."],
  ["Din ka hisaab", "Home par aaj ki bikri, cash aur UPI alag, munafa (sirf maalik ko), udhaar aur kam stock ki list."],
  ["Staff", "Har staff ka alag login. Kaun bill banaye, kaun stock chadhaye, kaun laagat/munafa dekhe, kitni chhoot de — sab aap tay karte hain. Bill kabhi delete nahi hota, sirf karan likhkar radd."],
];

const COMING = [
  "Stock milaan (poori dukaan scanner se ginna)",
  "Purana phone exchange mein lena (abhi: use Khareed se chadha kar bechein)",
  "GST e-invoice, Tally ki seedhi file",
];

export default function MobileGuide() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:py-14">
      <header className="space-y-3 text-center">
        <p className="text-4xl">📱</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Mobile aur accessory shop — bill, stock, udhaar</h1>
        <p className="mx-auto max-w-xl text-[15px] text-muted">Cover, glass, charger se le kar phone tak: 10 second mein bill, stock apne aap ghatta hai, udhaar yaad rehta hai, aur bill grahak ke WhatsApp par. Saath mein aapki website, WhatsApp AI aur customer list — ek hi login mein.</p>
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
            "Daam mein tax shaamil hota hai (MRP jaisa): ₹299 ka bill grahak ke liye ₹299 hi rehta hai",
            "GST chalu ho to tax daam ke andar se nikal kar bill par dikhta hai (CGST/SGST, HSN ke saath)",
            "Chhoot line par ya poore bill par; staff apni seema tak hi de sakta hai",
            "Munafa = bikri (tax ke bina) − maal ki laagat; sirf maalik ya jise haq ho use dikhta hai",
            "Bill radd karne par stock wapas aa jaata hai",
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
