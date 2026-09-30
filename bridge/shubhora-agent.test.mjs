// node --test bridge/shubhora-agent.test.mjs
// The Shubhora partner assistant's fixed parts: menu, language, quick reads, link cleaning, the card check, and whole
// turns with a stand-in for the AI model (the real model is tested on the server from Super Admin → Shubhora AI →
// Test chats).
import test from "node:test";
import assert from "node:assert/strict";
import {
  v2Mode, agentLinks, languageRequest, scriptLanguage, looksEnglish, replyLanguage, quickRead, menuChoice, menuText,
  optionReply, cleanLinks, everydayHindi, dropRepeatGreeting, modelMessages, parseTags, wrongScript, agentTurn,
  agentFollowup, buildAgentSystem, personalLine, cardReadyNudge, linkKeys, callReply, cardCheck, cardLinkIn,
  fixRomanWords, dropPlaceholders, defersToSeller, dropDeferring, callAskNumber, callNoted, phoneIn, dropDisclaimers, hasDisclaimer,
  tooLong, isAdOpener,
} from "./shubhora-agent.mjs";
import { SHUBHORA_FAQ, SHUBHORA_KNOWLEDGE, SHUBHORA_PERSONA, ownPersona } from "./shubhora-kb.mjs";

const links = agentLinks({ site: "https://shubhora.com", cardUrl: "https://shubhora.com/c/niteen", ownerUsername: "Delhi" });
const TEMPLATE_PERSONA = "A clear, friendly Shubhora advisor. Explains the digital V-Card in simple words in the visitor's own language, asks what work they do, shows how the card would help that trade, never pressures, and never promises any income. Offers a live demo and a callback whenever something needs confirming.";
const card = { name: "Niteen", jobTitle: "Shubhora Partner", company: "Shubhora Digital V-Card", kb: "shubhora", botPersona: TEMPLATE_PERSONA, botKnowledge: "PRODUCT: old copy\nSAFETY: When unsure, offer a callback.\nMy office: Jaipur, Mon-Sat" };
const ctx = { seller: "Niteen", card, links, override: {} };
const T0 = Date.parse("2026-09-26T05:00:00Z"); // 10:30 IST
const H = 3600_000, D = 24 * H;
const strip = (t) => t.replace(/[⁠​⁣]/g, "");

/** A stand-in model: returns the queued answers in order and records what it was asked. */
function fakeModel(...answers) {
  const calls = [];
  const complete = async (req) => {
    calls.push(req);
    const a = answers.length > 1 ? answers.shift() : answers[0];
    if (a instanceof Error) throw a;
    return { text: typeof a === "function" ? a(req) : a, blocked: false };
  };
  return { complete, calls };
}

// A customer's card, as the database has it (the check reads only real data).
const rameshCard = {
  name: "Ramesh Gupta", company: "Ramesh Kirana Store", avatarUrl: "https://cdn.x/ramesh.jpg", coverUrl: "",
  about: "Daily grocery, dal, rice, oil and snacks at the best rates in Sector 5, delivered free above ₹500.",
  links: [{ type: "whatsapp", value: "+91 98765 43210" }, { type: "email", value: "you@example.com" }],
  pages: [{ slug: "home", blocks: [
    { kind: "product", items: [{ name: "Basmati rice 5 kg", price: "₹450", images: ["https://cdn.x/rice.jpg"] }, { name: "Mustard oil 1 L", price: "" }] },
    { kind: "gallery", images: [{ url: "/api/stock/banners/kirana-1.jpg" }] },
  ] }],
};

test("switch: off, all Shubhora cards, everything, pilot cards", () => {
  assert.equal(v2Mode("", true, "niteen"), null);
  assert.equal(v2Mode("off", true, "niteen"), null);
  assert.equal(v2Mode("shubhora", true, "niteen"), "shubhora");
  assert.equal(v2Mode("shubhora", false, "drsharma"), null);
  assert.equal(v2Mode("all", false, "drsharma"), "generic");
  assert.equal(v2Mode("niteen, next_level", true, "niteen"), "shubhora");
  assert.equal(v2Mode("niteen, next_level", true, "someone"), null);
});

test("links: joining link from the owner's username, fallback, templates", () => {
  assert.equal(links.join, "https://shubhora.com/join/Delhi");
  assert.equal(agentLinks({ site: "https://shubhora.com", cardUrl: "c" }).join, "https://shubhora.com/signup");
  assert.equal(agentLinks({ site: "https://shubhora.com", ownerUsername: "bad name!", joinFallback: "https://shubhora.com/signup?ref=SH1" }).join, "https://shubhora.com/signup?ref=SH1");
  const l2 = agentLinks({ site: "https://shubhora.com", extraTemplates: [{ key: "kirana-store", name: "Kirana store" }, { key: "vcard-reseller", name: "x" }] });
  assert.ok(l2.templates.some((t) => t.url === "https://shubhora.com/templates/kirana-store"));
  assert.ok(!l2.templates.some((t) => t.key === "vcard-reseller"));
});

