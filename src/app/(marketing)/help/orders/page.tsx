// The Orders · Silai guide (owner, 30 Oct 2026: "aisa link bana ke do jo hum user ko send kar sakein") — a public page
// the owner can send to shop owners and their staff: who does what, the one-time setup, staff joining, booking an
// order, how work moves step to step, the job card, rights and common questions. Hinglish, as the owner writes.
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight } from "lucide-react";
import { pageMeta } from "@/lib/site-brand";

export const metadata: Metadata = pageMeta("/help/orders", {
  title: "Orders · Silai — poora workflow, step by step | Shubhora",
  description: "Silai, boutique aur saree shop ke liye: order book karna, naap, karigar, staff login, har step par apne-aap message, aur Ready hote hi customer ko WhatsApp.",
});

const FLOW = [
  { name: "Order book", note: "Counter book kare, customer ko slip" },
  { name: "Cutting", note: "Cutting master ko message" },
  { name: "Stitching", note: "Tailor ko message" },
  { name: "Finishing", note: "Finishing wale ko message" },
  { name: "Ready", note: "Customer ko WhatsApp", accent: true },
  { name: "Delivered", note: "Baaki paise lekar saman diya", good: true },
];

const ROLES: [string, string, string][] = [
  ["Owner (dukaan malik)", "Apna Shubhora login", "Setup, staff, rights, sab orders, paise — sab kuch"],
  ["Admin", "Staff login", "Owner jaisa (jitne rights diye)"],
  ["Counter / booking", "Staff login", "Order book, naap, paise lena, kaam dena"],
  ["Naap wale master", "Staff login", "Order book aur naap lena"],
  ["Cutting master / Tailor / Finishing", "Staff login", "Apna kaam dekhna, “हो गया” dabana"],
  ["Karigar (fall-pico, embroidery)", "Login nahi", "Kaam ka message WhatsApp par"],
  ["Customer", "Login nahi", "Order slip aur “Ready” ka WhatsApp"],
];

const RIGHTS: [string, boolean[]][] = [
  ["Order book karna", [true, true, true, false, false]],
  ["Naap lena / badalna", [true, true, true, true, false]],
  ["Saare order dekhna", [true, true, false, false, false]],
  ["Charge dekhna, paise lena", [true, true, false, false, false]],
  ["Order badalna", [true, true, false, false, false]],
  ["Staff / karigar ko kaam dena", [true, true, false, false, false]],
  ["Order cancel", [true, false, false, false, false]],
  ["Item, naap, flow badalna", [true, false, false, false, false]],
  ["Staff jodna, rights dena", [true, false, false, false, false]],
];

const JOBCARD: [string, string, string][] = [
  ["Naap badalna", "Naap → नाप बदलें", "Naya version save; purana “पुराने नाप” mein rehta hai"],
  ["Naya naap", "Naap → + नया", "Item chunkar naap bharein"],
  ["Purana naap lagana", "पुराने नाप → इस job में लगाएँ", "Wo naap is job ka ho jata hai"],
  ["Order badalna", "Order बदलें", "Naam, mobile, item, kaam, pieces, charge, tareekh, detail"],
  ["Paise lena", "पैसे मिले", "Rakam + note (cash / UPI); baaki apne aap ghatta hai"],
  ["Kapda karigar ko dena / wapas", "कपड़ा दिया / वापस लिया", "Pieces aur meter ka hisaab karigar page par"],
  ["Kaam kisi aur ko dena", "किसके पास है", "Naye aadmi ko message jata hai"],
  ["Slip dobara", "Slip भेजें", "Customer ko order slip WhatsApp"],
  ["Cancel", "Job रद्द करें", "Sirf “cancel” right wale"],
];

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="space-y-3">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-bold text-brand-ink">{i + 1}</span>
          <div className="min-w-0 flex-1 pt-0.5 text-[15px] leading-relaxed">{it}</div>
        </li>
      ))}
    </ol>
  );
}
const Sec = ({ id, n, title, lead, children }: { id: string; n: number; title: string; lead: string; children: React.ReactNode }) => (
  <section id={id} className="scroll-mt-24 space-y-4 rounded-3xl border border-border bg-surface p-5 shadow-card sm:p-8">
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-brand-ink">Step {n}</p>
      <h2 className="mt-1 text-xl font-bold sm:text-2xl">{title}</h2>
      <p className="mt-1.5 text-sm text-muted">{lead}</p>
    </div>
    {children}
  </section>
);
const B = ({ children }: { children: React.ReactNode }) => <b className="font-semibold text-ink">{children}</b>;

