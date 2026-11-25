// Super Admin → Google checks (owner, 25 Nov 2026: "admin me lead ka option kaha hai?"): every free Google check that was run, and
// every lead it brought (the visitor's number) with the card that got it. Read only.
import { NextResponse } from "next/server";
import { adminAllowed } from "@/lib/admin-guard";
import { restAsService } from "@/lib/poster-server";

type Check = { created_at: string; name: string; city: string; score: number; phone: string | null; query: string | null; user_id: string | null };
type Lead = { created_at: string; name: string; phone: string; message: string; card_id: string };

export async function GET(request: Request) {
  if (!(await adminAllowed(request))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const checks = (await restAsService<Check[]>("google_checks?select=created_at,name,city,score,phone,query,user_id&order=created_at.desc&limit=200")).data ?? [];
  const leads = (await restAsService<Lead[]>("leads?src=eq.google-check&select=created_at,name,phone,message,card_id&order=created_at.desc&limit=200")).data ?? [];
  const ids = [...new Set((Array.isArray(leads) ? leads : []).map((l) => l.card_id).filter(Boolean))];
  const cards = ids.length ? (await restAsService<{ id: string; username: string }[]>(`cards?id=in.(${ids.join(",")})&select=id,username`)).data ?? [] : [];
  const nameOf = new Map((Array.isArray(cards) ? cards : []).map((c) => [c.id, c.username]));
  return NextResponse.json({
    checks: Array.isArray(checks) ? checks : [],
    leads: (Array.isArray(leads) ? leads : []).map((l) => ({ ...l, card: nameOf.get(l.card_id) ?? "" })),
  });
}
