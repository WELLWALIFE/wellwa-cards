"use client";
// UI language for the Shubhora app (Hindi / English). Poster text language is
// per-profile (`lang`); this is only the app chrome. Stored per device.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UiLang = "hi" | "en";
const KEY = "akp-ui-lang";

const STR = {
  hi: {
    appName: "Shubhora",
    today: "आज", history: "पुराने", profiles: "प्रोफ़ाइल", settings: "सेटिंग",
    heroTitle: "आपका business,\nऑनलाइन — 5 मिनट में।",
    heroSub: "Digital visiting card, आपकी अपनी website, रोज़ सुबह आपके नाम का poster और WhatsApp पर customers को AI से जवाब — सब एक app में, आपकी profile से अपने-आप तैयार।",
    f1: "Digital V-Card और website, आपके अपने link पर", f2: "रोज़ नया poster — त्योहार, जयंती, good morning — आपके नाम, फ़ोटो और नंबर के साथ", f3: "WhatsApp पर AI assistant: customers को 24×7 जवाब, हर chat lead में save",
    startFree: "शुरू करें — Free", makeProfile: "अपनी profile बनाएँ", haveAccount: "पहले से खाता है?", login: "लॉग इन करें",
    todayPoster: "आज का पोस्टर", making: "आपका पोस्टर बन रहा है…", quotaTitle: "आज का free poster बन चुका",
    quotaSub: "बिना branding के poster, preview और status video — ₹2,999/माह (GST सहित) में, WhatsApp AI के साथ।", seePlans: "प्लान देखें",
    freeLine: (u: number, l: number) => `Free plan: आज ${u}/${l} poster ·`, wantDaily: "branding हटाएँ?", error: "कुछ गड़बड़ हुई।",
    shareWa: "WhatsApp पर भेजें", sent: "भेज दिया!", downloaded: "डाउनलोड हो गया", download: "Download", regen: "दोबारा बनाएँ",
    postFbIg: "Facebook / Instagram पर post करें", connectFbIg: "Facebook / Instagram जोड़ें", whereToPost: "कहाँ post करें?", post: "Post करें", posting: "Post हो रहा है…", posted: "Post हो गया!", postFailed: "Post नहीं हुआ।", caption: "Caption",
    setupTitle: "60 सेकंड में सेटअप", setupSub: "एक बार भर दें — फिर रोज़ सुबह आपका पोस्टर तैयार मिलेगा।", makeMine: "मेरा पोस्टर बनाओ",
    setupNote: "आगे बढ़ने पर आपको login/signup करना होगा (mobile number + password)। आपकी जानकारी सिर्फ़ आपके poster पर ही इस्तेमाल होती है।", saveFail: "Profile save नहीं हुआ।",
    whoAreYou: "आप कौन हैं?", yourPhoto: "आपकी फ़ोटो", photoHint: "Poster पर गोल फ़ोटो आएगी। साफ़ चेहरा, अच्छी रोशनी।", name: "नाम", namePh: "जैसे: राजेश कुमार",
    mobile: "मोबाइल नंबर", onPoster: "(poster पर दिखेगा)", logo: "लोगो", optional: "(optional)", logoHint: "Poster के नीचे दाईं ओर आएगा।", posterLang: "पोस्टर की भाषा", uploadFail: "Photo upload नहीं हुई। Login करके दोबारा try करें।",
    back: "← वापस", editProfile: "प्रोफ़ाइल बदलें", newProfile: "नया प्रोफ़ाइल", save: "सेव करें", addProfile: "प्रोफ़ाइल जोड़ें", add: "जोड़ें",
    profilesHint: "एक खाते में 5 तक profile — पूरे परिवार के लिए। हर profile का अपना रोज़ का poster।", makeDefault: "Default बनाएँ", removeProfile: (n: string) => `"${n}" profile हटा दें? इसके पुराने poster भी चले जाएँगे।`,
    oldPosters: "पुराने पोस्टर", noPosters: "अभी कोई poster नहीं।", makeToday: "आज का बनाएँ", share: "share",
    plan: "प्लान", yours: "(आपका)", planHelp: "Plan लेने के लिए WhatsApp पर लिखें:", planSoon: "(online payment जल्द आ रहा है)",
    payNow: (price: string) => `${price} — अभी लें`, payVerifying: "Payment check हो रही है…", payUnavailable: "Online payment अभी उपलब्ध नहीं है।", payLoadFail: "Payment gateway load नहीं हुआ।", payVerifyFail: "Payment verify नहीं हुई। पैसे कटे हों तो WhatsApp पर बताएँ।",
    planValidTill: "Plan valid till", payFallback: "Payment में दिक्कत हो तो WhatsApp पर लिखें:",
    referTitle: "दोस्त को जोड़ें, दोनों को 1 महीना मुफ़्त", copy: "Copy", profilesLang: "प्रोफ़ाइल और भाषा", bizTools: "Business tools (WhatsApp AI, digital card)", logout: "लॉग आउट",
    uiLang: "App की भाषा", privacy: "Privacy",
    socialTitle: "Facebook / Instagram", socialHint: "एक बार connect करें — फिर हर poster एक tap में आपके Facebook Page और Instagram पर post होगा।", addMore: "और account जोड़ें",
    socialSoon: "यह feature अभी setup हो रहा है — कुछ दिनों में चालू होगा।", connected: (n: string) => `✅ Connect हो गया (${n} account)।`, connectFail: (r: string) => `⚠️ Connect नहीं हुआ: ${r}`, connectErr: "Connect नहीं हो पाया। थोड़ी देर बाद try करें।", reconnect: "⚠️ दोबारा connect करें", removeAcct: "इस account को हटाएँ?", fbPage: "Facebook Page",
    // v2 tabs
    tabHome: "होम", tabCard: "बनाएँ", tabLeads: "ग्राहक", tabSocial: "सोशल", tabBusiness: "Business", tabMore: "मेरा",
    quickCard: "मेरा V-Card", quickLeads: "लीड्स", quickSocial: "सोशल", quickVideo: "AI वीडियो",
    cardTitle: "मेरा V-Card", cardNone: "अभी आपका कार्ड नहीं बना। एक tap में बनाएँ — नाम, फ़ोटो, नंबर profile से आ जाएगा।", createCard: "मेरा कार्ड बनाएँ", creating: "बन रहा है…",
    openCard: "कार्ड खोलें", editCard: "कार्ड edit करें", copyLink: "Link copy", copied: "Copy हो गया!", shareCard: "WhatsApp पर share करें", showQr: "QR code", cardViews: (n: number) => `${n} बार देखा गया`,
    shareText: (name: string, url: string) => `नमस्ते! मेरा डिजिटल कार्ड देखें — ${name}\n${url}`, cardFail: "कार्ड नहीं बन पाया। दोबारा try करें।",
    leadsTab: "लीड्स", waTab: "WhatsApp AI", bizOnly: "यह feature Business plan में है।", 
    socialTitle2: "सोशल मीडिया", fbTab: "Facebook", igTab: "Instagram",
    connectFb: "Facebook Page जोड़ें", connectIg: "Instagram जोड़ें", pickOne: "कौन-सा account इस app से जुड़े? (सिर्फ़ एक)", choose: "चुनें", changeAcct: "बदलें", disconnect: "हटाएँ",
    autoPost: "रोज़ सुबह 4 बजे auto-post", autoPostHint: "आज का poster अपने-आप इस account पर post होगा।", postNow: "आज का poster अभी post करें", postHistory: "Post history", noPosts: "अभी कोई post नहीं।",
    igNone: "कोई Instagram Professional account नहीं मिला। Instagram app → Settings → Account type → Professional करें, फिर उसे अपने Facebook Page से link करें और दोबारा try करें।",
    fbNone: "कोई Facebook Page नहीं मिला। पहले facebook.com पर एक Page बनाएँ।", notConnected: "अभी जुड़ा नहीं है",
    posterMode: "रोज़ का poster किस तरह का?", modeGreeting: "शुभकामना poster", modeGreetingSub: "त्योहार / गुड-मॉर्निंग art + आपका नाम-नंबर", modeProduct: "प्रोडक्ट poster", modeProductSub: "रोज़ आपका product + खूबी/ऑफ़र (Products में add करें)",
    productsTitle: "मेरे प्रोडक्ट", productsHint: "इनमें से रोज़ एक product और एक खूबी बारी-बारी से poster पर आएगी।", addProduct: "प्रोडक्ट जोड़ें", productName: "प्रोडक्ट का नाम", benefitsHint: "खूबियाँ / ऑफ़र लाइनें (हर लाइन अलग दिन)", offerLabel: "ऑफ़र (optional)", productPhoto: "प्रोडक्ट फ़ोटो", waStatusTab: "WhatsApp Status", waStatusHint: "रोज़ सुबह poster आपके WhatsApp Status पर लगेगा (WhatsApp AI connected होना चाहिए)।", waStatusOn: "रोज़ Status पर लगाओ",
    moreTitle: "मेरा account", studio: "AI Studio (video / reels)", dashboard: "पूरा Dashboard (computer view)", analytics: "Analytics",
    plans: [
      { key: "free", name: "Free", price: "₹0", lines: ["हफ़्ते में 3 poster", "छोटा watermark", "1 profile"] },
      { key: "personal", name: "Personal", price: "₹199/माह", lines: ["रोज़ नया poster", "बिना watermark", "5 profile (परिवार)", "सभी भाषाएँ"] },
      { key: "business", name: "Business", price: "₹499/माह", lines: ["Personal का सब कुछ", "WhatsApp AI जवाब + leads", "Digital card", "Team broadcast"] },
    ],
    personas: { business: ["व्यापारी / दुकानदार", "दुकान, showroom, distributor, agency", "दुकान / कंपनी का नाम"], personal: ["व्यक्तिगत", "परिवार, दोस्त, त्योहार की शुभकामनाएँ", "जैसे: सपरिवार"], home: ["घर से व्यवसाय", "Tiffin, boutique, beauty, tuition, kitty", "जैसे: रीना का किचन"], community: ["समाज / संगठन / राजनीति", "समिति, संगठन, party, NGO", "पद और संगठन का नाम"], student: ["छात्र / बच्चे", "School, college — सिर्फ़ greetings, safe", "स्कूल / कक्षा"], professional: ["प्रोफ़ेशनल / नौकरी", "Doctor, CA, engineer, manager, teacher", "पद और कंपनी"] } as Record<string, [string, string, string]>,
  },
  en: {
    appName: "Shubhora",
    today: "Today", history: "History", profiles: "Profiles", settings: "Settings",
    heroTitle: "Your business, online —\nin 5 minutes.",
    heroSub: "A digital visiting card, your own website, a poster with your name every morning and an AI that answers your customers on WhatsApp — all in one app, made from your profile.",
    f1: "Digital V-Card and website on your own link", f2: "A new poster every day — festivals, jayantis, good morning — with your name, photo and number", f3: "WhatsApp AI assistant: answers customers 24×7, every chat saved as a lead",
    startFree: "Get started — free", makeProfile: "Create your profile", haveAccount: "Already have an account?", login: "Log in",
    todayPoster: "Today's poster", making: "Making your poster…", quotaTitle: "Today's free poster is made",
    quotaSub: "Posters without branding, previews and status videos — ₹2,999/month incl. GST, with WhatsApp AI.", seePlans: "See plans",
    freeLine: (u: number, l: number) => `Free plan: ${u}/${l} poster today ·`, wantDaily: "remove the branding?", error: "Something went wrong.",
    shareWa: "Send on WhatsApp", sent: "Sent!", downloaded: "Downloaded", download: "Download", regen: "Regenerate",
    postFbIg: "Post to Facebook / Instagram", connectFbIg: "Connect Facebook / Instagram", whereToPost: "Where to post?", post: "Post", posting: "Posting…", posted: "Posted!", postFailed: "Post failed.", caption: "Caption",
    setupTitle: "Set up in 60 seconds", setupSub: "Fill this once — your poster will be ready every morning.", makeMine: "Make my poster",
    setupNote: "You'll be asked to log in / sign up next (mobile number + password). Your details are used only on your poster.", saveFail: "Could not save the profile.",
    whoAreYou: "Who are you?", yourPhoto: "Your photo", photoHint: "Shown as a round photo on the poster. Clear face, good light.", name: "Name", namePh: "e.g. Rajesh Kumar",
    mobile: "Mobile number", onPoster: "(shown on the poster)", logo: "Logo", optional: "(optional)", logoHint: "Appears at the bottom right of the poster.", posterLang: "Poster language", uploadFail: "Photo upload failed. Log in and try again.",
    back: "← Back", editProfile: "Edit profile", newProfile: "New profile", save: "Save", addProfile: "Add profile", add: "Add",
    profilesHint: "Up to 5 profiles per account — for the whole family. Each profile gets its own daily poster.", makeDefault: "Make default", removeProfile: (n: string) => `Delete the "${n}" profile? Its old posters will go too.`,
    oldPosters: "Past posters", noPosters: "No posters yet.", makeToday: "Make today's", share: "shares",
    plan: "Plan", yours: "(yours)", planHelp: "To get a plan, message us on WhatsApp:", planSoon: "(online payment coming soon)",
    payNow: (price: string) => `Get for ${price}`, payVerifying: "Checking payment…", payUnavailable: "Online payment is not available right now.", payLoadFail: "Could not load the payment gateway.", payVerifyFail: "Payment could not be verified. If money was deducted, message us on WhatsApp.",
    planValidTill: "Plan valid till", payFallback: "Trouble paying? Message us on WhatsApp:",
    referTitle: "Invite a friend, both get 1 month free", copy: "Copy", profilesLang: "Profiles & language", bizTools: "Business tools (WhatsApp AI, digital card)", logout: "Log out",
    uiLang: "App language", privacy: "Privacy",
    socialTitle: "Facebook / Instagram", socialHint: "Connect once — then every poster posts to your Facebook Page and Instagram in one tap.", addMore: "Add another account",
    socialSoon: "This feature is being set up — available in a few days.", connected: (n: string) => `✅ Connected (${n} accounts).`, connectFail: (r: string) => `⚠️ Could not connect: ${r}`, connectErr: "Could not connect. Please try again later.", reconnect: "⚠️ reconnect needed", removeAcct: "Remove this account?", fbPage: "Facebook Page",
    // v2 tabs
    tabHome: "Home", tabCard: "Create", tabLeads: "Customers", tabSocial: "Social", tabBusiness: "Business", tabMore: "Me",
    quickCard: "My V-Card", quickLeads: "Leads", quickSocial: "Social", quickVideo: "AI video",
    cardTitle: "My V-Card", cardNone: "You don't have a V-Card yet — your digital visiting card. The AI makes it from your details.", createCard: "Create my V-Card", creating: "Creating…",
    openCard: "Open V-Card", editCard: "Edit V-Card", copyLink: "Copy link", copied: "Copied!", shareCard: "Share on WhatsApp", showQr: "QR code", cardViews: (n: number) => `${n} views`,
    shareText: (name: string, url: string) => `Hi! Here is my digital card — ${name}\n${url}`, cardFail: "Could not create the card. Please try again.",
    leadsTab: "Leads", waTab: "WhatsApp AI", bizOnly: "This feature is in the Business plan.",
    socialTitle2: "Social media", fbTab: "Facebook", igTab: "Instagram",
    connectFb: "Connect Facebook Page", connectIg: "Connect Instagram", pickOne: "Which account should this app use? (only one)", choose: "Choose", changeAcct: "Change", disconnect: "Remove",
    autoPost: "Auto-post every morning at 4 AM", autoPostHint: "Today's poster will be posted to this account automatically.", postNow: "Post today's poster now", postHistory: "Post history", noPosts: "No posts yet.",
    igNone: "No Instagram Professional account found. In the Instagram app go to Settings → Account type → Professional, link it to your Facebook Page, then try again.",
    fbNone: "No Facebook Page found. Create a Page on facebook.com first.", notConnected: "Not connected yet",
    posterMode: "Daily poster type", modeGreeting: "Greeting poster", modeGreetingSub: "Festival / good-morning art + your name & number", modeProduct: "Product poster", modeProductSub: "Your product + a benefit/offer every day (add under Products)",
    productsTitle: "My products", productsHint: "One product and one benefit line rotate onto the poster every day.", addProduct: "Add product", productName: "Product name", benefitsHint: "Benefit / offer lines (a different one each day)", offerLabel: "Offer (optional)", productPhoto: "Product photo", waStatusTab: "WhatsApp Status", waStatusHint: "Every morning the poster is posted to your WhatsApp Status (WhatsApp AI must be connected).", waStatusOn: "Post to Status daily",
    moreTitle: "My account", studio: "AI Studio (video / reels)", dashboard: "Full dashboard (desktop view)", analytics: "Analytics",
    plans: [
      { key: "free", name: "Free", price: "₹0", lines: ["3 posters a week", "small watermark", "1 profile"] },
      { key: "personal", name: "Personal", price: "₹199/mo", lines: ["New poster daily", "No watermark", "5 profiles (family)", "All languages"] },
      { key: "business", name: "Business", price: "₹499/mo", lines: ["Everything in Personal", "WhatsApp AI replies + leads", "Digital card", "Team broadcast"] },
    ],
    personas: { business: ["Business / Shop", "Shop, showroom, distributor, agency", "Shop / company name"], personal: ["Personal", "Family, friends, festival wishes", "e.g. with family"], home: ["Home business", "Tiffin, boutique, beauty, tuition, kitty", "e.g. Reena's Kitchen"], community: ["Community / Politics", "Samiti, organisation, party, NGO", "Designation and organisation"], student: ["Student / Kids", "School, college — greetings only, safe", "School / class"], professional: ["Professional / Job", "Doctor, CA, engineer, manager, teacher", "Designation and company"] } as Record<string, [string, string, string]>,
  },
};
export type Strings = typeof STR.hi;

