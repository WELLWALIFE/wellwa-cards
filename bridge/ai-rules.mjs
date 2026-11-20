// The owner's own rules for their AI (AI Training → "Jaldi setup" and "Aur settings", owner 20 Nov 2026: "SaaS — koi bhi business, user
// apne hisaab se AI ko guide kar sake, simple way mein; kuch na kare to bhi chale"). Stored on the card as `botRules`; read by BOTH
// assistants — the WhatsApp one (bridge/index.mjs) and the website chat / official WhatsApp API / phone one (src/lib/wa-ai.ts) — so a
// customer gets the same answer everywhere. Every field is optional: nothing set = the assistant's own defaults, unchanged.
//
//   lang:     "hi" (default: Hindi for everyone) | "mirror" (the customer's own language) | "en" | "hinglish" (Hindi in Roman letters)
//   tasks:    { order, booking, callback } — false = the AI does not take that (default all on)
//   price:    "tell" (default: prices from the card) | "call" (no prices — "call / WhatsApp for the price")
//   name:     the assistant's own name ("Priya")
//   ask:      what to find out from a new customer: "name" | "city" | "budget" | "when"; askOwn: one more question in the owner's words
//   alertOn:  extra moments to call the owner: "big" (a big order), "every" (every new enquiry)
//   discount: 0 (default: no discount the card does not state) … 50 = may offer up to that %
//   pay:      the ways a customer can pay: "upi" | "cod" | "shop" | "card"
//   never:    things the AI must never say (owner's words)

const S = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : "");

export function rulesOf(card) {
  const r = card && typeof card.botRules === "object" && card.botRules ? card.botRules : {};
  const list = (v, ok) => (Array.isArray(v) ? v.filter((x) => ok.includes(x)) : []);
  const t = r.tasks && typeof r.tasks === "object" ? r.tasks : {};
  return {
    lang: ["hi", "mirror", "en", "hinglish"].includes(r.lang) ? r.lang : "hi",
    tasks: { order: t.order !== false, booking: t.booking !== false, callback: t.callback !== false },
    price: r.price === "call" ? "call" : "tell",
    name: S(r.name, 30),
    ask: list(r.ask, ["name", "city", "budget", "when"]),
    askOwn: S(r.askOwn, 120),
    alertOn: list(r.alertOn, ["big", "every"]),
    discount: Number.isFinite(Number(r.discount)) ? Math.max(0, Math.min(50, Math.round(Number(r.discount)))) : 0,
    pay: list(r.pay, ["upi", "cod", "shop", "card"]),
    never: S(r.never, 400),
  };
}

/** The reply language the owner chose, or null for the assistant's own rule (Hindi by default). `detected` is the assistant's own
 *  guess of the customer's language ("English", "Hinglish", "Hindi (Devanagari script)", "Gujarati"…); `asked` = a language the
 *  customer asked for in the chat, which always wins. */
export function ownLanguage(card, detected, asked) {
  if (asked) return null;
  const { lang } = rulesOf(card);
  if (lang === "en") return "English";
  if (lang === "hinglish") return "Hinglish — Hindi words written in Roman (English) letters, the way people type on WhatsApp";
  if (lang === "mirror") {
    if (/^English/.test(detected)) return "English";
    if (/^Hinglish/.test(detected)) return "Hinglish — Hindi words written in Roman (English) letters, the way people type on WhatsApp";
    return null;   // Hindi, Gujarati…: the assistant's own rule already answers in that language
  }
  return null;
}

/** Extra lines for the assistant's rules; "" when the owner set nothing. `seller` = the card holder's first name. */
export function rulesBlock(card, seller) {
  const r = rulesOf(card);
  const lines = [];
  if (r.name) lines.push(`- YOUR NAME: you are "${r.name}", ${seller}'s assistant. Say it when you greet a new customer ("Main ${r.name}, ${seller} ji ki assistant").`);
  const off = Object.entries(r.tasks).filter(([, on]) => !on).map(([k]) => ({ order: "orders", booking: "bookings / appointments", callback: "call-back requests" }[k]));
  if (off.length) lines.push(`- DO NOT TAKE ${off.join(" OR ").toUpperCase()} yourself: when the customer wants that, give ${seller}'s contact and say ${seller} will handle it. Do not write an [[ORDER: …]] line for ${off.join(" / ")}.`);
  if (r.price === "call") lines.push(`- PRICES: never tell a price or a price range, even if it is in the facts. Say ${seller} will share the best price, and ask for their requirement / quantity so ${seller} can quote.`);
  const ask = r.ask.map((k) => ({ name: "their name", city: "their city / area", budget: "their budget", when: "when they need it" }[k]));
  if (r.askOwn) ask.push(`"${r.askOwn}"`);
  if (ask.length) lines.push(`- FIND OUT, one question per message and only when it fits naturally (never all at once, never in the very first line): ${ask.join(", ")}.`);
  if (r.discount > 0) lines.push(`- DISCOUNT: if the customer asks for a discount or bargains, you may offer up to ${r.discount}% off — start lower, never more than ${r.discount}%. Never offer it unasked.`);
  if (r.pay.length) lines.push(`- PAYMENT: the customer can pay by ${r.pay.map((k) => ({ upi: "UPI", cod: "cash on delivery", shop: "paying at the shop", card: "card" }[k])).join(", ")}. Mention only these when payment comes up.`);
  if (r.never) lines.push(`- NEVER SAY (the owner's own instruction): ${r.never}`);
  return lines.length ? `\n\nTHE OWNER'S OWN RULES (they win over the general rules above):\n${lines.join("\n")}` : "";
}

/** Extra moments the owner wants an [[ALERT]] for (WhatsApp). */
export function alertBlock(card) {
  const r = rulesOf(card);
  const more = [];
  if (r.alertOn.includes("big")) more.push("the order looks big (many pieces, a bulk / wholesale quantity, or a high value)");
  if (r.alertOn.includes("every")) more.push("this is a new customer's first real question (every new enquiry)");
  return more.length ? `\n- ALSO ALERT ${"the seller"} (end with the [[ALERT: …]] line) when: ${more.join("; ")}.` : "";
}
