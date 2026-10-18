// Tutorial videos, made from the real app (owner's call, 4 Oct 2026: "website kaise banaye? Hindi me").
//
// A phone-sized Chrome walks through the app on the demo account while every tap, scroll and keystroke is recorded;
// a Hindi narrator (the same Gemini voice the ads use) speaks over it and the same words run as captions. One run
// gives two files: a phone video (9:16, for WhatsApp status / reels / Shorts) and a wide one (16:9, for YouTube).
// When the app changes, run it again and the video is new.
//
// Run on the VPS, from the app folder (reads .env.local there: Supabase, Gemini, CHROME_PATH, the site):
//   cd /opt/neuraledge/app && node scripts/tutorial-video.mjs website --user <demo account email>
//   … --out /opt/neuraledge/app/public/tutorials      where the mp4s go (default) → https://shubhora.com/tutorials/…
//   … --voice Charon                                    any Gemini prebuilt voice
//   … --no-reset                                        do not wipe the demo account first
//   … --free                                            record as a FREE account: the demo account's plan is set to Free for
//                                                       the recording and put back afterwards (a Free site has stock photos,
//                                                       no video clip, no AI banner — what a Free owner really sees)
//   … --allow-paid                                      record on the paid plan as it is (the Premium site: clip, AI banner)
//   … --compose <work dir>                              only put the video together again from an earlier recording
//   … --resume <work dir> --from make                   carry on from a scene after a run stopped there (the account is
//                                                       left as that run left it: no reset, scenes before it kept)
// The demo account is wiped (its own Reset) before the recording, so the video starts from a fresh account.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { setupFonts } from "../bridge/fonts-setup.mjs";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
try {
  for (const l of fs.readFileSync(path.join(APP, ".env.local"), "utf8").split("\n")) {
    const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !(m[1] in process.env)) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
} catch { /* env from the process */ }
const require = createRequire(path.join(APP, "package.json"));
const puppeteer = require("puppeteer-core");
const sharp = require("sharp");
setupFonts();