export default function OrdersGuidePage() {
  const toc = [["roles", "Kaun kya karta hai"], ["setup", "Owner ka setup"], ["staff", "Staff kaise jude"], ["book", "Order book karna"], ["flow", "Kaam aage kaise badhe"], ["jobcard", "Job card"], ["rights", "Rights aur sawal"]];
  return (
    <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:py-14">
      <header className="space-y-3 text-center">
        <p className="text-4xl">🧵</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl">Orders · Silai — poora workflow</h1>
        <p className="mx-auto max-w-xl text-[15px] text-muted">Order counter par book hota hai, har step wale tak apne aap pahunchta hai, aur Ready hote hi customer ko WhatsApp jaata hai. Owner ek baar setup karta hai — roz ka kaam bas <B>“order book karo”</B> aur <B>“मेरा काम हो गया”</B>.</p>
        <nav className="flex flex-wrap justify-center gap-1.5 pt-2">
          {toc.map(([id, l]) => <a key={id} href={`#${id}`} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:border-brand">{l}</a>)}
        </nav>
      </header>

      {/* The flow at a glance */}
      <div className="rounded-3xl border border-border bg-surface p-5 shadow-card">
        <p className="mb-3 text-sm font-bold">Ek order ka safar</p>
        <ol className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          {FLOW.map((f, i) => (
            <li key={f.name} className={`relative rounded-2xl border p-3 text-center ${f.accent ? "border-brand bg-brand-soft" : f.good ? "border-emerald-500 bg-emerald-50" : "border-border bg-bg"}`}>
              <p className="text-[11px] font-bold text-muted">{i + 1}</p>
              <p className="text-sm font-bold">{f.name}</p>
              <p className="mt-1 text-[11px] leading-snug text-muted">{f.note}</p>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-muted">Yeh sirf misaal hai — dukaan apne step khud banati hai (jaise Hand work, Press, With karigar).</p>
      </div>

      <Sec id="roles" n={1} title="Kaun kya karta hai" lead="Har aadmi apne mobile se login karta hai aur utna hi dekhta hai jitna owner de. Karigar aur customer ko login ki zarurat nahi.">
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-xs text-muted"><tr><th className="px-3 py-2">Kaun</th><th className="px-3 py-2">Login</th><th className="px-3 py-2">Kya karta hai</th></tr></thead>
            <tbody>{ROLES.map(([a, b, c]) => <tr key={a} className="border-t border-border"><td className="px-3 py-2 font-semibold">{a}</td><td className="px-3 py-2 text-muted">{b}</td><td className="px-3 py-2">{c}</td></tr>)}</tbody>
          </table>
        </div>
        <p className="text-sm text-muted">App kahan milega: More → <B>Advanced features</B> → <B>Orders · Silai</B>, ya seedha <B>shubhora.com/poster/orders</B>.</p>
      </Sec>

      <Sec id="setup" n={2} title="Owner ka pehla setup (ek baar, ~15 minute)" lead="Yeh sirf ek baar hota hai; iske baad naye order apne aap sahi logon tak jaate hain.">
        <Steps items={[
          <>Orders kholein — More → Advanced features → <B>Orders · Silai</B>. (Advanced feature Shubhora team aapke account par chalu karti hai.)</>,
          <><B>Setup · Flow → Flow (steps)</B> — apne kaam ke step banayein: Received → Cutting → Stitching → With karigar → Finishing → Ready → Delivered. Naam badlein, upar-neeche karein, hatayein ya naya jodein. <B>“अपने-आप शुरू”</B> tick rakhein.</>,
          <><B>Setup · Flow → Items</B> — har item kholkar: <B>aam kaam</B> (Blouse → Stitching, Saree → Fall-pico), <B>iske step</B> (Saree sirf “With karigar”), aur <B>naap</B> (Length, Bust, Waist… jodein ya hatayein).</>,
          <><B>Kaam · unit</B> — kaam ki list (Fall-pico, Embroidery…) aur naap inch ya cm. Phir neeche <B>“Setup सेव करें”</B>.</>,
          <><B>Karigar jodein</B> (jo app nahi chalate) — Orders → Karigar → naam, mobile, kaam.</>,
          <><B>Staff jodein</B> — Orders → Staff · login → <B>जोड़ें</B> → naam, mobile, role (Admin, Counter, Naap master, Cutting master, Stitching tailor, Finishing) → <B>“WhatsApp पर invite”</B>.</>,
          <><B>Har step par aadmi lagayein</B> — Setup · Flow mein step ke neeche <B>“किसका काम”</B> se staff ya karigar chunein (jaise Cutting → Ramesh). Jis step par koi tay nahi, wahan koi bhi staff kaam utha sakta hai.</>,
          <>Ek <B>test order</B> book karke dekhein ki step wale ke phone par message aaya.</>,
        ]} />
        <p className="rounded-2xl bg-amber-50 px-4 py-3 text-xs text-amber-900">WhatsApp message tabhi jaate hain jab dukaan ka WhatsApp Shubhora se juda ho. App ka notification har haal mein jaata hai.</p>
      </Sec>

      <Sec id="staff" n={3} title="Staff kaise jude (pehli baar, 2 minute)" lead="Kuch download nahi karna — owner ka bheja WhatsApp link hi login hai.">
        <Steps items={[
          <>WhatsApp par aaya <B>invite link</B> kholein.</>,
          <>Pehli baar hain to <B>“पहली बार? अपना login बनाएँ”</B> — apne mobile aur password se account banayein. Pehle se login hai to <B>“मेरा Shubhora login पहले से है”</B>.</>,
          <>Login hote hi <B>“आप जुड़ गए!”</B> aur dukaan ka Orders khul jata hai. Upar <B>“मेरा काम”</B> mein diya hua kaam dikhta hai.</>,
          <>Phone par notification <B>Allow</B> karein, taaki naya kaam aate hi pata chale.</>,
          <>Agli baar <B>shubhora.com/poster/orders</B> kholein — ya browser menu se “Add to Home screen” karke app jaisa icon bana lein.</>,
        ]} />
      </Sec>

      <Sec id="book" n={4} title="Roz ka kaam — order book karna" lead="Ek order 1–2 minute mein; har hissa “छोटा करें” se band karke aage badh sakte hain.">
        <Steps items={[
          <>Orders → <B>“+ नया order”</B>.</>,
          <><B>Customer</B> — naam aur mobile. Purana customer ho to naam aur saved naap apne aap aa jaate hain.</>,
          <><B>Item</B> chunein — uska aam kaam apne aap chun jata hai aur <B>naap khul jata hai</B>: “पिछला नाप वही” / “पिछला बदलकर” / “नया नाप” / “ऊपर वाले जैसा” / “बाद में”. Kisi aur ka naap ho to “किसका नाप?” mein naam.</>,
          <>Detail (rang, design, lining), <B>Charge ₹</B>, <B>Pieces</B>. Usi customer ka aur saman ho to <B>“+ एक और item”</B>.</>,
          <><B>Delivery और पैसे</B> — tareekh (2 / 3 / 5 / 7 / 10 / 15 din) aur advance; kul, advance, baaki khud dikhta hai.</>,
          <><B>“देखें और order बुक करें”</B> — review mein sab ek baar dikhta hai: <B>बदलें</B> · <B>रद्द करें</B> · <B>पक्का करें</B>.</>,
          <>Job number (#101…) aata hai, kis-kis ko message gaya dikhta hai, aur <B>“ग्राहक को slip WhatsApp करें”</B>.</>,
        ]} />
      </Sec>

      <Sec id="flow" n={5} title="Kaam aage kaise badhta hai" lead="Har step wala apna kaam karke “हो गया” dabata hai; agla aadmi aur customer apne aap khabar paate hain.">
        <Steps items={[
          <>Order book hote hi job <B>pehle step</B> par (jaise Cutting) chali jaati hai.</>,
          <>Us step wale ko <B>app notification + WhatsApp</B> (“🧵 नया काम — Job #101…” aur kholne ka link). Karigar ko sirf WhatsApp.</>,
          <>Staff <B>“मेरा काम”</B> mein job kholkar naap, detail, delivery date dekhta hai.</>,
          <>Kaam khatam → <B>“मेरा काम हो गया — आगे भेजें”</B>. Job agle step par, agle aadmi ko khabar.</>,
          <>Jis step par koi tay nahi, job <B>“🆕 नया काम — लें”</B> mein aati hai; koi bhi staff <B>“यह काम मैं करूँगा”</B> dabakar le leta hai.</>,
          <><B>Ready</B> → customer ko WhatsApp: “आपका … तैयार है, बाकी राशि ₹…”.</>,
          <><B>Delivered</B> → baaki paise “पैसे मिले” mein daalkar “हो गया → Delivered”.</>,
        ]} />
        <p className="text-sm text-muted">Owner list mein “चालू” aur har step ke tab se dekh sakta hai ki kaun-sa kaam kahan atka hai; der wale order laal mein dikhte hain.</p>
      </Sec>

      <Sec id="jobcard" n={6} title="Job card par baad ke kaam" lead="Order ki har cheez badli ja sakti hai, aur har badlaav history mein likha jaata hai.">
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-bg text-xs text-muted"><tr><th className="px-3 py-2">Kaam</th><th className="px-3 py-2">Kahan</th><th className="px-3 py-2">Kya hota hai</th></tr></thead>
            <tbody>{JOBCARD.map(([a, b, c]) => <tr key={a} className="border-t border-border"><td className="px-3 py-2 font-semibold">{a}</td><td className="px-3 py-2 text-brand-ink">{b}</td><td className="px-3 py-2 text-muted">{c}</td></tr>)}</tbody>
          </table>
        </div>
      </Sec>

      <Sec id="rights" n={7} title="Rights aur aam sawal" lead="Har role ke rights pehle se bhare aate hain; Staff page par kisi ke bhi tick badal sakte hain.">
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-center text-sm">
            <thead className="bg-bg text-xs text-muted"><tr><th className="px-3 py-2 text-left">Right</th><th className="px-2 py-2">Admin</th><th className="px-2 py-2">Counter</th><th className="px-2 py-2">Naap master</th><th className="px-2 py-2">Cutting</th><th className="px-2 py-2">Tailor</th></tr></thead>
            <tbody>{RIGHTS.map(([r, v]) => <tr key={r} className="border-t border-border"><td className="px-3 py-2 text-left">{r}</td>{v.map((on, i) => <td key={i} className="px-2 py-2">{on ? <Check className="mx-auto h-4 w-4 text-emerald-600" /> : <span className="text-faint">—</span>}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="text-sm text-muted">Rights ke bina bhi har koi apna diya hua kaam dekh sakta hai aur “हो गया” kar sakta hai. Jise “paise” right nahi, use charge aur baaki nahi dikhta.</p>
        <div className="space-y-2">
          {[
            ["Orders kholne par “advanced feature” likha aata hai", "Aapke account par Orders abhi chalu nahi hai — Shubhora team se baat karein."],
            ["Step wale ko WhatsApp nahi gaya", "Dukaan ka WhatsApp Shubhora se juda nahi. App notification phir bhi jaata hai — staff ne notification Allow kiya ho."],
            ["Staff ko kaam nahi dikh raha", "Staff page par “✓ login किया” hai ya nahi dekhein, aur Setup · Flow mein us step par wahi chuna ho."],
            ["Customer ka mobile nahi hai", "Order ban jayega, bas slip aur Ready ka WhatsApp nahi jayega."],
            ["Ek item ke step alag chahiye", "Setup · Flow → Items → us item ke “इस item के step”."],
            ["Staff ne kaam chhod diya", "Staff page par “Login बंद करें” ya “हटाएँ”; purana kaam history mein rehta hai. Us step par naya aadmi chunein."],
          ].map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-border bg-bg px-4 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-sm font-semibold">{q}<ChevronRight className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-90" /></summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </Sec>

      <div className="rounded-3xl grad-brand p-6 text-center text-white shadow-card">
        <p className="text-lg font-bold">Shuru karein</p>
        <p className="mt-1 text-sm opacity-90">Apni dukaan ke Orders kholein, ya staff ho to owner ka bheja invite link kholein.</p>
        <Link href="/poster/orders" className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-brand-ink">Orders kholein <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>
  );
}
