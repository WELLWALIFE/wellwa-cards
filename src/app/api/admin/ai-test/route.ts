// Super Admin → Shubhora AI → "Test chats": the new partner assistant (bridge/shubhora-agent.mjs, the same code the
// WhatsApp bridge runs) answers scripted conversations with the real AI model — on the server only. Nothing is
// sent to anybody and nothing is saved; the owner reads the transcripts before switching the new AI on.
import { NextResponse } from "next/server";
import { adminAllowed } from "@/lib/admin-guard";
import { fetchCloudCard } from "@/lib/supabase/public";
import { getPlatformKnowledge } from "@/lib/platform";
import { agentCardLookup, agentComplete, agentContext, type AgentMsg } from "@/lib/shubhora-agent-web";
import { isShubhoraCard } from "../../../../../bridge/shubhora-kb.mjs";
import { agentFollowup, agentTurn } from "../../../../../bridge/shubhora-agent.mjs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// A customer's card as the database would have it, for the card-check scenario: live, but with the usual gaps (a
// sample email left in, a product without price or photo, no address, a stock picture in the gallery). Any other card
// link in a test is opened for real.
const SAMPLE_USERNAME = "ramesh-kirana";
const SAMPLE_LINK = `https://shubhora.com/c/${SAMPLE_USERNAME}`;
const SAMPLE_CARD = {
  username: SAMPLE_USERNAME, name: "Ramesh Gupta", company: "Ramesh Kirana Store", avatarUrl: "https://shubhora.com/icon-512.png", coverUrl: "",
  about: "Daily grocery, dal, rice, oil and snacks at the best rates in Sector 5, delivered free above ₹500.",
  links: [{ type: "whatsapp", value: "+91 98765 43210" }, { type: "email", value: "you@example.com" }],
  pages: [{ slug: "home", blocks: [
    { kind: "product", items: [{ name: "Basmati rice 5 kg", price: "₹450", images: ["https://shubhora.com/icon-512.png"] }, { name: "Mustard oil 1 L", price: "" }] },
    { kind: "gallery", images: [{ url: "/api/stock/banners/kirana-1.jpg" }] },
  ] }],
};
const testCardLookup = async (username: string) => (username === SAMPLE_USERNAME ? SAMPLE_CARD : agentCardLookup(username));

type Step =
  | { say: string; forwarded?: boolean }
  | { wait: number }            // hours pass
  | { followup: number };       // the follow-up the bridge would send now (step 0 = next day)
type Scenario = { id: string; title: string; contact?: { known?: boolean; saved?: string }; channel?: "whatsapp" | "web"; steps: Step[] };

const SCENARIOS: Scenario[] = [
  { id: "card-self", title: "नया ग्राहक: Hi → 1 → किराना → ok → अगले दिन → कार्ड का लिंक → AI चेक करता है", steps: [
    { say: "Hi" }, { say: "1" }, { say: "kirana store hai" }, { say: "ok" },
    { wait: 24 }, { followup: 0 }, { say: `haan bana liya ${SAMPLE_LINK}` }, { say: "address kaise daalu?" }] },
  { id: "card-for-me", title: "'आप ही बना दो' → डिटेल नहीं, जुड़ने का लिंक", steps: [
    { say: "mujhe v card chahiye" }, { say: "mobile shop hai" }, { say: "aap hi bana do" }, { say: "Suresh Kumar, Suresh Mobile, Jaipur" }, { say: "mujhe ye sab nahi aata" }] },
  { id: "pdf", title: "सीधा 'pdf'", steps: [{ say: "pdf" }] },
  { id: "rate", title: "रेट → Growth → अपना डोमेन → 1 साल बाद", steps: [
    { say: "rate?" }, { say: "growth me kya milta hai" }, { say: "website apne domain par chalegi?" }, { say: "1 saal baad paise lagenge?" }] },
  { id: "plan", title: "बिज़नेस प्लान → कमाई → गारंटी? → मुझे कितना मिलेगा → Red/Green → पेमेंट", steps: [
    { say: "joining ka plan kya hai" }, { say: "kitna kama sakte hain mahine ka?" }, { say: "guarantee hai? pakka milega?" }, { say: "mujhe kitna milega?" },
    { say: "red id green id kya hai" }, { say: "payment kab milta hai" }] },
  { id: "objections", title: "सेल्समैन टेस्ट: Growth → महँगा है → सोचकर बताता हूँ → MLM है क्या?", steps: [
    { say: "growth me kya milta hai" }, { say: "ye to mehenga hai" }, { say: "sochke batata hoon" }, { say: "ye MLM to nahi hai?" }] },
  { id: "next-day", title: "Hello → 4 → अगले दिन वापस", steps: [
    { say: "Hello" }, { say: "4" }, { wait: 26 }, { say: "Hi" }, { say: "joining kaise karni hai" }] },
  { id: "register-help", title: "रजिस्ट्रेशन में दिक्कत — AI खुद मदद करे", steps: [
    { say: "join karna hai" }, { say: "OTP nahi aa raha" }, { say: "password bhool gaya" }] },
  { id: "human", title: "'{seller} जी से बात करनी है' → फिर सवाल", steps: [
    { say: "{seller} ji se baat karni hai" }, { say: "kab tak call aayega?" }, { say: "tab tak plan ki pdf bhej do" }] },
  { id: "english", title: "English ग्राहक → फिर हिंदी", steps: [
    { say: "Hello, I would like to know about your digital card service." }, { say: "How much does it cost?" }, { say: "Hindi me bataiye" }] },
  { id: "software", title: "कस्टम सॉफ्टवेयर (रेट नहीं)", steps: [
    { say: "mujhe apne school ke liye app banwana hai" }, { say: "attendance aur fees ka, kitne ka banega?" }, { say: "Rakesh Sharma, Sunrise Public School, Jaipur" }] },
  { id: "personal", title: "पर्सनल मैसेज (दोस्त, फोन में 'Rahul Bhai')", contact: { known: true, saved: "Rahul Bhai" }, steps: [
    { say: "Bhai kal shaadi me aa raha hai na?" }, { say: "Aur ghar pe sab kaise hain" }, { say: "Waise tera ye card wala kaam kya hai? mujhe bhi chahiye dukaan ke liye" }] },
  { id: "short", title: "छोटे मैसेज: video, call, ok, 👍", steps: [
    { say: "video" }, { say: "call karo" }, { say: "ok" }, { say: "👍" }] },
  { id: "social", title: "पुराना कॉन्टैक्ट: Good morning / फॉरवर्ड", contact: { known: true }, steps: [
    { say: "Good morning ji 🌹" }, { say: "Aaj ka suvichar: mehnat hi safalta ki kunji hai 🙏", forwarded: true }] },
  { id: "web", title: "वेबसाइट चैट: 'पार्टनर प्रोग्राम' → चार्ज? → बात करनी है → नंबर", channel: "web", steps: [
    { say: "पार्टनर प्रोग्राम" }, { say: "isme join hone ka kuch charge hai?" }, { say: "{seller} ji se baat karni hai" }, { say: "9876543210" }] },
];

