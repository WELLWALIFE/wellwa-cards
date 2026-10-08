// Server-to-server (x-internal-key): the phone worker asks, as a call comes in on a line, how to answer it.
//   GET ?to=<line digits>&from=<caller digits> → { ownerId, business, greeting, system, voice, lang }
import { NextResponse } from "next/server";
import { restAsService } from "@/lib/poster-server";
import { buildSystem, getBrandTraining } from "@/lib/wa-ai";
import { getPlatformKnowledge } from "@/lib/platform";
import { cardForOwner } from "@/lib/wa-cloud";

const KEY = () => process.env.INTERNAL_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "";

export async function GET(request: Request) {
  if (!KEY() || request.headers.get("x-internal-key") !== KEY()) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const u = new URL(request.url);
  const to = (u.searchParams.get("to") ?? "").replace(/\D/g, "");
  if (to.length < 10) return NextResponse.json({ error: "bad line" }, { status: 400 });
  const line = (await restAsService<{ number: string; owner_id: string; active: boolean }[]>(`phone_lines?number=eq.${to}&select=number,owner_id,active`)).data?.[0]
    ?? (await restAsService<{ number: string; owner_id: string; active: boolean }[]>(`phone_lines?number=eq.${to.slice(-10)}&select=number,owner_id,active`)).data?.[0];
  if (!line || !line.active) return NextResponse.json({ error: "no such line" }, { status: 404 });
  const card = await cardForOwner(line.owner_id);
  if (!card) return NextResponse.json({ error: "owner has no card" }, { status: 404 });
  const [platform, brand] = await Promise.all([getPlatformKnowledge(), getBrandTraining(card.username)]);
  const wa = card.links.find((l) => l.type === "whatsapp")?.value?.replace(/[^0-9]/g, "");
  const business = card.company || card.name;
  const hindi = card.language !== "en";
  const first = card.name.split(" ")[0];
  return NextResponse.json({
    ownerId: line.owner_id, business, lang: hindi ? "hi" : "en",
    greeting: hindi ? `नमस्ते, ${business} में आपका स्वागत है। मैं ${first} जी की सहायक बोल रही हूँ। बताइए, मैं आपकी क्या मदद कर सकती हूँ?` : `Hello, welcome to ${business}. This is ${first}'s assistant. How can I help you today?`,
    system: buildSystem(card, wa, platform, brand, "phone"),
    voice: process.env.GEMINI_LIVE_VOICE || "Aoede",
  });
}
