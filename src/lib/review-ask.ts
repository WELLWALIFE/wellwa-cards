// The Google review ask (owner, 25 Nov 2026). Pure: used by the server (the WhatsApp message after a sale) and by the app (the
// "Ask for a review" button, the review helper page). Google lets nobody fill a review in for a customer, so the helper page only
// writes a draft from what the CUSTOMER picks (stars + what they liked); they can change it, copy it and post it themselves.

/** The WhatsApp message to a customer. `link`: the review helper page (or Google's own review box); "" → share our website instead. */
export function reviewAskText(o: { biz: string; name?: string; link: string; site: string; hindi: boolean }): string {
  const first = (o.name || "").trim().split(" ")[0];
  return o.hindi
    ? `नमस्ते${first ? ` ${first} जी` : ""} 🙏 *${o.biz}* को चुनने के लिए धन्यवाद! ${o.link ? `हमारा काम कैसा लगा? 20 सेकंड में Google पर बताइए — इससे हमें बहुत मदद मिलती है:\n${o.link}` : `अगर सेवा अच्छी लगी तो अपने दोस्तों को हमारा लिंक भेज दें:\n${o.site}`}\nफिर से मिलते हैं!`
    : `Hi${first ? ` ${first}` : ""} 🙏 Thank you for choosing *${o.biz}*! ${o.link ? `How did we do? Tell Google in 20 seconds — it helps us a lot:\n${o.link}` : `If you were happy with us, do share our link with friends:\n${o.site}`}\nSee you again!`;
}

/** What the customer can tick on the helper page: fits every trade. */
export const LIKES: { key: string; hi: string; en: string }[] = [
  { key: "quality", hi: "क्वालिटी", en: "Quality" },
  { key: "service", hi: "सर्विस", en: "Service" },
  { key: "staff", hi: "अच्छा व्यवहार", en: "Friendly staff" },
  { key: "price", hi: "सही दाम", en: "Fair price" },
  { key: "time", hi: "समय पर काम", en: "On time" },
  { key: "trust", hi: "भरोसेमंद", en: "Trustworthy" },
  { key: "range", hi: "अच्छी वैरायटी", en: "Good range" },
];

const LINES: Record<string, { hi: string[]; en: string[] }> = {
  quality: { hi: ["क्वालिटी बहुत बढ़िया है", "क्वालिटी उम्मीद से अच्छी निकली", "क्वालिटी में कोई कमी नहीं"], en: ["the quality is excellent", "the quality was better than I expected", "no compromise on quality"] },
  service: { hi: ["सर्विस बहुत अच्छी मिली", "हर बात ध्यान से समझाई गई", "सर्विस तेज़ और सही थी"], en: ["the service was very good", "they explained everything patiently", "quick and proper service"] },
  staff: { hi: ["स्टाफ का व्यवहार बहुत अच्छा है", "बहुत अच्छे से बात करते हैं", "पूरा स्टाफ मददगार है"], en: ["the staff is very polite", "they talk to you nicely", "the whole team is helpful"] },
  price: { hi: ["दाम भी सही हैं", "पैसे के हिसाब से बहुत अच्छा", "रेट जायज़ हैं"], en: ["the prices are fair", "good value for money", "reasonable rates"] },
  time: { hi: ["काम समय पर पूरा हुआ", "जो समय बोला उसी पर मिला", "कोई देरी नहीं हुई"], en: ["the work was done on time", "delivered when they said", "no delays at all"] },
  trust: { hi: ["पूरा भरोसा किया जा सकता है", "ईमानदारी से काम करते हैं", "भरोसे वाली जगह है"], en: ["you can fully trust them", "honest people to deal with", "a place you can rely on"] },
  range: { hi: ["चुनने के लिए बहुत वैरायटी है", "हर तरह का सामान मिल जाता है", "अच्छी रेंज है"], en: ["lots of choice", "they have everything you need", "a good range to pick from"] },
};
const OPEN = {
  hi: { 5: ["{b} का अनुभव बहुत अच्छा रहा।", "{b} से बहुत खुश हैं।", "बहुत बढ़िया अनुभव रहा।"], 4: ["{b} का अनुभव अच्छा रहा।", "अच्छा अनुभव रहा।"] },
  en: { 5: ["Had a great experience with {b}.", "Very happy with {b}.", "A really good experience."], 4: ["Good experience with {b}.", "Had a good experience."] },
};
const CLOSE = { hi: ["सबको recommend करेंगे।", "दोबारा ज़रूर आएँगे।", "धन्यवाद!", ""], en: ["Would recommend.", "Will come again.", "Thank you!", ""] };
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** A short draft from the customer's own stars and picks; different words each time. 1–3 stars: no draft (they write what went wrong). */
export function draftReview(stars: number, likes: string[], biz: string, hindi: boolean): string {
  if (stars < 4) return "";
  const L = hindi ? "hi" : "en";
  const lines = [...likes].sort(() => Math.random() - 0.5).slice(0, 3).map((k) => LINES[k]?.[L]).filter(Boolean).map((v) => pick(v!));
  const open = pick(OPEN[L][stars >= 5 ? 5 : 4]).replace("{b}", biz);
  const body = lines.length ? (hindi ? lines.join(", ") + "।" : cap(lines.join(", ")) + ".") : "";
  return [open, body, pick(CLOSE[L])].filter(Boolean).join(" ");
}