test("facts: free for 1 year, own domain bought by the customer, plan caps, no callbacks", () => {
  assert.match(SHUBHORA_KNOWLEDGE, /FREE for 1 year \(worth ₹1,499\)/);
  assert.match(SHUBHORA_KNOWLEDGE, /personal domain \(yourbusiness\.com\) buys it itself from any domain company/);
  assert.match(SHUBHORA_KNOWLEDGE, /1 pair = 2,500 BV on the left matched with 2,500 BV on the right .* = ₹500/);
  assert.match(SHUBHORA_KNOWLEDGE, /up to 10 pairs a day in each binary = ₹5,000 a day per binary → up to ₹10,000 a day for both → up to ₹3,00,000 in a 30-day month/);
  assert.match(SHUBHORA_KNOWLEDGE, /Every pair that forms is paid ₹500, by the plan's rules/);
  assert.match(SHUBHORA_KNOWLEDGE, /the renewal is ₹1,499.*Never bring up the renewal yourself/s);
  // no nervous disclaimers as facts (the owner, 27 Sep): the only mention is the rule against them
  assert.doesNotMatch(SHUBHORA_KNOWLEDGE, /not a target or a promise|The cap is the most the plan can pay|No income guarantee/);
  for (const t of [SHUBHORA_FAQ, SHUBHORA_PERSONA]) assert.doesNotMatch(t, /गारंटी\s*नहीं|guarantee|promise/i);
  assert.match(SHUBHORA_FAQ, /हर पेयर का ₹500 प्लान के नियम से पक्का मिलता है/);
  assert.match(SHUBHORA_FAQ, /1 साल बाद रिन्यूअल ₹1,499 है/);
  assert.match(SHUBHORA_FAQ, /वेबसाइट आपके Shubhora लिंक पर पहले दिन से चालू/);
  assert.doesNotMatch(SHUBHORA_FAQ, /डोमेन Shubhora नहीं देता/);
  for (const t of [SHUBHORA_KNOWLEDGE, SHUBHORA_FAQ, SHUBHORA_PERSONA]) {
    assert.doesNotMatch(t, /for ever|hamesha free|callback|call back/i);
  }
  assert.match(SHUBHORA_FAQ, /1 साल तक फ्री/);
  assert.equal(ownPersona(TEMPLATE_PERSONA), "");
  assert.equal(ownPersona("Friendly and short, Haryanvi touch"), "Friendly and short, Haryanvi touch");
});

test("language: explicit requests, script, English sentences, memory", () => {
  assert.equal(languageRequest("English"), "en");
  assert.equal(languageRequest("english me baat karo"), "en");
  assert.equal(languageRequest("Can you speak English?"), "en");
  assert.equal(languageRequest("हिंदी में बात कीजिए"), "hi");
  assert.equal(languageRequest("Gujarati ma"), "gu");
  assert.equal(languageRequest("card Hindi me hai kya?"), null);
  assert.equal(scriptLanguage("કેમ છો"), "gu");
  assert.equal(scriptLanguage("मला कार्ड पाहिजे"), "mr");
  assert.equal(looksEnglish("Hello, I'd like to know about your digital card service."), true);
  assert.equal(looksEnglish("Mujhe card chahiye please"), false);
  assert.equal(replyLanguage("mujhe card banwana hai").code, "hi");
  // Always Hindi until they ask (owner, 27 Sep 2026) — an English sentence alone does not switch.
  assert.equal(replyLanguage("Hello, I'd like to know about your digital card service.").code, "hi");
  assert.equal(replyLanguage("કેમ છો").code, "hi");
  assert.equal(replyLanguage("ok", { lang: "en" }).code, "hi");
  assert.equal(replyLanguage("I don't understand Hindi").code, "en");
  assert.equal(replyLanguage("hindi nahi aati").code, "en");
  assert.equal(replyLanguage("price kya hai", { lang: "en", langExplicit: true }).code, "en");
});

test("quick reads: openers, social, acks, menu numbers, topics, calls", () => {
  for (const t of ["Hi", "Hello sir", "Namaste ji", "?", "Hello! Can I get more info on this?"]) assert.equal(quickRead(t).kind, "opener", t);
  for (const t of ["Good morning ji 🌹", "Happy Diwali", "🌹"]) assert.equal(quickRead(t).kind, "social", t);
  assert.notEqual(quickRead("happy to join").kind, "social");
  for (const t of ["ok", "👍", "thanks", "धन्यवाद"]) assert.equal(quickRead(t).kind, "ack", t);
  assert.equal(menuChoice("1"), 1);
  assert.equal(menuChoice("४"), 4);
  assert.equal(menuChoice("पार्टनर प्रोग्राम"), 4);
  assert.equal(menuChoice("अन्य जानकारी"), 5);
  assert.equal(menuChoice("Free V-Card"), 1);
  assert.equal(menuChoice("12"), 0);
  assert.ok(quickRead("pdf bhejo").topics.includes("pdf"));
  assert.ok(!quickRead("school app ki details").topics.includes("pdf"));
  for (const t of ["call me", "mujhe baat karni hai", "kisi insaan se baat karao", "Niteen ji se baat karwa do", "मुझे कॉल करो",
    "kya main aapse baat kar sakta hu?", "Niteen ji se baat ho sakti hai?", "phone pe baat karte hain", "Can I talk to someone?", "क्या आपसे बात हो सकती है?"]) {
    assert.ok(quickRead(t).topics.includes("call"), t);
  }
  for (const t of ["WhatsApp call button hota hai?", "kya AI customer se baat kar sakta hai?", "Can I talk about pricing?"]) assert.ok(!quickRead(t).topics.includes("call"), t);
});

test("menu: the owner's format, card link, language line", () => {
  const hi = menuText({ lang: "hi", seller: "Niteen", cardUrl: links.card });
  assert.equal(hi, [
    "नमस्ते जी! 🙏 मैं Niteen जी का AI असिस्टेंट हूँ।",
    "आप किस बारे में जानना चाहते हैं? (नंबर भेजें):",
    "",
    "1️⃣ डिजिटल V-Card (फ्री/डेमो)",
    "2️⃣ Shubhora सर्विसेज़",
    "3️⃣ कस्टम सॉफ्टवेयर",
    "4️⃣ पार्टनर प्रोग्राम",
    "5️⃣ अन्य जानकारी",
    "",
    "🔗 Niteen जी का कार्ड: https://shubhora.com/c/niteen",
    "🌐 You can reply in any language (हिंदी, English, मराठी, Gujarati, etc.)",
  ].join("\n"));
  const en = menuText({ lang: "en", seller: "Niteen", cardUrl: links.card, offerLanguage: false });
  assert.match(en, /2️⃣ Shubhora services/);
  assert.doesNotMatch(en, /🌐/);
  assert.doesNotMatch(menuText({ lang: "hi", seller: "Niteen", cardUrl: links.card, web: true }), /🔗/);
});

test("menu options: free for 1 year, partner programme with the joining link and no call offer", () => {
  const o1 = optionReply(1, { lang: "hi", seller: "Niteen", links });
  assert.match(o1, /^डिजिटल V-Card ₹1,499 की वैल्यू का है — आपके लिए 1 साल तक बिल्कुल फ्री 🎉/);
  assert.match(o1, /अपना फ्री कार्ड यहाँ से शुरू कीजिए 👉 https:\/\/shubhora.com\/join\/Delhi\n5 मिनट का वीडियो/, "the joining link first — no details asked");
  assert.match(o1, /मैं चेक करके बताऊँगा कि और अच्छा कैसे बने/);
  assert.ok(o1.indexOf(links.join) < o1.indexOf("आप क्या काम करते हैं?"), "the link comes before any question");
  assert.match(optionReply(1, { lang: "en", seller: "Niteen", links }), /Start your free card here 👉 https:\/\/shubhora.com\/join\/Delhi/);
  const o4 = optionReply(4, { lang: "hi", seller: "Niteen", links });
  assert.match(o4, /फ्री रजिस्ट्रेशन यहाँ से 👉 https:\/\/shubhora.com\/join\/Delhi/);
  assert.match(o4, /रजिस्ट्रेशन में कोई दिक्कत आए तो बताइए — मैं मदद करता हूँ।/);
  assert.match(o4, /\[MEDIA\] https:\/\/shubhora.com\/api\/stock\/demo\/shubhora-presentation-2026-09.pdf$/);
  assert.match(optionReply(1, { lang: "en", seller: "Niteen", links }), /free for you for a year/);
  for (let n = 1; n <= 5; n++) for (const lang of ["hi", "en"]) {
    const r = optionReply(n, { lang, seller: "Niteen", links });
    assert.doesNotMatch(r, /Niteen|कॉल पर|call with|for ever|हमेशा/, `option ${n} ${lang}`);
  }
});

test("card check: real data only, fixes in order of importance", () => {
  assert.deepEqual(cardLinkIn("haan bana liya https://shubhora.com/c/Ramesh-Kirana dekho", links), { username: "ramesh-kirana", url: "https://shubhora.com/c/Ramesh-Kirana" });
  assert.equal(cardLinkIn("shubhora.com/c/abc_1", links).url, "https://shubhora.com/c/abc_1");
  assert.equal(cardLinkIn("no link here", links), null);
  const c = cardCheck(rameshCard);
  assert.equal(c.name, "Ramesh Kirana Store");
  assert.ok(c.good.includes("photo / logo"));
  assert.ok(c.good.includes("Call and WhatsApp buttons"));
  assert.ok(c.good.includes("2 products"));
  assert.ok(c.good.includes("about text"));
  assert.match(c.fix[0], /you@example\.com/, "a sample leftover is fixed first");
  assert.ok(c.fix.some((f) => /1 product\(s\) without a price/.test(f)));
  assert.ok(c.fix.some((f) => /1 product\(s\) without their own photo/.test(f)));
  assert.ok(c.fix.some((f) => /no shop address/.test(f)));
  assert.ok(c.fix.some((f) => /no photo\(s\) of the shop/.test(f)), "a stock picture is not their own photo");
  assert.equal(cardCheck(null), null);
});

test("cleaning: our links only, everyday Hindi, Roman words, placeholders, repeated hello", () => {
  const t = cleanLinks("Video: https://www.youtube.com/watch?v=kQuN3OVBNl0.\nMade up: https://shubhora.com/c/niteen-rajput\nOther: https://example.com/x\n[MEDIA] https://youtu.be/RwVVwCRWxCQ", links);
  assert.match(t, /Video: https:\/\/youtu.be\/kQuN3OVBNl0\./);
  assert.match(t, /Made up: https:\/\/shubhora.com\/c\/niteen$/m);
  assert.doesNotMatch(t, /example\.com/);
  assert.match(cleanLinks("Nice: https://shubhora.com/c/ramesh-kirana", links, "https://shubhora.com/c/ramesh-kirana"), /ramesh-kirana/);
  assert.equal(everydayHindi("यह कार्ड निःशुल्क है, कृपया संपर्क करें।"), "यह कार्ड फ्री है, कॉल या मैसेज कीजिए।");
  assert.equal(fixRomanWords("hum इसे एक बार चेक कर रहे हैं।"), "हम इसे एक बार चेक कर रहे हैं।");
  assert.equal(fixRomanWords("PDF me पूरा प्लान है: https://shubhora.com/join/Delhi"), "PDF में पूरा प्लान है: https://shubhora.com/join/Delhi");
  assert.equal(fixRomanWords("Aap ka card free hai"), "Aap ka card free hai", "a Roman reply is left to the script check");
  assert.equal(dropPlaceholders("बढ़िया!\n👉 डेमो टेम्पलेट देखें: [यहाँ लिंक डालें]\nलिंक: https://shubhora.com/join/Delhi"), "बढ़िया!\nलिंक: https://shubhora.com/join/Delhi");
  assert.equal(dropRepeatGreeting("नमस्ते जी! 🙏 कार्ड बन गया?"), "कार्ड बन गया?");
  assert.equal(parseTags("You: बढ़िया! आपका कार्ड फ्री है।").text, "बढ़िया! आपका कार्ड फ्री है।");
  assert.equal(wrongScript("Aap ka card free hai, kya aap banana chahte hain?", "hi"), true);
  assert.equal(defersToSeller("कमाई की डिटेल Niteen जी आपको बताएँगे।"), true);
  assert.equal(defersToSeller("चाहें तो Niteen जी से कॉल पर बात करवा दूँ?"), true);
  assert.equal(defersToSeller("मैं Niteen जी से कन्फर्म करके बताता हूँ"), true);
  // the call line and the software quote line bring the partner in — right only when asked (then no check is made)
  assert.equal(defersToSeller(callReply("Niteen", "hi")), true);
  assert.equal(defersToSeller(callReply("Niteen", "en"), "Niteen"), true);
  assert.equal(defersToSeller("आपकी ज़रूरत मैंने नोट कर ली है — इसका कोटेशन Niteen जी भेजेंगे; जैसे ही वो फ्री होंगे, आपसे बात कर लेंगे।"), true);
  assert.equal(defersToSeller("इसके बारे में Niteen जी खुद बताएँगे।"), true);
  assert.equal(defersToSeller("Niteen will call you tomorrow.", "Niteen"), true);
  assert.equal(defersToSeller("The video will explain every step.", "Niteen"), false, "English needs a person");
  assert.equal(defersToSeller("रजिस्ट्रेशन में कोई दिक्कत आए तो बताइए — मैं मदद करता हूँ।"), false);
  assert.equal(dropDeferring("एक पेयर ₹500 का है। बाकी डिटेल Niteen जी आपको बताएँगे।\nफ्री रजिस्ट्रेशन यहाँ से 👉 https://shubhora.com/join/Delhi"),
    "एक पेयर ₹500 का है।\nफ्री रजिस्ट्रेशन यहाँ से 👉 https://shubhora.com/join/Delhi");
  assert.equal(dropDeferring("Here is the plan. Niteen will call you to explain it.", "Niteen"), "Here is the plan.");
});

test("prompt: answers itself, facts, links, examples, no template tone", () => {
  const s = buildAgentSystem({ channel: "whatsapp", seller: "Niteen", card, links, lang: "hi", chat: { fresh: true, shared: ["card"] }, now: T0 });
  for (const needle of ["YOU HANDLE IT YOURSELF", "NEVER offer on your own to connect them", "free for 1 year", "A personal domain only if they want one",
    "up to ₹10,000 a day and ₹3,00,000 a month", "HOW YOU SELL — like a senior salesman", "never \"गारंटी नहीं\"", "हर पेयर का ₹500 प्लान के नियम से पक्का मिलता है",
    "less than ₹100 a day", "renewal ₹1,499) only if they ask", "CARD CHECK", "अपना फ्री कार्ड यहाँ से शुरू कीजिए 👉",
    links.join, links.tutorial, links.planVideo, `[MEDIA] ${links.pdf}`, "templates/salon-spa", "PLAN FACTS", "DEVANAGARI",
    "ठीक है जी, मैं Niteen जी को बता देता हूँ — जैसे ही वो फ्री होंगे, आपसे बात कर लेंगे 🙏", "[[PERSONAL]]", "REPLY LANGUAGE"]) {
    assert.ok(s.includes(needle), needle);
  }
  assert.ok(!s.includes("Offers a live demo and a callback"), "the template's old tone is left out");
  assert.ok(!s.includes("PRODUCT: old copy") && !s.includes("offer a callback"), "old frozen notes dropped");
  assert.ok(s.includes("My office: Jaipur"));
  assert.doesNotMatch(s, /for ever/i);
  assert.doesNotMatch(s, /not a guarantee|ऊपरी लिमिट है, गारंटी नहीं|Shubhora डोमेन नहीं देता।/);
  const web = buildAgentSystem({ channel: "web", seller: "Niteen", card, links, lang: "en", now: T0 });
  assert.ok(!web.includes("[[PERSONAL]]"));
});

test("no nervous disclaimers: 'गारंटी नहीं' goes, a made-up example keeps its note", () => {
  assert.equal(dropDisclaimers("हर पेयर पर ₹500 — महीने में ₹3,00,000 तक। ये प्लान की ऊपरी लिमिट है, गारंटी नहीं।\nफ्री रजिस्ट्रेशन यहाँ से 👉 https://shubhora.com/join/Delhi"),
    "हर पेयर पर ₹500 — महीने में ₹3,00,000 तक।\nफ्री रजिस्ट्रेशन यहाँ से 👉 https://shubhora.com/join/Delhi");
  assert.equal(dropDisclaimers("Up to ₹3,00,000 a month. This is the cap, not a promise."), "Up to ₹3,00,000 a month.");
  assert.equal(dropDisclaimers("No income guarantee."), "No income guarantee.", "nothing else left → kept rather than an empty reply");
  const ex = "मान लीजिए लेफ्ट-राइट में 20-20 बिज़नेस जुड़ते हैं, तो 20 पेयर = ₹10,000 (ये उदाहरण है, गारंटी नहीं)।";
  assert.equal(dropDisclaimers(ex), ex, "a made-up example keeps its short note");
  assert.equal(hasDisclaimer("हर पेयर का ₹500 पक्का मिलता है"), false);
  assert.equal(hasDisclaimer("कमाई की कोई गारंटी नहीं है"), true);
});

test("history → model messages: merged, gaps and the seller's own messages marked", () => {
  const msgs = modelMessages([
    { role: "assistant", content: "menu", at: T0 },
    { role: "user", content: "1", at: T0 + 60_000 },
    { role: "assistant", content: "option 1", at: T0 + 70_000 },
    { role: "assistant", content: "Kal milte hain", at: T0 + 80_000, by: "owner" },
  ], "haan bana liya", { now: T0 + 2 * D, seller: "Niteen" });
  assert.equal(msgs[0].content, "(earlier in this chat)");
  assert.match(msgs[3].content, /\[Niteen typed this personally\] Kal milte hain/);
  assert.match(msgs[4].content, /^\[2 days later\] haan bana liya/);
});

/* ---------------- whole conversations ---------------- */

async function say(convo, text, { dt = 60_000, answers = [], contact = {}, channel = "whatsapp", cardLookup } = {}) {
  convo.now += dt;
  const m = fakeModel(...(answers.length ? answers : ["(no ai expected)"]));
  const out = await agentTurn({ channel, text, history: convo.history, state: convo.state, contact, ctx, now: convo.now, complete: m.complete, cardLookup });
  convo.history.push({ role: "user", content: text, at: convo.now });
  if (out.reply) convo.history.push({ role: "assistant", content: out.reply, at: convo.now + 5000 });
  convo.state = out.state;
  return { out, calls: m.calls };
}
const newConvo = () => ({ history: [], state: {}, now: T0 });

test("new contact: Hi → menu → 1 → kirana → joining link → next-day nudge → the AI checks their card", async () => {
  const c = newConvo();
  let r = await say(c, "Hi");
  assert.equal(r.calls.length, 0);
  assert.match(r.out.reply, /मैं Niteen जी का AI असिस्टेंट हूँ/);
  r = await say(c, "1");
  assert.match(r.out.reply, /1 साल तक बिल्कुल फ्री/);
  assert.match(r.out.reply, /अपना फ्री कार्ड यहाँ से शुरू कीजिए 👉 https:\/\/shubhora.com\/join\/Delhi/);
  assert.equal(c.state.stage, "self-card", "the joining link went out with option 1");
  r = await say(c, "kirana store hai", { answers: [`किराना के लिए कार्ड पर रेट लिस्ट और "WhatsApp पर ऑर्डर" बटन — ग्राहक घर बैठे ऑर्डर भेजेंगे। नमूना देखिए: ${links.card}\nऊपर वाला लिंक खोलकर शुरू कीजिए — कहीं अटकें तो बताइए।`] });
  assert.equal(c.state.stage, "self-card");
  assert.match(r.calls[0].system, /The menu \(1–5\) was already sent/);
  assert.match(r.calls[0].system, /Already shared in this chat[^\n]*the joining link/);
  assert.match(r.calls[0].system, /If the joining link is already in this chat, don't send it again/);
  const f = await agentFollowup({ history: c.history, state: c.state, ctx, step: 0, now: c.now + D, complete: fakeModel("x").complete });
  assert.equal(f, cardReadyNudge("hi"));
  assert.doesNotMatch(f, /Niteen/);
  const lookups = [];
  r = await say(c, "haan bana liya https://shubhora.com/c/ramesh-kirana", { dt: D, cardLookup: async (u) => { lookups.push(u); return rameshCard; },
    answers: ["वाह, बधाई हो! 🎉 कार्ड लाइव है — फोटो और WhatsApp बटन सही लगे हैं।\nदो चीज़ें जोड़ दीजिए:\n• सरसों के तेल का रेट (ऐप → \"Products\")\n• दुकान का पता और लोकेशन (ऐप → \"Your business\")"] });
  assert.deepEqual(lookups, ["ramesh-kirana"]);
  assert.match(r.calls[0].system, /CARD CHECK — https:\/\/shubhora.com\/c\/ramesh-kirana \(opened just now; this is their real card, "Ramesh Kirana Store"\)/);
  assert.match(r.calls[0].system, /Could be better: the sample email "you@example.com"/);
  assert.equal(r.out.alert, null, "a new card is not an alert for the partner");
  assert.equal(c.state.stage, "card-made");
  // a link that does not open
  r = await say(c, "ye dekho https://shubhora.com/c/galat-naam", { cardLookup: async () => null, answers: ["ये लिंक खुल नहीं रहा — ऐप में Publish दबाकर पूरा लिंक दोबारा भेजिए।"] });
  assert.match(r.calls[0].system, /does not open a live card/);
});

test("the AI answers itself: a draft that hands over to the partner is rewritten", async () => {
  const c = newConvo();
  const r = await say(c, "kitna kama sakte hain?", { answers: [
    "कमाई की पूरी डिटेल Niteen जी आपको बताएँगे। चाहें तो Niteen जी से कॉल पर बात करवा दूँ?",
    "एक पेयर ₹500 का है। दो बाइनरी हैं और हर बाइनरी में रोज़ ज़्यादा से ज़्यादा ₹5,000 — यानी महीने में ₹3,00,000 तक। ये ऊपरी लिमिट है, गारंटी नहीं।",
  ] });
  assert.equal(r.calls.length, 2);
  assert.match(r.calls[1].system, /handed the customer over to Niteen/);
  assert.match(r.out.reply, /₹3,00,000 तक/);
  assert.doesNotMatch(r.out.reply, /Niteen/);
  assert.doesNotMatch(r.out.reply, /गारंटी/, "no nervous 'no guarantee' line");
  // both drafts hand over → only those sentences go
  const c2 = newConvo();
  const r2 = await say(c2, "red id kya hoti hai", { answers: [
    "रजिस्ट्रेशन फ्री है और ID लाल रहती है। बाकी Niteen जी आपको समझा देंगे।",
    "रजिस्ट्रेशन फ्री है और ID लाल रहती है; Growth चालू होते ही हरी हो जाती है। बाकी Niteen जी आपको बताएँगे।",
  ] });
  assert.equal(r2.out.reply, "रजिस्ट्रेशन फ्री है और ID लाल रहती है; Growth चालू होते ही हरी हो जाती है।");
  // the call line offered without being asked for a call
  const c4 = newConvo();
  const r4 = await say(c4, "joining kaise karni hai", { answers: [
    `फ्री रजिस्ट्रेशन यहाँ से 👉 ${links.join}\n${callReply("Niteen", "hi")}`,
    `फ्री रजिस्ट्रेशन यहाँ से 👉 ${links.join}\nमोबाइल नंबर से साइन-अप कीजिए — कहीं अटकें तो बताइए, मैं मदद करता हूँ।`,
  ] });
  assert.equal(r4.calls.length, 2);
  assert.doesNotMatch(r4.out.reply, /Niteen/);
  assert.equal(r4.out.alert, null);
  // a payment problem: the assistant gives the steps itself — "Niteen will check" is rewritten too
  const c3 = newConvo();
  const r3 = await say(c3, "payment kat gaya par plan active nahi hua", { answers: [
    "चिंता मत कीजिए, Niteen जी चेक करके बताएँगे।",
    "चिंता मत कीजिए 🙏 ऐप एक बार बंद करके दोबारा खोलिए। फिर भी न दिखे तो पेमेंट ID के साथ Shubhora सपोर्ट को WhatsApp कीजिए: +91 76656 69888\n[[ALERT: Payment done but plan not active]]",
  ] });
  assert.equal(r3.calls.length, 2);
  assert.match(r3.out.reply, /Shubhora सपोर्ट/);
  assert.match(r3.out.alert, /Payment done/);
});

test("call requests: the owner's line + an alert; longer asks keep the AI", async () => {
  let c = newConvo();
  let r = await say(c, "mujhe call karo");
  assert.equal(r.calls.length, 0);
  assert.equal(r.out.reply, "ठीक है जी, मैं Niteen जी को बता देता हूँ — जैसे ही वो फ्री होंगे, आपसे बात कर लेंगे 🙏");
  assert.match(r.out.alert, /Wants a call/);
  c = newConvo();
  r = await say(c, "Can someone call me? I want to talk to a real person", { answers: ["Sure 🙏 I'll let Niteen know — as soon as Niteen is free, you'll get a call."] });
  assert.equal(r.out.reply, "Sure 🙏 I'll let Niteen know — as soon as Niteen is free, you'll get a call.");
  c = newConvo();
  r = await say(c, "mujhe plan samajhna hai aur uske baad call chahiye, aap mujhe call karo shaam ko 6 baje", { answers: ["ठीक है जी, मैं Niteen जी को बता देता हूँ — जैसे ही वो फ्री होंगे, आपसे बात कर लेंगे 🙏 तब तक प्लान का वीडियो देख लीजिए: https://youtu.be/RwVVwCRWxCQ"] });
  assert.equal(r.calls.length, 1, "a longer message still goes to the AI — and handing over is allowed, no rewrite");
  assert.match(r.out.alert, /Wants a call/);
  c = newConvo();
  await say(c, "Niteen ji se baat karni hai");
  r = await say(c, "kab tak baat ho payegi?", { answers: ["मैंने Niteen जी को बता दिया है — वो आज ही कॉल कर लेंगे जैसे ही फ्री होंगे 🙏"] });
  assert.equal(r.calls.length, 1, "right after a call request the partner may be mentioned");
  c = newConvo();
  r = await say(c, "kya AI customer se baat kar sakta hai?", { answers: ["हाँ जी! Growth प्लान में AI आपके WhatsApp पर 24×7 कस्टमर को जवाब देता है।"] });
  assert.equal(r.calls.length, 1, "a product question is not a call request");
  assert.equal(r.out.alert, null);
});

test("PDF always goes out as the file; the right video goes with it", async () => {
  let c = newConvo();
  let r = await say(c, "pdf bhejo", { answers: ["ये रही पूरी डिटेल 👇"] });
  assert.match(r.calls[0].system, /They want the PDF .*the Shubhora video/);
  assert.match(r.out.reply, /\[MEDIA\] https:\/\/shubhora.com\/api\/stock\/demo\/shubhora-presentation-2026-09.pdf$/);
  c = newConvo();
  r = await say(c, "business plan ki pdf bhejo", { answers: ["ये रहा पूरा प्लान 👇"] });
  assert.match(r.calls[0].system, /They want the PDF .*the partner-plan video/);
  // the menu naming "पार्टनर प्रोग्राम" is not interest in it; option 4 is
  c = newConvo();
  await say(c, "Hi");
  r = await say(c, "pdf", { answers: ["ये रही पूरी डिटेल 👇"] });
  assert.match(r.calls[0].system, /They want the PDF .*the Shubhora video/);
  c = newConvo();
  await say(c, "Hi");
  await say(c, "4");
  r = await say(c, "pdf dobara bhejo", { answers: ["ये रही 👇"] });
  assert.match(r.calls[0].system, /They want the PDF .*the partner-plan video/);
});

test("language switch: 'English' on a new chat → English menu, remembered", async () => {
  const c = newConvo();
  await say(c, "Hello");
  let r = await say(c, "English");
  assert.match(r.out.reply, /1️⃣ Digital V-Card \(free\/demo\)/);
  assert.doesNotMatch(r.out.reply, /🔗/, "the card link was already in the Hindi menu");
  assert.equal(c.state.langExplicit, true);
  r = await say(c, "4");
  assert.match(r.out.reply, /Register free here 👉 https:\/\/shubhora.com\/join\/Delhi/);
});

test("wrong script is retried once; placeholders and Roman words are cleaned", async () => {
  let c = newConvo();
  let r = await say(c, "card kaise banega", { answers: ["Aap ka card free me banega, bas 5 minute lagte hain.", "आपका कार्ड फ्री में बनेगा — बस 5 मिनट लगते हैं।"] });
  assert.equal(r.calls.length, 2);
  assert.match(r.calls[1].system, /wrong script/);
  c = newConvo();
  r = await say(c, "mobile shop hai", { answers: [`बढ़िया!\n👉 डेमो टेम्पलेट देखें: [यहाँ लिंक डालें]\nअपना फ्री कार्ड यहाँ से शुरू कीजिए 👉 ${links.join}\nhum आपकी मदद करेंगे।`] });
  assert.doesNotMatch(r.out.reply, /यहाँ लिंक डालें/);
  assert.match(r.out.reply, /^हम आपकी मदद करेंगे।$/m);
});

test("an essay is rewritten once into a short WhatsApp reply (links and [MEDIA] lines don't count)", async () => {
  const essay = [
    "Shubhora AI Business Assistant is a complete software suite designed for small and medium businesses in India who want to grow online without any technical knowledge.",
    "It gives you a professional digital V-Card and a full website on one link, so your customers can see your products, prices, photos and contact details anytime.",
    "The WhatsApp AI assistant replies to your customers 24x7 in their own language, answers questions about your products and saves every enquiry in your lead CRM.",
    "Every day you also get a ready poster and a status video with your name and number, and they can be posted automatically to your Facebook and Instagram pages.",
    "The Growth plan costs Rs 2,999 a month including GST, which is less than Rs 100 a day, and you can start today with a free V-Card that stays free for one full year.",
  ].join("\n\n");
  assert.ok(tooLong(essay));
  const short = `Growth = website + WhatsApp AI 24×7 + daily posters, ₹2,999 a month (less than ₹100 a day).\nStart with your free V-Card 👉 ${links.join}`;
  assert.equal(tooLong(short), false);
  assert.equal(tooLong(`${"Every pair is ₹500, paid every week. ".repeat(10)}\n[MEDIA] ${links.pdf}\n${links.planVideo}\n${links.join}`), false, "links and the PDF line are not words");
  const c = newConvo(); c.state = { lang: "en", langExplicit: true };
  const r = await say(c, "What do I get in the Growth plan?", { answers: [essay, short] });
  assert.equal(r.calls.length, 2);
  assert.match(r.calls[1].system, /far too long for WhatsApp/);
  assert.equal(r.out.lang, "en");
  assert.equal(r.out.reply, short);
  // A second long draft is kept (never a third call).
  const c2 = newConvo(); c2.state = { lang: "en", langExplicit: true };
  const r2 = await say(c2, "What do I get in the Growth plan?", { answers: [essay, essay] });
  assert.equal(r2.calls.length, 2);
  assert.ok(r2.out.reply.length > 300);
});

test("Facebook / Instagram leads: English first line → the Hindi menu; English only when asked", async () => {
  for (const t of ["I want to know more about Shubhora AI Business Assistant", "Hello! Can I get more info on this?", "Hi, I am interested in the digital card", "Can I get more details?"]) assert.equal(isAdOpener(t), true, t);
  assert.equal(isAdOpener("What is the price of the growth plan and how do I pay for it every month?"), false);
  let c = newConvo();
  let r = await say(c, "I want to know more about Shubhora AI Business Assistant");
  assert.equal(r.calls.length, 0, "no AI: the menu goes out");
  assert.equal(r.out.lang, "hi");
  assert.match(r.out.reply, /मैं Niteen जी का AI असिस्टेंट हूँ/);
  r = await say(c, "English please");
  assert.equal(r.out.lang, "en");
  // The bridge saw the ad on the message: the menu even for a real question, and even for someone known.
  c = newConvo();
  r = await say(c, "What is the price?", { contact: { fromAd: true, known: true } });
  assert.equal(r.calls.length, 0);
  assert.match(r.out.reply, /1️⃣/);
  assert.equal(r.out.lang, "hi");
  // A later English message in a running chat is still answered in Hindi.
  r = await say(c, "Tell me the price of Growth", { answers: ["Growth ₹2,999 महीना है — रोज़ ₹100 से भी कम।"] });
  assert.equal(r.out.lang, "hi");
});

test("personal messages: one polite line, then silence; business still answered", async () => {
  const c = newConvo();
  const friend = { known: true, saved: "Rahul Bhai" };
  let r = await say(c, "Bhai kal shaadi me aa raha hai na?", { answers: ["[[PERSONAL]]"], contact: friend });
  assert.equal(r.out.reply, personalLine("Niteen", "hi"));
  r = await say(c, "Aur ghar pe sab kaise hain", { contact: friend });
  assert.equal(r.calls.length, 0);
  assert.equal(r.out.action, "silent");
  r = await say(c, "Mujhe bhi V-Card chahiye apni dukaan ke liye", { contact: friend, answers: ["ज़रूर! आपकी दुकान किस चीज़ की है?"] });
  assert.equal(r.out.action, "reply");
});

test("known contacts: good-morning and forwards get no reply; a new number's good morning gets the menu", async () => {
  let c = newConvo();
  let r = await say(c, "Good morning ji 🌹", { contact: { known: true } });
  assert.equal(r.out.action, "silent");
  r = await say(c, "Aaj ka vichar: mehnat hi safalta ki kunji hai", { contact: { known: true, forwarded: true } });
  assert.equal(r.out.action, "silent");
  c = newConvo();
  r = await say(c, "Good morning sir");
  assert.match(r.out.reply, /1️⃣/);
});

test("ok / thanks: one closing line, then quiet; an answer to a question goes to the AI", async () => {
  const c = newConvo();
  c.history.push({ role: "assistant", content: "ये रही PDF 👇", at: T0 });
  let r = await say(c, "ok");
  assert.equal(r.out.reply, "ठीक है जी 🙏 कोई भी सवाल हो तो यहीं मैसेज कीजिए।");
  r = await say(c, "👍");
  assert.equal(r.out.action, "silent");
});

test("ok after the joining link / the plan: a closing line that fits, once", async () => {
  let c = newConvo();
  await say(c, "Hi");
  await say(c, "1");
  let r = await say(c, "ok");
  assert.equal(r.out.reply, "ठीक है जी 🙏 कहीं अटकें तो बताइए — कार्ड बन जाए तो लिंक यहाँ भेज दीजिए।");
  r = await say(c, "👍");
  assert.equal(r.out.action, "silent");
  c = newConvo();
  await say(c, "Hello");
  await say(c, "4");
  r = await say(c, "thanks");
  assert.equal(r.out.reply, "आपका भी धन्यवाद जी 🙏 PDF और वीडियो आराम से देख लीजिए — कोई भी सवाल हो तो यहीं पूछिए।");
});

test("returning next day: no menu, continues from history", async () => {
  const c = newConvo();
  await say(c, "Hello");
  await say(c, "4");
  const r = await say(c, "Hi", { dt: 26 * H, answers: ["नमस्ते जी! PDF देख ली? रजिस्ट्रेशन में कोई दिक्कत हो तो बताइए।"] });
  assert.match(r.calls[0].system, /Returning after 1 day/);
  assert.doesNotMatch(r.out.reply, /1️⃣/);
});

test("custom software: no price, one quote line with an alert", async () => {
  const c = newConvo();
  const r = await say(c, "mujhe school ke liye app banwana hai", { answers: ["ज़रूर बन जाएगा! ऐप में क्या-क्या चाहिए — अटेंडेंस, फीस या रिज़ल्ट?"] });
  assert.match(r.calls[0].system, /NEVER a price, a range or a timeline/);
  const r2 = await say(c, "attendance aur fees ka, Sunrise Public School Jaipur", { answers: ["आपकी ज़रूरत मैंने नोट कर ली है — इसका कोटेशन Niteen जी भेजेंगे; जैसे ही वो फ्री होंगे, आपसे बात कर लेंगे।\n[[ALERT: Custom software — school app (attendance, fees) — Sunrise Public School, Jaipur]]"] });
  assert.equal(r2.calls.length, 1, "the quote line is allowed — no rewrite");
  assert.match(r2.out.alert, /Sunrise Public School/);
  // from the menu: "3" → fixed reply → two answers without the word "software"
  const m = newConvo();
  await say(m, "Hi");
  await say(m, "3");
  await say(m, "school ke liye", { answers: ["ज़रूर! क्या-क्या चाहिए — अटेंडेंस, फीस या रिज़ल्ट?"] });
  const r3 = await say(m, "attendance aur fees, 500 bachhe", { answers: ["आपकी ज़रूरत मैंने नोट कर ली है — इसका कोटेशन Niteen जी भेजेंगे; Niteen जी आपसे कॉल करके बात कर लेंगे।\n[[ALERT: Custom software — school: attendance + fees, 500 students]]"] });
  assert.equal(r3.calls.length, 1, "a software chat may bring the partner in");
  assert.match(r3.out.reply, /कोटेशन Niteen जी भेजेंगे/);
});

test("AI failure falls back: menu on a new chat, a holding line + alert later", async () => {
  const c = newConvo();
  let r = await say(c, "card kaise banega", { answers: [new Error("quota")] });
  assert.match(r.out.reply, /1️⃣/);
  r = await say(c, "growth me kya milta hai", { answers: [new Error("quota")] });
  assert.match(r.out.reply, /जल्दी ही जवाब देंगे/);
  assert.match(r.out.alert, /AI error/);
});

test("website chat: a call request asks for the number; the partner is told once it comes", async () => {
  assert.equal(phoneIn("mera number 98765 43210 hai"), "+919876543210");
  assert.equal(phoneIn("+91-98765-43210"), "+919876543210");
  assert.equal(phoneIn("09876543210"), "+919876543210");
  assert.equal(phoneIn("order 12345"), null);
  const c = newConvo();
  let r = await say(c, "Niteen ji se baat karni hai", { channel: "web" });
  assert.equal(r.out.reply, callAskNumber("Niteen", "hi"));
  assert.equal(r.out.alert, null, "nothing to call yet");
  r = await say(c, "9876543210", { channel: "web" });
  assert.equal(r.out.reply, callNoted("Niteen", "hi"));
  assert.equal(r.out.alert, "Wants a call — +919876543210");
  const w = newConvo();
  r = await say(w, "call me on 98290 12345", { channel: "web" });
  assert.equal(r.out.reply, callNoted("Niteen", "hi"));
  assert.match(r.out.alert, /\+919829012345/);
  const s1 = buildAgentSystem({ channel: "web", seller: "Niteen", card, links, lang: "hi", now: T0 });
  assert.ok(s1.includes(callAskNumber("Niteen", "hi")), "the web prompt's call line asks for the number");
});

test("website chat: chips work, always answers, no card link inside the card", async () => {
  const c = newConvo();
  let r = await say(c, "पार्टनर प्रोग्राम", { channel: "web" });
  assert.match(r.out.reply, /फ्री रजिस्ट्रेशन यहाँ से/);
  r = await say(c, "hmm", { channel: "web", answers: ["[[SKIP]]"] });
  assert.match(r.out.reply, /बताइए/);
  r = await say(newConvo(), "Hi", { channel: "web" });
  assert.doesNotMatch(r.out.reply, /🔗/);
});

test("follow-up: written by the AI in the contact's language, never a call; personal contacts get none", async () => {
  const m = fakeModel("नमस्ते जी 🙏 V-Card शुरू करने में कोई मदद चाहिए तो बताइए — 5 मिनट का काम है।");
  const f = await agentFollowup({ history: [{ role: "user", content: "card ke baare me batao", at: T0 }], state: { lang: "hi" }, ctx, step: 1, now: T0 + 3 * D, complete: m.complete });
  assert.match(f, /V-Card/);
  assert.match(m.calls[0].system, /never say Niteen will call, check or confirm anything/);
  assert.doesNotMatch(m.calls[0].system, /a call with/);
  assert.equal(await agentFollowup({ history: [], state: { personalAt: T0 }, ctx, step: 0, complete: m.complete }), null);
  const p = fakeModel("नमस्ते जी 🙏 प्लान की PDF देख ली? रजिस्ट्रेशन में कहीं अटके हों तो बताइए। Niteen जी आपको कॉल करेंगे।");
  const fp = await agentFollowup({ history: [], state: { lang: "hi", stage: "partner" }, ctx, step: 0, now: T0, complete: p.complete });
  assert.match(p.calls[0].system, /They got the partner plan/);
  assert.equal(fp, "नमस्ते जी 🙏 प्लान की PDF देख ली? रजिस्ट्रेशन में कहीं अटके हों तो बताइए।", "a follow-up never hands over");
  const k = fakeModel("आपका कार्ड बढ़िया लग रहा है! प्रोडक्ट के रेट जोड़ दिए?");
  await agentFollowup({ history: [], state: { lang: "hi", stage: "card-made" }, ctx, step: 0, now: T0, complete: k.complete });
  assert.match(k.calls[0].system, /Their V-Card is live/);
});

test("stage: option 4 marks the partner plan; a bare number later is read by the AI, not as a menu answer", async () => {
  const c = newConvo();
  await say(c, "Hi");
  await say(c, "4");
  assert.equal(c.state.stage, "partner");
  const r = await say(c, "1", { answers: ["डिजिटल V-Card के लिए ऊपर वाला लिंक ही खोलिए — वही फ्री कार्ड का भी है।"] });
  assert.equal(r.calls.length, 1, "the menu is no longer the last message, so the AI reads the chat");
});

test("links used in replies are remembered", () => {
  assert.deepEqual(linkKeys(`x ${links.join} y ${links.tutorial} [document]`, links).sort(), ["join", "pdf", "tutorial"]);
  assert.equal(strip(callReply("Niteen", "en")), "Sure 🙏 I'll let Niteen know — as soon as Niteen is free, you'll get a call.");
});