const args = process.argv.slice(2);
const flag = (k) => args.includes(k);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const WITH_VALUE = new Set(["--user", "--site", "--out", "--voice", "--compose", "--resume", "--from"]);
const TUTORIAL = args.find((a, i) => !a.startsWith("--") && !WITH_VALUE.has(args[i - 1])) || "website";
const USER = opt("--user", "");
const SITE = (opt("--site", env.NEXT_PUBLIC_SITE_URL || "https://shubhora.com")).replace(/\/$/, "");
const OUT = opt("--out", path.join(APP, "public", "tutorials"));
const VOICE = opt("--voice", "Kore");   // owner picked Kore (sample 2), 18 Oct 2026
const COMPOSE_ONLY = opt("--compose", "");
const RESUME = opt("--resume", "");   // work folder of an earlier run that stopped part-way
const FROM = opt("--from", "");       // …and the scene to carry on from (its earlier scenes are kept as recorded)
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.SUPABASE_SERVICE_ROLE_KEY, ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY, GEMINI = env.GEMINI_API_KEY;
const CHROME = env.CHROME_PATH || "/usr/bin/chromium-browser";
const TTS_MODEL = env.TTS_MODEL || "gemini-2.5-flash-preview-tts";
const FFMPEG = [env.WA_FFMPEG, "/opt/neuraledge/bin/ffmpeg", (() => { try { return require("ffmpeg-static"); } catch { return ""; } })(), "/usr/bin/ffmpeg"].find((f) => f && fs.existsSync(f)) || "ffmpeg";
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const CACHE = path.join(os.tmpdir(), "shubhora-tutorial", "tts-cache");
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/* ============================== the tutorials ============================== */
// Every scene: what the narrator says (Hindi, Devanagari — the TTS reads it as a native speaker) and what the
// phone does meanwhile. The clip lasts as long as the words, or longer when the screen needs it.
const TUTORIALS = {
  website: {
    title: "Website कैसे बनाएँ",
    subtitle: "Free website + digital card · 5 मिनट में",
    scenes: (u) => [
      { id: "intro", say: "नमस्ते! आज देखते हैं Shubhora पर अपनी free website और digital visiting card कैसे बनाएँ — सिर्फ़ पाँच मिनट में, बिना किसी designer के।",
        act: async () => { await u.goto(`${SITE}/`); await u.scrollBy(500, 2500); } },
      { id: "signup", say: "सबसे पहले shubhora.com खोलिए और Start free दबाइए। अपना नाम, mobile number, email और password भरिए, और Create my account दबाइए।",
        act: async () => {
          await u.tapThen("Start free", "Create", { timeout: 25000 }); await pause(600);
          await u.type('[placeholder="Ram Kumar"]', "Rajesh Sharma"); await u.type('[placeholder="9876543210"]', "9811122233");
          await u.type('[placeholder="you@example.com"]', "rajesh.sharma@gmail.com"); await u.type('[placeholder="At least 6 characters"]', "sharma@123");
          await pause(800);
        } },
      { id: "welcome", say: "Account बनते ही ये screen आती है — पाँच छोटे steps, और आपकी website तैयार। Start दबाइए।",
        between: async () => { await u.login(); await u.goto(`${SITE}/poster/welcome`); await u.waitText("Congratulations", 20000); },
        act: async () => { await pause(1800); await u.tapThen("Start (5 min)", "About you", { timeout: 25000 }); } },
      { id: "you", say: "पहला step — आपके बारे में। नाम और mobile पहले से भरे हैं। अपनी photo लगाइए, अपना शहर और घर का पता लिखिए, और Next दबाइए।",
        act: async () => {
          await pause(800); await u.type(u.afterLabel(/^Your city/), "Delhi"); await u.type(u.afterLabel(/^Residential address/), "12, Main Market, Lajpat Nagar");
          await pause(500); await u.tapThen("Next", "What is your card for?", { exact: true, timeout: 25000 });
        } },
      { id: "promote", say: "आपका card किस काम के लिए है? अपनी दुकान या काम के लिए 'Only my own business' चुनिए। Shubhora partner भी बनना हो तो 'Both' रहने दीजिए। फिर Continue।",
        act: async () => { await pause(1500); await u.tapText("Only my own business"); await pause(700); await u.tapThen("Continue", "Does your business have a website?", { timeout: 25000 }); } },
      { id: "site", say: "क्या आपकी पहले से कोई website है? है तो link डालिए — नाम, logo, products सब उसी से आ जाएँगे। नहीं है तो 'No website' चुनिए और Next दबाइए।",
        act: async () => { await pause(1500); await u.tapText("No website"); await pause(900); await u.tapThen("Next →", "Just three things", { timeout: 25000 }); } },
      { id: "business", say: "अब आपका business। नाम लिखिए — जैसे Sharma Medical Store; काम अपने आप पहचान लेता है, नहीं तो list से चुन लीजिए। शहर लिखिए। About में दो-चार शब्द लिखकर 'Write with AI' दबाइए — पूरा परिचय AI लिख देगा। फिर Save and continue।",
        act: async () => {
          await pause(600); await u.type(u.afterLabel(/name\b/i), "Sharma Medical Store"); await pause(900);
          if (!(await u.page.$eval('input[role="combobox"]', (el) => el.value))) { await u.tap('input[role="combobox"]'); await u.page.keyboard.type("medical", { delay: 70 }); await pause(900); await u.tap('[role="option"]'); }
          await u.type(u.afterLabel(/city/i), "Delhi");
          await u.type("#about", "दवाइयाँ, surgical सामान, 24 घंटे खुला"); await pause(300);
          await u.tapText("with AI"); await u.page.waitForFunction(() => (document.getElementById("about")?.value.length ?? 0) > 80, { timeout: 60000 });
          await pause(1500); await u.tapThen("Save and continue", "Skip —", { timeout: 45000 });
        } },
      { id: "products", say: "तीसरा step — products या services। हर product का नाम, दाम और photo डालिए; website इन्हीं से लिखी जाती है। अभी नहीं डालने हैं तो Skip दबाइए — बाद में कभी भी जोड़ सकते हैं।",
        act: async () => { await pause(1200); await u.scrollBy(300, 1500); await pause(400); await u.tapThen("Skip —", "Make my free website", { timeout: 35000 }); } },
      { id: "make", enter: async () => { await u.dropCards(); await u.login(); await u.goto(`${SITE}/poster/card/build?make=1`); await u.waitText("Make my free website", 40000); }, say: "और अब आख़िरी step — 'Make my free website' दबाइए। AI आपकी website और card लिखता है, photos चुनता है। इसमें एक से तीन मिनट लगते हैं।",
        act: async () => {
          await pause(1500);
          // pressed again if the first tap missed: the button is gone once the build has started
          for (let i = 0; i < 2; i++) {
            await u.tapText("Make my free website");
            try { await u.page.waitForFunction(() => !document.body?.innerText?.includes("Make my free website"), { timeout: 9000 }); break; } catch { if (i) throw new Error("the build did not start"); }
          }
          await pause(5000);
        },
        after: async () => { await u.waitText(["Your website is ready", "Your new website is ready"], 420000); await pause(1500); } },
      { id: "preview", say: "लीजिए — आपकी website तैयार! ऊपर पाँच looks हैं — Designer, Classic, Bold, Elegant और Fresh। जो पसंद आए वो चुनिए; बाद में कभी भी बदल सकते हैं।",
        act: async () => { await pause(1500); await u.tapText("Classic"); await pause(2500); await u.tapText("Bold"); await pause(2500); await u.tapText("Designer"); await pause(1500); await u.scrollBy(500, 2000); await u.scrollBy(-500, 1500); } },
      { id: "save", say: "सब ठीक लगे तो Save दबाइए। बस — आपकी website और digital card live हैं, एक ही link पर।",
        act: async () => { await pause(800); await u.tapThen("Save", "Your website and card are live", { exact: true, timeout: 150000 }); await pause(2000); } },
      { id: "live", say: "ये रहा आपका link — shubhora.com और आगे आपका नाम। इसे WhatsApp पर भेजिए, status पर लगाइए, या QR code print करवाइए — customer को आपका पूरा business एक नज़र में दिखेगा।",
        act: async () => { const slug = await u.cardSlug(); await u.goto(`${SITE}/c/${slug}`); await pause(1500); await u.scrollBy(1400, 7000); await u.scrollBy(-1400, 2500); } },
      { id: "outro", say: "तो देर किस बात की — आज ही shubhora.com पर अपनी free website बनाइए। मिलते हैं अगले video में।",
        act: async () => { await u.goto(`${SITE}/`); await pause(1000); } },
    ],
  },
  // Card + website made together, then products, then the Premium website (owner, 17 Oct 2026: no prices; Standard and Premium are only named).
  // Recorded on a paid demo account (Standard, with Premium open): a Free account makes the card only.
  cardsite: {
    title: "Visiting card और Website कैसे बनाएँ",
    subtitle: "Card + website, एक साथ · Standard और Premium",
    scenes: (u) => {
      // scenes(null) is also called once just to read the narration, before there is a browser: the page is only touched when a scene runs.
      const P = () => u.page;
      const lastOf = async (re) => P().evaluateHandle((src) => { const r = new RegExp(src); const bs = [...document.querySelectorAll("main button")].filter((b) => r.test((b.innerText || "").trim())); return bs[bs.length - 1] ?? null; }, re.source);
      const setText = async (sel, text) => { await u.type(sel, text); };
      return [
        // Each scene's words are cut into sentences and `await u.cue(k)` starts sentence k at the moment its action begins on
        // screen (the next sentence waits for the one before to finish), so what is said and what is shown always match.
        { id: "intro", say: "नमस्ते, आज देखते हैं Shubhora पर अपना digital visiting card और website कैसे बनाएँ। दोनों एक साथ बनते हैं, एक ही link पर।",
          act: async () => { await u.goto(`${SITE}/`); await u.cue(0); await pause(600); await u.cue(1); await u.scrollBy(500, 2500); } },
        { id: "signup", say: "shubhora.com खोलिए और Start free दबाइए। अपना नाम, mobile और email भरिए। फिर password डालिए, और account बन जाएगा।",
          act: async () => {
            await u.cue(0); await u.tapThen("Start free", "Create", { timeout: 25000 }); await pause(600);
            await u.cue(1); await u.type('[placeholder="Ram Kumar"]', "Rajesh Sharma"); await u.type('[placeholder="9876543210"]', "9811122233");
            await u.type('[placeholder="you@example.com"]', "rajesh.sharma@gmail.com");
            await u.cue(2); await u.type('[placeholder="At least 6 characters"]', "sharma@123");
            await pause(800);
          } },
        { id: "you", say: "पहला step, आपके बारे में। यहाँ आपका नाम, mobile और WhatsApp number, email और आपकी photo आती है। सब भरकर Next दबाइए।",
          between: async () => { await u.login(); await u.goto(`${SITE}/poster/onboard?step=you`); await u.waitText("About you", 25000); },
          act: async () => { await u.cue(0); await pause(1200); await u.cue(1); await u.scrollBy(500, 1500); await pause(600); await u.cue(2); await u.tapThen("Next →", "Who is this website for?", { timeout: 25000 }); } },
        { id: "promote", say: "अब चुनिए कि ये किसके लिए है। अपनी दुकान या काम के लिए, My own business चुनिए।",
          act: async () => { await u.cue(0); await pause(800); await u.cue(1); await u.tapText("My own business or work"); await pause(700); await u.tapThen("Next →", "Do you have a website?", { timeout: 25000 }); } },
        { id: "site", say: "अगर पहले से website है, तो उसका link डालिए, उसी से details आ जाएँगी। नहीं है, तो आख़िरी option चुनिए, यानी website नहीं है।",
          act: async () => { await u.cue(0); await pause(800); await u.cue(1); await u.tap(async () => (await lastOf(/^(🏪|🤝|🎨)/)).asElement()); await pause(900); await u.tapThen("Next →", "Just two things", { timeout: 25000 }); } },
        { id: "business", say: "अपने business का नाम लिखिए। काम अपने आप पहचान लिया जाता है। फिर अपना link चुनिए, business के नाम से या अपने नाम से।",
          act: async () => {
            await u.cue(0); await pause(400); await setText('input[placeholder="e.g. Sharma Sweets"]', "Sharma Medical Store");
            await u.cue(1); await pause(1800);
            if (!(await P().$eval('input[role="combobox"]', (el) => el.value))) { await u.tap('input[role="combobox"]'); await P().keyboard.type("medical", { delay: 70 }); await pause(900); await u.tap('[role="option"]'); }
            await u.cue(2); await pause(1200); await u.scrollBy(300, 1200); await u.tapThen("Next →", "Tap what is true", { timeout: 25000 });
          } },
        { id: "details", say: "अब जो चीज़ें आपके यहाँ सच हैं, उन पर tap कीजिए। आपके पास क्या है, आप में क्या ख़ास है, और कौन आपके ग्राहक हैं।",
          act: async () => {
            await u.cue(0); await pause(1200); await u.cue(1);
            for (const w of ["Allopathic", "Home delivery", "Prescription medicines", "Fair prices", "Best quality", "Fast delivery", "Families"]) {
              try { await u.tapText(w, { sel: "button" }); await pause(350); } catch { /* a chip this trade does not have */ }
            }
            await u.tapThen("Next →", "Where & when", { timeout: 25000 });
          } },
        { id: "where", say: "अब शहर और पूरा पता लिखिए। फिर बताइए कि आप किसे सेवा देते हैं, और आपके timings क्या हैं। घर पर delivery होती है या नहीं, ये भी चुनिए।",
          act: async () => {
            await u.cue(0); await pause(500); await setText('input[placeholder="e.g. Delhi"]', "Delhi"); await setText('input[placeholder="Shop no., street, area"]', "12, Main Market, Lajpat Nagar");
            await u.cue(1); await u.scrollBy(500, 1200);
            for (const w of ["Local", "Mon–Sat 10 AM – 8 PM"]) { try { await u.tapText(w, { sel: "button" }); await pause(500); } catch { /* already set */ } }
            await u.cue(2); try { await u.tapText("Yes", { sel: "button" }); await pause(500); } catch { /* already set */ }
            await u.tapThen("Next →", "About & logo", { timeout: 25000 });
          } },
        { id: "about", say: "AI आपके बारे में लिख देता है। चाहें तो logo लगाइए, और अपनी भूमिका चुनिए, जैसे Owner। फिर Save and continue दबाइए।",
          act: async () => {
            await u.cue(0); await pause(1500); await u.cue(1); await u.tapText("Owner", { exact: true }); await pause(900);
            await u.cue(2); await u.tapThen("Save and continue", "Make my website & card", { timeout: 60000, tries: 3 });
          } },
        { id: "make", say: "अब Make my website दबाइए। AI आपकी website और card, दोनों लिखता है। इसमें करीब एक मिनट लगता है।",
          act: async () => {
            await u.cue(0); await pause(1200);
            for (let i = 0; i < 2; i++) {
              await u.tapText("Make my website");
              try { await u.page.waitForFunction(() => !document.body?.innerText?.includes("Make my website & card"), { timeout: 9000 }); break; } catch { if (i) throw new Error("the build did not start"); }
            }
            await u.cue(1); await pause(5000); await u.cue(2); await pause(1500);
          },
          after: async () => { await u.waitText("Your website is ready", 420000); await pause(1500); } },
        { id: "preview", say: "लीजिए, आपकी website और card तैयार। ऊपर Website और Card, दोनों देख सकते हैं।",
          act: async () => { await u.cue(0); await pause(1000); await u.scrollBy(400, 1800); await u.scrollBy(-400, 1200); await u.cue(1); await u.tapText("Card", { exact: true }); await pause(2500); await u.tapText("Website", { exact: true }); await pause(1500); } },
        { id: "designs", say: "See more designs दबाइए। छह designs हैं: Colour poster, Order shop, Tile board, Photo collage, Big name और Full photo। जो पसंद आए, वो चुनिए, और website उसी पल बदल जाती है।",
          act: async () => {
            await u.cue(0); await u.tapText("See more designs"); await pause(900); await u.cue(1);
            for (const d of ["Colour poster", "Order shop", "Tile board", "Photo collage", "Big name", "Full photo"]) { await u.tapText(d); await pause(1250); }
            await u.cue(2); await u.tapText("Order shop"); await pause(1500);
          } },
        { id: "colours", say: "अब अपना रंग और letter style चुनिए, या Skip कर दीजिए। फिर Done दबाइए।",
          act: async () => {
            await u.tapThen("Save and next", "Colours and fonts", { timeout: 60000 });
            await u.cue(0); await pause(1200); try { await u.tapText("Ocean", { sel: "button" }); await pause(1800); await u.tapText("Clinic", { sel: "button" }); await pause(1500); } catch { /* names not on screen */ }
            await u.cue(1); await u.tapThen("Done — next", "Congratulations", { timeout: 90000 });
          } },
        { id: "live", say: "बधाई हो, आपकी website और card live हैं, एक ही link पर। इसे WhatsApp पर भेजिए, status पर लगाइए, या QR code बनवाइए।",
          act: async () => { await u.cue(0); await pause(2000); await u.cue(1); await u.scrollBy(500, 2500); await pause(800); await u.scrollBy(-500, 1200); } },
        { id: "products", say: "अब products या services जोड़िए। Add many at once में नाम और दाम की list लिखिए। फिर Read my list दबाइए, और AI हर चीज़ की साफ़ photo खुद ढूँढ लेता है।",
          act: async () => {
            await u.goto(`${SITE}/poster/products`); await u.waitText("Add many at once", 30000); await u.cue(0); await pause(900);
            await u.cue(1); await u.tapText("Add many at once"); await pause(800);
            await u.type("textarea", "Paracetamol 500mg strip 25\nCough syrup 95\nBP monitor 1499\nSurgical gloves box 250\nBaby diapers pack 399");
            await u.cue(2); await u.tapThen("Read my list", "Add 5 products", { timeout: 60000 }); await pause(1500);
            await u.tapText("Add 5 products"); await u.waitText("5 products added", 150000); await pause(1500);
          } },
        { id: "livesite", say: "और ये रही आपकी website, products के साथ। Home, Products, Services, Photos, FAQ और Contact, सब तैयार।",
          act: async () => { const slug = await u.cardSlug(); await u.goto(`${SITE}/c/${slug}?view=site`); await u.cue(0); await pause(1200); await u.cue(1); await u.scrollBy(1400, 6000); await u.scrollBy(-1400, 2000); } },
        { id: "premium", say: "अगर आप Premium customer हैं, तो आपकी website भी Premium बनेगी। Make advanced website दबाइए।",
          act: async () => { await u.goto(`${SITE}/poster/site/advanced`); await u.waitText("Make my advanced website", 40000); await u.cue(0); await pause(1200); await u.scrollBy(400, 1800); await u.cue(1); await u.tapText("Make my advanced website"); await pause(1500); } },
        { id: "premiumdesign", say: "AI पहले आपकी website देखकर बताता है कि क्या कमज़ोर है। फिर आपके business के लिए नया layout, नई headline और नया about लिखता है।",
          act: async () => { await u.cue(0); await pause(2500); await u.cue(1); await pause(2500); },
          after: async () => { await u.waitText("Your advanced website is ready to see", 360000); await pause(1500); await u.scrollBy(600, 1500); await u.scrollBy(-600, 800); } },
        { id: "premiumlive", say: "लीजिए, आपकी Premium website तैयार। पसंद न आए तो Try another layout दबाइए। पसंद आए तो Use this advanced website दबाइए, और Premium website live हो जाती है। हर product और service का अपना पेज है, और ये phone पर भी खुलती है।",
          act: async () => {
            await u.cue(0); await pause(1500); await u.cue(1); await pause(1200); await u.cue(2);
            await u.tapThen("Use this advanced website", "Your advanced website is live", { timeout: 60000 }); await pause(1500);
            await u.cue(3); const slug = await u.cardSlug(); await u.goto(`${SITE}/c/${slug}`); await pause(1000); await u.scrollBy(1400, 6000); await u.scrollBy(-1400, 2000);
          } },
        { id: "outro", say: "तो देर किस बात की? आज ही shubhora.com पर अपना digital card और website बनाइए।",
          act: async () => { await u.goto(`${SITE}/`); await u.cue(0); await pause(1200); await u.cue(1); await pause(1000); } },
      ];
    },
  },
};