const Ctx = createContext<{ lang: UiLang; setLang: (l: UiLang) => void; t: Strings }>({ lang: "hi", setLang: () => {}, t: STR.hi });

export function UiLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("en");
  useEffect(() => { try { const v = localStorage.getItem(KEY); if (v === "en" || v === "hi") setLangState(v); } catch { /* ignore */ } }, []);
  const setLang = (l: UiLang) => { setLangState(l); try { localStorage.setItem(KEY, l); } catch { /* ignore */ } };
  return <Ctx.Provider value={{ lang, setLang, t: STR[lang] as Strings }}>{children}</Ctx.Provider>;
}
export function useT() { return useContext(Ctx); }

/** Small हिं / EN pill. */
export function LangToggle({ className = "" }: { className?: string }) {
  const { lang, setLang } = useT();
  return (
    <div className={`inline-flex rounded-full border border-border bg-surface p-0.5 text-xs font-semibold ${className}`} role="group" aria-label="Language">
      {(["hi", "en"] as UiLang[]).map((l) => (
        <button key={l} type="button" onClick={() => setLang(l)} className={`rounded-full px-2.5 py-1 ${lang === l ? "grad-brand text-white" : "text-muted"}`}>{l === "hi" ? "हिं" : "EN"}</button>
      ))}
    </div>
  );
}
