// Server-to-server (x-internal-key): the phone worker reports a finished call. The transcript is summed up by the
// text AI, the call is kept (phone_calls), the caller becomes or updates a lead, a booking with a day and time goes on
// the calendar, and the owner is told what happened and what to do next.
//   POST { ownerId, line, caller, startedAt, seconds, transcript: [{ role: "caller"|"ai", text }] } → { ok, id }
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { geminiComplete } from "@/lib/gemini";
import { notify } from "@/lib/notify";
import { istInstant, istToday, fmtWhen } from "@/lib/bookings";
import { createBooking } from "@/lib/bookings-server";
import { cardForOwner } from "@/lib/wa-cloud";

const KEY = () => process.env.INTERNAL_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const S = (v: unknown, n: number) => String(v ?? "").replace(/\s+/g, " ").trim().slice(0, n);
type Turn = { role: "caller" | "ai"; text: string };
type Sum = { summary: string; intent: "enquiry" | "order" | "booking" | "callback" | "other"; name: string; want: string; at: string; next: string };

async function summarise(turns: Turn[], business: string): Promise<Sum> {
  const fallback: Sum = { summary: turns.filter((t) => t.role === "caller").map((t) => t.text).join(" ").slice(0, 200) || "Short call, nothing said.", intent: "other", name: "", want: "", at: "", next: "" };
  const key = process.env.GEMINI_API_KEY;
  if (!key || !turns.length) return fallback;
  try {
    const { text } = await geminiComplete({
      apiKey: key, tag: "phone:summary", maxOutputTokens: 500, temperature: 0.1, json: true,
      system: `You read the transcript of a phone call that an AI receptionist answered for ${business}, a small Indian business. Today is ${istToday()} (India). Reply with one JSON object: {"summary": "1-2 lines in Hinglish of who called and what they wanted, for the owner", "intent": "enquiry"|"order"|"booking"|"callback"|"other", "name": "caller's name if said, else empty", "want": "what they want to buy/book, short", "at": "booking moment as YYYY-MM-DDTHH:MM India time if a day and time were agreed, else empty", "next": "one line: what the owner should do now"}.`,
      contents: [{ role: "user", parts: [{ text: turns.map((t) => `${t.role === "ai" ? "AI" : "Caller"}: ${t.text}`).join("\n").slice(0, 12_000) }] }],
    });
    const a = text.indexOf("{"), z = text.lastIndexOf("}");
    const v = JSON.parse(text.slice(a, z + 1)) as Partial<Sum>;
    const intent = (["enquiry", "order", "booking", "callback", "other"] as const).find((k) => k === v.intent) ?? "other";
    return { summary: S(v.summary, 300) || fallback.summary, intent, name: S(v.name, 80), want: S(v.want, 160), at: S(v.at, 20), next: S(v.next, 200) };
  } catch { return fallback; }
}

export async function POST(request: Request) {
  if (!KEY() || request.headers.get("x-internal-key") !== KEY()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const ownerId = S(b.ownerId, 40);
  if (!/^[0-9a-f-]{36}$/i.test(ownerId)) return NextResponse.json({ error: "bad owner" }, { status: 400 });
  const caller = S(b.caller, 20).replace(/\D/g, ""), line = S(b.line, 20).replace(/\D/g, "");
  const seconds = Math.max(0, Math.min(7200, Math.round(Number(b.seconds)) || 0));
  const startedAt = typeof b.startedAt === "string" && !Number.isNaN(Date.parse(b.startedAt)) ? new Date(b.startedAt).toISOString() : new Date(Date.now() - seconds * 1000).toISOString();
  const transcript: Turn[] = (Array.isArray(b.transcript) ? b.transcript : []).map((t) => { const x = (t ?? {}) as Record<string, unknown>; return { role: x.role === "ai" ? "ai" as const : "caller" as const, text: S(x.text, 1000) }; }).filter((t) => t.text).slice(0, 400);
  const card = await cardForOwner(ownerId);
  const business = card?.company || card?.name || "your business";
  const sum = await summarise(transcript, business);
  const phone = caller ? `+${caller.length === 10 ? `91${caller}` : caller}` : "";

  // The caller in the CRM: the existing lead by number, else a new one.
  let leadId: string | null = null;
  if (phone) {
    const have = (await restAsService<{ id: string; name: string }[]>(`leads?owner_id=eq.${ownerId}&phone=eq.${encodeURIComponent(phone)}&select=id,name&limit=1`)).data?.[0];
    const fields = { message: `📞 ${sum.summary}`.slice(0, 1000), source: "phone", ai_intent: sum.intent === "other" ? "Phone call" : sum.intent[0].toUpperCase() + sum.intent.slice(1), status: sum.intent === "order" || sum.intent === "booking" ? "hot" : "new", updated_at: new Date().toISOString(), ...(sum.name ? { name: sum.name } : {}) };
    if (have) { leadId = have.id; await restAsService(`leads?id=eq.${have.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ...fields, ...(have.name && !sum.name ? { name: have.name } : {}) }) }); }
    else {
      const made = await restAsService<{ id: string }[]>("leads?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_id: ownerId, card_id: card?.id ?? null, phone, email: "", name: sum.name || "Caller", tags: [sum.intent], ...fields }) });
      leadId = made.data?.[0]?.id ?? null;
    }
  }
  let bookingId: string | null = null;
  const at = sum.intent === "booking" ? istInstant(sum.at) : null;
  if (at) bookingId = await createBooking({ ownerId, cardId: card?.id ?? null, leadId, name: sum.name || "Caller", phone, service: sum.want, startsAt: at, note: "Booked on the phone by the AI", source: "whatsapp" });

  const r = await restAsService<{ id: string }[]>("phone_calls?select=id", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ owner_id: ownerId, line, caller: phone, started_at: startedAt, seconds, transcript, summary: sum.summary, intent: sum.intent, lead_id: leadId, booking_id: bookingId }) });
  if (!r.ok) console.error("[phone] call save failed", r.status, r.text.slice(0, 160), "— has migration 0067 run?");
  const id = r.data?.[0]?.id ?? null;
  const who = `${sum.name || "Caller"}${phone ? ` · ${phone}` : ""}`;
  await notify(ownerId, "phone_call", {
    title: `📞 ${sum.intent === "booking" ? "Booking on the phone" : sum.intent === "order" ? "Order on the phone" : sum.intent === "callback" ? "Call back wanted" : "Call answered by AI"}: ${sum.name || phone || "caller"}`,
    body: sum.summary.slice(0, 160), path: "/poster/leads?tab=phone", ref: id ? `call:${id}` : undefined,
    whatsappText: `📞 *AI ne call uthayi* (${Math.round(seconds / 60)} min)\n${who}\n\n${sum.summary}${at ? `\n📅 Booking: ${fmtWhen(at.toISOString(), true)}` : ""}${sum.next ? `\n\n👉 ${sum.next}` : ""}${phone ? `\nCall back: ${phone}` : ""}`,
  }).catch(() => undefined);
  return NextResponse.json({ ok: true, id, intent: sum.intent, leadId, bookingId });
}