/* ============================== helpers: account ============================== */
async function findUser(handle) {
  const want = handle.trim().toLowerCase();
  const byId = async (id) => { const r = await fetch(`${SUPA}/auth/v1/admin/users/${id}`, { headers: H }); return r.ok ? r.json() : null; };
  // the account id, or the app username (Haryana, Next_Level …)
  if (/^[0-9a-f-]{36}$/.test(want)) { const u = await byId(want); if (u) return u; }
  if (!want.includes("@")) {
    const like = want.replace(/[\\%_]/g, (m) => `\\${m}`);
    const r = await fetch(`${SUPA}/rest/v1/profiles?username=ilike.${encodeURIComponent(like)}&select=id&limit=1`, { headers: H });
    const id = (await r.json().catch(() => []))?.[0]?.id;
    if (id) { const u = await byId(id); if (u) return u; }
  }
  for (let page = 1; page < 50; page++) {
    const r = await fetch(`${SUPA}/auth/v1/admin/users?page=${page}&per_page=1000`, { headers: H });
    const j = await r.json();
    const list = j.users ?? [];
    // the login email, or (a mobile sign-up, whose login email is a placeholder) the contact email saved in the profile
    const u = list.find((x) => (x.email ?? "").toLowerCase() === want) ?? list.find((x) => String(x.user_metadata?.contact_email ?? "").toLowerCase() === want);
    if (u) return u;
    if (list.length < 1000) break;
  }
  throw new Error(`No account with the email, contact email or username "${handle}"`);
}
async function magicToken(email) {
  const r = await fetch(`${SUPA}/auth/v1/admin/generate_link`, { method: "POST", headers: H, body: JSON.stringify({ type: "magiclink", email }) });
  const j = await r.json();
  const t = j.hashed_token ?? j.properties?.hashed_token;
  if (!t) throw new Error(`could not make a login link: ${j.msg || j.error_description || r.status}`);
  return t;
}
async function bearerFor(email) {
  // straight to Supabase's verify endpoint: its JS client needs a WebSocket, which Node 20 (the server's) lacks
  const r = await fetch(`${SUPA}/auth/v1/verify`, { method: "POST", headers: { apikey: ANON, "Content-Type": "application/json" }, body: JSON.stringify({ type: "magiclink", token_hash: await magicToken(email) }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(`login failed: ${j.msg || j.error_description || r.status}`);
  return j.access_token;
}

/* ============================== helpers: plan ============================== */
const PLAN_COLS = ["plan", "plan_expires_at", "plan_source", "poster_plan", "poster_plan_expires_at", "saas_expires_at"];
/** What the build route sees (posterQuota in lib/poster-server.ts): "free", or the paid plan the account is on. */
export function planNow(r) {
  let plan = r.poster_plan ?? "free";
  if (plan !== "free" && r.poster_plan_expires_at && new Date(r.poster_plan_expires_at).getTime() < Date.now()) plan = "free";
  const until = [r.plan_expires_at, r.saas_expires_at].map((d) => (d ? new Date(d).getTime() : 0));
  if (plan === "free" && Math.max(...until) > Date.now()) plan = "suite";
  return plan;
}
export async function readPlan(uid) {
  const r = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${uid}&select=${PLAN_COLS.join(",")}`, { headers: H });
  const j = await r.json().catch(() => []);
  if (!r.ok || !j[0]) throw new Error(`could not read the account's plan (${r.status})`);
  return j[0];
}
export async function writePlan(uid, cols) {
  const r = await fetch(`${SUPA}/rest/v1/profiles?id=eq.${uid}`, { method: "PATCH", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(cols) });
  if (!r.ok) throw new Error(`could not change the account's plan (${r.status}): ${(await r.text()).slice(0, 200)}`);
}

/* ============================== helpers: voice ============================== */
const sentencesOf = (say) => say.split(/(?<=[।!?.])\s+/).filter(Boolean);
const wavHeader = (n) => { const b = Buffer.alloc(44); b.write("RIFF", 0); b.writeUInt32LE(36 + n, 4); b.write("WAVE", 8); b.write("fmt ", 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(24000, 24); b.writeUInt32LE(48000, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34); b.write("data", 36); b.writeUInt32LE(n, 40); return b; };
// How the narrator should sound (owner, 18 Oct 2026: "voice thoda better"): a warm, relaxed teacher, not a newsreader. --plain-voice turns it off.
const STYLE = flag("--plain-voice") ? "" : "Read this in a warm, friendly, clear and relaxed Hindi, like a helpful friend teaching a shopkeeper step by step. Natural pace, not rushed, a gentle smile in the voice:\n\n";
async function tts(text) {
  fs.mkdirSync(CACHE, { recursive: true });
  const file = path.join(CACHE, crypto.createHash("sha1").update(`${TTS_MODEL}|${VOICE}|${STYLE}|${text}`).digest("hex") + ".wav");
  if (!fs.existsSync(file)) {
    if (!GEMINI) throw new Error("GEMINI_API_KEY missing");
    let b64 = "", why = "";
    // A few short lines come back as "OTHER" with the long style prefix: retry with a shorter one, then with none.
    const prefixes = [STYLE, STYLE, STYLE && "Say this in a warm, friendly Hindi voice: ", STYLE && "Say warmly: ", ""];
    for (let i = 0; i < prefixes.length && !b64; i++) {
      if (i) await pause(1500);
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${TTS_MODEL}:generateContent`, {
        method: "POST", headers: { "x-goog-api-key": GEMINI, "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prefixes[i] + text }] }], generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } } }),
        signal: AbortSignal.timeout(90000),
      }).catch((e) => ({ json: async () => ({ error: { message: e.message } }) }));
      const d = await r.json();
      b64 = d?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data ?? "";
      why = d?.error ? JSON.stringify(d.error).slice(0, 160) : d?.candidates?.[0]?.finishReason || "no audio";
    }
    if (!b64) throw new Error(`TTS failed: ${why}`);
    const pcm = Buffer.from(b64, "base64");
    fs.writeFileSync(file, Buffer.concat([wavHeader(pcm.length), pcm]));
  }
  return { file, seconds: (fs.statSync(file).size - 44) / 48000 };
}

/* ============================== helpers: ffmpeg ============================== */
function ff(args, what) {
  const r = spawnSync(FFMPEG, ["-y", "-hide_banner", "-loglevel", "error", ...args], { encoding: "utf8", maxBuffer: 64 << 20 });
  if (r.status !== 0) throw new Error(`ffmpeg ${what} failed: ${(r.stderr || "").slice(-600)}`);
  return r;
}
/** Seconds and frame size of a clip (decoded through: puppeteer's webm carries no duration in its header). */
function probe(file) {
  const r = spawnSync(FFMPEG, ["-hide_banner", "-i", file, "-f", "null", "-"], { encoding: "utf8", maxBuffer: 64 << 20 });
  const err = r.stderr || "";
  const t = [...err.matchAll(/time=(\d+):(\d+):(\d+\.?\d*)/g)].pop();
  const s = err.match(/Video:.*?(\d{2,5})x(\d{2,5})/);
  if (!t || !s) throw new Error(`could not read ${file}: ${err.slice(-300)}`);
  return { seconds: Number(t[1]) * 3600 + Number(t[2]) * 60 + Number(t[3]), w: Number(s[1]), h: Number(s[2]) };
}

/* ============================== helpers: pictures ============================== */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const FONT = "Mukta, Poppins, Noto Sans Devanagari, sans-serif";
function wrap(text, perLine) {
  const out = []; let line = "";
  for (const w of String(text).split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + w).length > perLine) { out.push(line); line = w; } else line = line ? `${line} ${w}` : w;
  }
  if (line) out.push(line);
  return out;
}
/** A caption box: white words on a dark rounded panel, wrapped to the width. */
async function captionPng(file, text, { width, size }) {
  const perLine = Math.max(12, Math.floor((width - 72) / (size * 0.56)));
  const lines = wrap(text, perLine).slice(0, 5);
  const lh = Math.round(size * 1.42), padY = 26;
  const h = lines.length * lh + padY * 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}">
    <rect x="0" y="0" width="${width}" height="${h}" rx="26" fill="#0b1018" fill-opacity="0.84"/>
    ${lines.map((l, i) => `<text x="${width / 2}" y="${padY + lh * i + Math.round(size * 1.02)}" text-anchor="middle" font-family="${FONT}" font-size="${size}" font-weight="600" fill="#ffffff">${esc(l)}</text>`).join("")}
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
  return { w: width, h };
}
/** The frame around the phone's screen: a dark rounded ring; its inner half hides the recording's square corners. */
async function framePng(file, W, H, box) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="${box.x}" y="${box.y}" width="${box.w}" height="${box.h}" rx="40" fill="none" stroke="#0b0f14" stroke-width="30"/>
    <rect x="${box.x - 7}" y="${box.y - 7}" width="${box.w + 14}" height="${box.h + 14}" rx="46" fill="none" stroke="#2a3442" stroke-width="3"/>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}
/** The background: deep gradient, a brand glow, the logo, the title. */
async function backgroundPng(file, W, H, { title, subtitle, logo, titleAt, size }) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="#0f141c"/><stop offset="1" stop-color="#1b2533"/></linearGradient>
      <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#6d5dfc" stop-opacity="0.45"/><stop offset="1" stop-color="#6d5dfc" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <ellipse cx="${W * 0.5}" cy="${H * 0.5}" rx="${W * 0.7}" ry="${H * 0.5}" fill="url(#glow)"/>
    <text x="${titleAt.x}" y="${titleAt.y}" text-anchor="${titleAt.anchor}" font-family="${FONT}" font-size="${size}" font-weight="700" fill="#ffffff">${esc(title)}</text>
    <text x="${titleAt.x}" y="${titleAt.y + Math.round(size * 0.95)}" text-anchor="${titleAt.anchor}" font-family="${FONT}" font-size="${Math.round(size * 0.46)}" font-weight="500" fill="#ffffff" opacity="0.72">${esc(subtitle)}</text>
  </svg>`;
  const layers = [];
  const logoFile = path.join(APP, "public", "art", "brand", "shubhora-logo.png");
  if (fs.existsSync(logoFile)) {
    const lg = await sharp(logoFile).resize(logo.size, logo.size, { fit: "inside" }).png().toBuffer();
    layers.push({ input: lg, left: logo.x, top: logo.y });
  }
  await sharp(Buffer.from(svg)).composite(layers).png().toFile(file);
}

/* ============================== helpers: the phone ============================== */
export function ui(page, { work, email, uid }) {
  const u = { page };
  u.goto = async (url) => { await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 }); await pause(600); };
  /** Waits until the screen says `text` (or any of several). Done in slices of 20 s: one long wait inside the browser
   *  dies at Chrome's own 3-minute call limit ("Runtime.callFunctionOn timed out"), long before a website build ends.
   *  body can be missing for an instant while the page swaps documents, hence the ?. */
  u.waitText = async (text, timeout = 15000) => {
    const list = Array.isArray(text) ? text : [text];
    const until = Date.now() + timeout;
    for (;;) {
      const left = until - Date.now();
      if (left <= 0) throw new Error(`Waiting failed: ${timeout}ms exceeded for ${list.map((t) => `"${t}"`).join(" or ")}`);
      try {
        await page.waitForFunction((ts) => ts.some((t) => !!document.body?.innerText?.includes(t)), { timeout: Math.min(left, 20000) }, list);
        return;
      } catch (e) {
        // a slice ran out: take the next; anything else (the page closed, a protocol error) is a real failure
        if (e?.name !== "TimeoutError") throw e;
      }
    }
  };
  /** The first visible element whose text has `text` (whole text when exact). */
  u.findText = async (text, { exact = false, sel = "button, a, [role='option'], label, summary" } = {}) => {
    const h = await page.evaluateHandle((t, ex, s) => {
      const vis = (el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden"; };
      const all = [...document.querySelectorAll(s)].filter(vis);
      return all.find((el) => { const x = (el.innerText || el.textContent || "").replace(/\s+/g, " ").trim(); return ex ? x === t : x.includes(t); }) ?? null;
    }, text, exact, sel);
    const el = h.asElement();
    if (!el) throw new Error(`"${text}" not on screen`);
    return el;
  };
  u.afterLabel = (re) => async () => {
    const h = await page.evaluateHandle((src, flags) => {
      const r = new RegExp(src, flags);
      for (const l of document.querySelectorAll("label")) {
        const own = [...l.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" ").trim() || l.innerText.split("\n")[0];
        if (r.test(own.trim())) { const i = l.querySelector("input, textarea"); if (i) return i; }
      }
      return null;
    }, re.source, re.flags);
    const el = h.asElement();
    if (!el) throw new Error(`no field after label ${re}`);
    return el;
  };
  /** Waits until an element stops moving (a smooth scroll in progress), and returns its final box. A tap at a spot
   *  read while the page was still scrolling lands on whatever slid under it — on a long form the Save button was
   *  "pressed" on a label above it and the scene never moved on. */
  u.settle = async (el) => {
    let last = null, still = 0;
    for (let i = 0; i < 50; i++) {
      const b = await el.boundingBox();
      if (b && last && Math.abs(b.y - last.y) < 0.5 && Math.abs(b.x - last.x) < 0.5) { if (++still >= 3) return b; } else still = 0;
      last = b; await pause(100);
    }
    return last;
  };
  /** A tap the viewer can see: a ripple at the spot, then the touch. */
  u.tap = async (target, o) => {
    const el = typeof target === "function" ? await target() : typeof target === "string" ? await page.waitForSelector(target, { visible: true, timeout: 15000 }) : target;
    let b = null, x = 0, y = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      await el.evaluate((e, smooth) => e.scrollIntoView({ block: "center", behavior: smooth ? "smooth" : "instant" }), attempt === 0);
      b = await u.settle(el); if (!b) throw new Error("tap: element has no box");
      x = b.x + b.width / 2; y = b.y + Math.min(b.height / 2, 28);
      // is the element itself (or something inside it) at that spot, not a bar or label sitting over it?
      const hit = await el.evaluate((e, x, y) => { const t = document.elementFromPoint(x, y); return !!t && (e === t || e.contains(t) || t.contains(e)); }, x, y);
      if (hit) break;
    }
    await page.evaluate((x, y) => window.__ripple?.(x, y), x, y); await pause(180);
    await page.touchscreen.tap(x, y); await pause(o?.settle ?? 500);
  };
  u.tapText = async (text, o = {}) => u.tap(await u.findText(text, o), o);
  /** Taps a button and waits for what it should bring up; taps once more when nothing came (a tap that missed). */
  u.tapThen = async (text, expect, { timeout = 20000, tries = 2, ...o } = {}) => {
    for (let i = 0; i < tries; i++) {
      if (i && await page.evaluate((t) => !!document.body?.innerText?.includes(t), expect).catch(() => false)) return;
      await u.tapText(text, o);
      try { await u.waitText(expect, i === tries - 1 ? timeout : Math.min(9000, timeout)); return; }
      catch (e) { if (i === tries - 1) throw e; }
    }
  };
  /** Taps a field and types into it, replacing whatever was in it (the city, for one, is filled from the home city). */
  u.type = async (target, text) => {
    await u.tap(target, { settle: 250 });
    await page.evaluate(() => { const a = document.activeElement; if (a && typeof a.select === "function") a.select(); });
    await page.keyboard.type(text, { delay: 55 }); await pause(350);
  };
  u.scrollBy = async (dy, ms) => { const steps = Math.max(4, Math.round(ms / 120)); for (let i = 0; i < steps; i++) { await page.evaluate((d) => window.scrollBy({ top: d, behavior: "auto" }), dy / steps); await pause(ms / steps); } };
  /** Signs the phone into the account through the app's own "Login as" page, then opens the app. */
  u.login = async () => {
    const t = await magicToken(email);
    await page.goto(`${SITE}/auth/as?t=${encodeURIComponent(t)}&n=${encodeURIComponent("Rajesh")}`, { waitUntil: "networkidle2", timeout: 60000 });
    await page.waitForFunction(() => !location.pathname.startsWith("/auth/"), { timeout: 30000 });
    await page.evaluate(() => { localStorage.removeItem("shubhora.admin.return"); }); // no "Back to admin" bar in the video
    await pause(500);
  };
  /** Removes the account's cards (an earlier attempt's build leaves one): a build made again then starts from nothing. */
  u.dropCards = async () => {
    const r = await fetch(`${SUPA}/rest/v1/cards?owner_id=eq.${uid}`, { method: "DELETE", headers: { ...H, Prefer: "return=representation" } });
    const j = await r.json().catch(() => []);
    log(`removed ${Array.isArray(j) ? j.length : 0} card(s) left by an earlier attempt`);
  };
  u.cardSlug = async () => {
    const r = await fetch(`${SUPA}/rest/v1/cards?owner_id=eq.${uid}&select=username&order=created_at.desc&limit=1`, { headers: H });
    const j = await r.json(); const slug = j?.[0]?.username; if (!slug) throw new Error("no card found after save"); return slug;
  };
  u.shot = async (name) => { try { await page.screenshot({ path: path.join(work, `${name}.png`) }); fs.writeFileSync(path.join(work, `${name}.txt`), await page.evaluate(() => document.body.innerText)); } catch { /* ignore */ } };
  return u;
}

/* ============================== record ============================== */
async function record(t, work) {
  const resuming = !!RESUME;
  if (!USER) throw new Error("--user <demo account: login email, contact email or username> is needed");
  for (const [k, v] of Object.entries({ NEXT_PUBLIC_SUPABASE_URL: SUPA, SUPABASE_SERVICE_ROLE_KEY: KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, GEMINI_API_KEY: GEMINI })) if (!v) throw new Error(`${k} missing in .env.local`);
  if (!fs.existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} (CHROME_PATH)`);
  const user = await findUser(USER);
  const LOGIN = user.email;   // what the account really signs in with (may differ from --user)
  log(`account ${LOGIN} (${user.id})`);
  const planBefore = await readPlan(user.id);
  const planName = planNow(planBefore);
  if (planName !== "free" && !flag("--free") && !flag("--allow-paid"))
    throw new Error(`this account is on a PAID plan (${planName}). A Free owner's site has stock photos, no video clip and no AI banner, so a "free website" video recorded here would show things a free owner never gets.\n  Add --free (the plan is set to Free for the recording and put back afterwards), or --allow-paid to record the Premium site as it is.`);
  if (!flag("--no-reset") && !resuming) {
    const r = await fetch(`${SITE}/api/demo/reset`, { method: "POST", headers: { Authorization: `Bearer ${await bearerFor(LOGIN)}`, "Content-Type": "application/json" }, body: "{}" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && r.status !== 207) throw new Error(`could not reset the demo account (${r.status}): ${j.error || ""} — mark it as the demo account in Super Admin → Users, or pass --no-reset`);
    log("demo account reset:", JSON.stringify(j.cleared ?? {}));
  }
  // The narration first, all at once: the clips are only as long as the words need.
  const scenes = t.scenes(null);
  // One voice clip per sentence: a scene can then start each sentence at the moment its action shows on screen (u.cue).
  const voices = [];
  for (let i = 0; i < scenes.length; i += 4) voices.push(...await Promise.all(scenes.slice(i, i + 4).map(async (s) => {
    const parts = await Promise.all(sentencesOf(s.say).map(async (text) => ({ text, ...(await tts(text)) })));
    return { parts, seconds: parts.reduce((a, p) => a + p.seconds + 0.3, 0) };
  })));
  for (const [i, v] of voices.entries()) for (const p of v.parts) if (p.seconds > p.text.length * 0.16 + 2.5) log(`!! voice line is unusually long (${p.seconds.toFixed(1)} s for ${p.text.length} letters), listen to it: ${scenes[i].id} "${p.text.slice(0, 40)}"`);
  log(`voice: ${scenes.length} scenes, ${voices.reduce((a, v) => a + v.seconds, 0).toFixed(1)} s`);

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, protocolTimeout: 600000, args: ["--no-sandbox", "--disable-dev-shm-usage", "--hide-scrollbars", "--lang=en-IN", "--font-render-hinting=none", "--disable-gpu"] });
  browser.on("disconnected", () => log("!! Chrome closed"));
  const page = await browser.newPage();
  page.on("error", (e) => log("!! the page crashed:", e.message));
  await page.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1");
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.evaluateOnNewDocument(() => {
    // the tap ripple, and nothing in the picture that a real owner would not see (the demo account's Reset pill).
    // documentElement may not exist yet when this runs on a new document (the Reset pill showed in the 17 Oct 2026 recording): wait for it.
    window.__ripple = (x, y) => { const d = document.createElement("div"); d.className = "__rp"; d.style.left = `${x}px`; d.style.top = `${y}px`; document.body.appendChild(d); setTimeout(() => d.remove(), 600); };
    const inject = () => {
      const css = document.createElement("style");
      css.textContent = `button[title^="Demo account"]{display:none!important} html{scroll-behavior:auto!important} *{caret-color:#6d5dfc}
        .__rp{position:fixed;z-index:2147483647;width:52px;height:52px;margin:-26px 0 0 -26px;border-radius:50%;background:rgba(109,93,252,.45);border:2px solid rgba(109,93,252,.9);pointer-events:none;animation:__rp .55s ease-out forwards}
        @keyframes __rp{0%{transform:scale(.35);opacity:1}100%{transform:scale(1.4);opacity:0}}`;
      document.documentElement.appendChild(css);
    };
    if (document.documentElement) inject();
    else new MutationObserver((_m, o) => { if (document.documentElement) { o.disconnect(); inject(); } }).observe(document, { childList: true });
  });
  const u = ui(page, { work, email: LOGIN, uid: user.id });
  const done = [];
  const list = t.scenes(u);
  // what a failed scene looked like, in the error itself: the screen's words, the red lines, the real cause
  const failed = async (s, e, what) => {
    await u.shot(`fail-${s.id}`);
    const seen = await page.evaluate(() => (document.body?.innerText ?? "").replace(/\s*\n\s*/g, " | ").slice(0, 420)).catch(() => "");
    const errs = await page.evaluate(() => [...document.querySelectorAll(".text-danger")].map((x) => x.innerText.trim()).filter(Boolean).join(" / ").slice(0, 300)).catch(() => "");
    const cause = e.cause?.message ? `\n  cause: ${e.cause.message}` : "";
    return new Error(`scene "${s.id}"${what}: ${e.message}${cause}\n  screen said: ${seen}${errs ? `\n  errors on screen: ${errs}` : ""}\n  (picture: ${work}/fail-${s.id}.png — to carry on: node scripts/tutorial-video.mjs ${TUTORIAL} --user ${USER} --resume ${work} --from ${s.id})`);
  };
  let fromIdx = 0, kept = [];
  let flipped = false;
  const planFile = path.join(work, "plan-before.json");
  const restorePlan = async () => {
    if (!flipped) return;
    try {
      const saved = JSON.parse(fs.readFileSync(planFile, "utf8"));
      await writePlan(user.id, Object.fromEntries(PLAN_COLS.map((c) => [c, saved[c] ?? null])));
      log(`plan put back (${planNow(saved)})`); flipped = false;
    } catch (e) { log(`!! could NOT put the plan back: ${e.message} — saved values are in ${planFile}`); }
  };
  try {
  if (flag("--free") && planName === "free" && fs.existsSync(planFile)) {
    flipped = true;   // still Free from an earlier run that died before it could put the plan back: put it back at the end
    log("plan is still Free from an earlier run; it is put back at the end");
  } else if (flag("--free") && planName !== "free") {
    // the first run's values are the real ones; a carried-on run (the plan was put back after the stop) flips again
    if (!fs.existsSync(planFile)) fs.writeFileSync(planFile, JSON.stringify(planBefore, null, 1));
    await writePlan(user.id, { plan: "free", plan_expires_at: null, poster_plan: "free", poster_plan_expires_at: null, saas_expires_at: null });
    flipped = true;
    const check = planNow(await readPlan(user.id));
    if (check !== "free") throw new Error(`the plan did not change to free (still ${check})`);
    log(`plan set to Free for the recording (was ${planName}; it is put back at the end)`);
  }
  if (resuming) {
    fromIdx = list.findIndex((x) => x.id === FROM);
    if (fromIdx < 0) throw new Error(`--from "${FROM}": no such scene — one of: ${list.map((x) => x.id).join(", ")}`);
    if (!list[fromIdx].enter && !list[fromIdx].between) throw new Error(`scene "${FROM}" cannot be carried on from (it needs the screen the scene before it leaves)`);
    // progress.json lists what a run finished; a run from before it existed is rebuilt from the clips on disk
    let prev = [];
    try { prev = JSON.parse(fs.readFileSync(path.join(work, "progress.json"), "utf8")); } catch { /* none */ }
    kept = list.slice(0, fromIdx).map((x, k) => prev[k] ?? { id: x.id, say: x.say, clip: path.join(work, `${String(k + 1).padStart(2, "0")}-${x.id}.webm`), parts: voices[k].parts.map((p) => ({ text: p.text, wav: p.file, sec: p.seconds })), cues: voices[k].parts.map((_, j) => j * 3), saySec: voices[k].seconds });
    const missing = kept.filter((x) => !fs.existsSync(x.clip)).map((x) => path.basename(x.clip));
    if (missing.length) throw new Error(`the earlier run has no clip for: ${missing.join(", ")} (needed before "${FROM}")`);
    log(`carrying on from "${FROM}": ${fromIdx} scenes kept`);
  }
    for (const [i, s] of list.entries()) {
      if (i < fromIdx) { done.push(kept[i]); continue; }
      if (resuming && i === fromIdx && s.enter) { log(`${s.id}: opening the screen…`); await s.enter(); }
      else if (s.between) { log(`${s.id}: preparing…`); await s.between(); }
      const clip = path.join(work, `${String(i + 1).padStart(2, "0")}-${s.id}.webm`);
      log(`${s.id}: recording (${voices[i].seconds.toFixed(1)} s of words, ${voices[i].parts.length} sentences)`);
      const rec = await page.screencast({ path: clip, ffmpegPath: FFMPEG });
      const t0 = Date.now(), now = () => Date.now() - t0, parts = voices[i].parts, cues = [];
      let spokenTill = 0;
      // u.cue(k): sentence k starts now, but never over the one before it.
      u.cue = async (k) => {
        if (cues[k] !== undefined || !parts[k]) return;
        const wait = spokenTill + 300 - now(); if (wait > 0) await pause(wait);
        cues[k] = now() / 1000; spokenTill = now() + parts[k].seconds * 1000;
      };
      try { await s.act(); }
      catch (e) { await rec.stop().catch(() => undefined); throw await failed(s, e, ""); }
      if (!cues.length) { let c = 0; parts.forEach((p, k) => { cues[k] = c; c += p.seconds + 0.3; }); spokenTill = c * 1000; }   // a scene with no cues: the words run from its start
      else for (let k = 0; k < parts.length; k++) await u.cue(k);
      const left = spokenTill + 800 - now();
      if (left > 0) await pause(left);
      await rec.stop();
      done.push({ id: s.id, say: s.say, clip, parts: parts.map((p) => ({ text: p.text, wav: p.file, sec: p.seconds })), cues, saySec: voices[i].seconds });
      fs.writeFileSync(path.join(work, "progress.json"), JSON.stringify(done, null, 1));
      if (s.after) { log(`${s.id}: waiting…`); try { await s.after(); } catch (e) { throw await failed(s, e, " (while waiting)"); } }
    }
  } finally { await browser.close().catch(() => undefined); await restorePlan(); }
  fs.writeFileSync(path.join(work, "scenes.json"), JSON.stringify({ tutorial: TUTORIAL, title: t.title, subtitle: t.subtitle, scenes: done }, null, 1));
  return done;
}

/* ============================== compose ============================== */
const LAYOUTS = {
  phone: { W: 1080, H: 1920, screen: { x: 212, y: 190, w: 656, h: 1420 }, cap: { width: 960, size: 44, x: 60, y: 1650 }, title: { x: 540, y: 112, anchor: "middle", size: 54 }, logo: { x: 40, y: 40, size: 72 } },
  wide: { W: 1920, H: 1080, screen: { x: 150, y: 70, w: 434, h: 940 }, cap: { width: 1100, size: 46, x: 700, y: 560 }, title: { x: 700, y: 300, anchor: "start", size: 76 }, logo: { x: 700, y: 120, size: 110 } },
};
// A short heading for each scene of the card+website video, shown as a pill under the title with a progress bar along the top.
const HEADS = {
  intro: "शुरुआत", signup: "1 · Account बनाइए", you: "2 · आपके बारे में", promote: "3 · किसके लिए", site: "3 · किसके लिए", business: "4 · Business का नाम",
  details: "5 · क्या ख़ास है", where: "6 · पता और timing", about: "7 · About", make: "8 · Website बनाइए", preview: "9 · Website तैयार", designs: "10 · Design चुनिए",
  colours: "11 · रंग और style", live: "12 · Save करें", products: "13 · Products जोड़ें", livesite: "14 · Live website", premium: "15 · Premium website",
  premiumdesign: "15 · Premium website", premiumlive: "16 · Premium live", outro: "shubhora.com · Free शुरू करें",
};
async function headPng(file, W, H, { label, frac, y }) {
  const w = Math.max(280, Math.round(label.length * 30 + 90)), h = 50, x = Math.round((W - w) / 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <rect x="0" y="0" width="${W}" height="10" fill="#ffffff" fill-opacity="0.12"/>
    <rect x="0" y="0" width="${Math.max(12, Math.round(W * frac))}" height="10" fill="#ffb454"/>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="25" fill="#6d5dfc"/>
    <text x="${W / 2}" y="${y + 35}" text-anchor="middle" font-family="${FONT}" font-size="30" font-weight="700" fill="#ffffff">${esc(label)}</text>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(file);
}
async function compose(work, outDir) {
  const meta = JSON.parse(fs.readFileSync(path.join(work, "scenes.json"), "utf8"));
  const scenes = meta.scenes;
  // The clips' real lengths (the recorder's, not the stopwatch's), the captions' timing, one audio track.
  let at = 0; const pcm = [];
  for (const s of scenes) {
    const p = probe(s.clip); s.dur = p.seconds; s.start = at; at += p.seconds;
    const want = Math.round(p.seconds * 24000) * 2;
    if (s.parts && s.cues) {
      // each sentence's voice is placed at the moment the recorder began it, so words and screen match; its caption stays up until the next sentence starts
      const buf = Buffer.alloc(want);
      s.parts.forEach((q, k) => { const w = fs.readFileSync(q.wav).subarray(44); const off = Math.round(s.cues[k] * 24000) * 2; if (off < want) w.copy(buf, off, 0, Math.min(w.length, want - off)); });
      pcm.push(buf);
      s.caps = s.parts.map((q, k) => ({ text: q.text, from: s.start + s.cues[k], to: k === s.parts.length - 1 ? s.start + s.dur : s.start + s.cues[k + 1] }));
      continue;
    }
    const wav = fs.readFileSync(s.wav).subarray(44);
    pcm.push(wav.length >= want ? wav.subarray(0, want) : Buffer.concat([wav, Buffer.alloc(want - wav.length)]));
    // one caption per sentence, each on screen for its share of the spoken time; the last stays till the clip ends
    const parts = s.say.split(/(?<=[।!?.])\s+/).filter(Boolean);
    const chars = parts.reduce((a, x) => a + x.length, 0);
    let c = s.start; s.caps = parts.map((text, i) => { const d = (text.length / chars) * s.saySec; const cap = { text, from: c, to: i === parts.length - 1 ? s.start + s.dur : c + d }; c += d; return cap; });
  }
  const total = at;
  const audio = path.join(work, "voice.wav"); const body = Buffer.concat(pcm); fs.writeFileSync(audio, Buffer.concat([wavHeader(body.length), body]));
  const slug = meta.tutorial;
  fs.mkdirSync(outDir, { recursive: true });
  const outs = [];
  for (const [name, L] of Object.entries(LAYOUTS).filter(([k]) => k === "phone" || flag("--wide"))) {
    const bg = path.join(work, `bg-${name}.png`), frame = path.join(work, `frame-${name}.png`);
    await backgroundPng(bg, L.W, L.H, { title: meta.title, subtitle: name === "phone" && meta.tutorial === "cardsite" ? "" : meta.subtitle, logo: L.logo, titleAt: L.title, size: L.title.size });
    await framePng(frame, L.W, L.H, L.screen);
    const caps = [];
    for (const [i, s] of scenes.entries()) for (const [j, c] of s.caps.entries()) {
      const file = path.join(work, `cap-${name}-${i}-${j}.png`);
      const size = await captionPng(file, c.text, L.cap);
      caps.push({ file, from: c.from, to: c.to, x: L.cap.x, y: L.cap.y, h: size.h });
    }
    const heads = [];
    if (name === "phone" && meta.tutorial === "cardsite") for (const [i, s] of scenes.entries()) {
      const label = HEADS[s.id]; if (!label) continue;
      const file = path.join(work, `head-${i}.png`);
      await headPng(file, L.W, L.H, { label, frac: (i + 1) / scenes.length, y: 138 });
      heads.push({ file, from: s.start, to: s.start + s.dur });
    }
    const inputs = ["-i", bg, ...scenes.flatMap((s) => ["-i", s.clip]), "-i", frame, ...caps.flatMap((c) => ["-i", c.file]), ...heads.flatMap((x) => ["-i", x.file]), "-i", audio];
    const n = scenes.length;
    let f = scenes.map((_, i) => `[${i + 1}:v]scale=${L.screen.w}:${L.screen.h}:flags=lanczos,fps=30,format=yuv420p,setsar=1[c${i}]`).join(";") + ";";
    f += scenes.map((_, i) => `[c${i}]`).join("") + `concat=n=${n}:v=1:a=0[scr];`;
    f += `[0:v][scr]overlay=${L.screen.x}:${L.screen.y}[v0];[v0][${n + 1}:v]overlay=0:0[v1]`;
    let last = "v1";
    caps.forEach((c, k) => { const idx = n + 2 + k; f += `;[${last}][${idx}:v]overlay=${c.x}:${c.y}:enable='between(t,${c.from.toFixed(2)},${c.to.toFixed(2)})'[v${k + 2}]`; last = `v${k + 2}`; });
    const out = path.join(outDir, `${slug}-${name}.mp4`);
    heads.forEach((c, k) => { const idx = n + 2 + caps.length + k; f += `;[${last}][${idx}:v]overlay=0:0:enable='between(t,${c.from.toFixed(2)},${c.to.toFixed(2)})'[h${k}]`; last = `h${k}`; });
    log(`${name}: ${L.W}x${L.H}, ${total.toFixed(1)} s, ${caps.length} captions → ${out}`);
    ff([...inputs, "-filter_complex", f, "-map", `[${last}]`, "-map", `${n + 2 + caps.length + heads.length}:a`, "-c:v", "libx264", "-preset", "medium", "-crf", "20", "-pix_fmt", "yuv420p", "-r", "30", "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", out], name);
    outs.push(out);
  }
  fs.writeFileSync(path.join(outDir, `${slug}.json`), JSON.stringify({ title: meta.title, seconds: Math.round(total), made: new Date().toISOString(), scenes: scenes.map((s) => ({ id: s.id, start: Math.round(s.start), say: s.say })) }, null, 1));
  return outs;
}

/* ============================== main ============================== */
const RUN_DIRECT = !!process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (RUN_DIRECT) try {
  const t = TUTORIALS[TUTORIAL];
  if (!t) throw new Error(`unknown tutorial "${TUTORIAL}" — one of: ${Object.keys(TUTORIALS).join(", ")}`);
  let work = COMPOSE_ONLY || RESUME;
  if (RESUME && !FROM) throw new Error("--resume needs --from <scene>");
  if (!COMPOSE_ONLY) {
    if (!work) {
      work = path.join(os.tmpdir(), "shubhora-tutorial", `${TUTORIAL}-${new Date().toISOString().replace(/[:.]/g, "-")}`);
      fs.mkdirSync(work, { recursive: true });
    }
    log(`work: ${work}`);
    await record(t, work);
  }
  if (flag("--record-only")) { console.log(`\nrecorded. To put it together (run it on its own, at low priority): nice -n 19 node scripts/tutorial-video.mjs ${TUTORIAL} --compose ${work}`); process.exit(0); }
  const outs = await compose(work, OUT);
  console.log("\ndone:");
  for (const o of outs) console.log(`  ${o}  →  ${SITE}/tutorials/${path.basename(o)}`);
  console.log(`\nTo change only the layout or captions: node scripts/tutorial-video.mjs ${TUTORIAL} --compose ${work}`);
} catch (e) {
  console.error(`\nERROR: ${e.message}${e.cause?.message && !String(e.message).includes(e.cause.message) ? `\n  cause: ${e.cause.message}` : ""}`);
  process.exitCode = 1;
}
// Whatever happened, the command ends: a child process left running (Chrome, ffmpeg) would keep it hanging.
if (RUN_DIRECT) setTimeout(() => process.exit(process.exitCode ?? 0), 500);