type Line = { who: "customer" | "assistant" | "note"; text: string; files?: string[]; alert?: string | null; why?: string; at: string };

export async function POST(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { username?: string; only?: string[] };
  const username = String(body.username || "").trim().toLowerCase().replace(/^.*\/c\//, "").replace(/[^a-z0-9_-]/g, "");
  if (!username) return NextResponse.json({ error: "Type a Shubhora partner's card name." }, { status: 400 });
  const card = await fetchCloudCard(username);
  if (!card) return NextResponse.json({ error: `No live card at /c/${username}.` }, { status: 404 });
  if (!isShubhoraCard(card)) return NextResponse.json({ error: `/c/${username} is not a Shubhora partner card.` }, { status: 400 });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY is not set on the server." }, { status: 503 });

  const platform = await getPlatformKnowledge();
  const ctx = await agentContext(card, platform);
  const complete = agentComplete(key);
  const list = SCENARIOS.filter((s) => !body.only?.length || body.only.includes(s.id));
  const started = Date.now();
  const named = (t: string) => t.replace(/\{seller\}/g, ctx.seller || "aap"); // "{seller} ji se baat karni hai"

  const runs = await Promise.all(list.map(async (sc) => {
    const channel = sc.channel ?? "whatsapp";
    let now = Date.now();
    const history: AgentMsg[] = [];
    let state: Record<string, unknown> = {};
    const lines: Line[] = [];
    const stamp = () => new Date(now + 5.5 * 3600e3).toISOString().slice(5, 16).replace("T", " ");
    try {
      for (const step of sc.steps) {
        if ("wait" in step) { now += step.wait * 3600e3; lines.push({ who: "note", text: `⏱ ${step.wait} घंटे बाद`, at: stamp() }); continue; }
        if ("followup" in step) {
          const f = await agentFollowup({ history, state, ctx, step: step.followup, now, complete });
          lines.push({ who: "note", text: "अपने-आप भेजा गया फॉलो-अप:", at: stamp() });
          if (f) { lines.push({ who: "assistant", text: f, at: stamp(), why: "follow-up" }); history.push({ role: "assistant", content: f, at: now }); }
          else lines.push({ who: "note", text: "(कोई फॉलो-अप नहीं)", at: stamp() });
          continue;
        }
        now += 45_000;
        const said = named(step.say);
        lines.push({ who: "customer", text: said + (step.forwarded ? "   (फॉरवर्ड किया हुआ)" : ""), at: stamp() });
        const out = await agentTurn({
          channel, text: said, history, state, now, complete, ctx, cardLookup: testCardLookup,
          contact: { known: !!sc.contact?.known, saved: sc.contact?.saved || "", forwarded: !!step.forwarded },
        });
        history.push({ role: "user", content: said, at: now });
        state = out.state;
        now += 8_000;
        if (out.reply) {
          const files = [...out.reply.matchAll(/^\s*\[MEDIA\]\s*(\S+)/gim)].map((m) => m[1]);
          const text = out.reply.replace(/^\s*\[MEDIA\]\s*\S+\s*$/gim, "").replace(/\n{3,}/g, "\n\n").trim();
          lines.push({ who: "assistant", text, files, alert: out.alert, why: out.reason, at: stamp() });
          history.push({ role: "assistant", content: out.reply, at: now });
        } else {
          lines.push({ who: "note", text: `(कोई जवाब नहीं — ${out.reason})`, alert: out.alert, at: stamp() });
        }
      }
    } catch (e) {
      lines.push({ who: "note", text: `Error: ${(e as Error).message}`, at: stamp() });
    }
    return { id: sc.id, title: named(sc.title), channel, lines };
  }));

  return NextResponse.json({ card: card.username, seller: ctx.seller, links: ctx.links, flag: platform.aiV2 ?? "off", seconds: Math.round((Date.now() - started) / 1000), runs });
}
