// POST (bearer) { lead_id, as?, text?, imageUrl?, fileUrl?, fileName?, template_id? } → send from the
// owner's WhatsApp via their bridge worker (agents send through the owner's number). Bot mutes 15 min.
import { NextResponse } from "next/server";
import { userFromRequest, restAsService } from "@/lib/poster-server";
import { leadById, waPlanExpiry, ownerPlanExpiry, bridge, addEvent, fillTemplate, cardLink, resolveScope } from "@/lib/crm-server";
import { businessContext } from "@/lib/reviews-server";
import { cloudAccount, sendCloud, logCloud, friendlyGraphError } from "@/lib/wa-cloud";

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  const b = await request.json().catch(() => ({}));
  const scope = await resolveScope(me, typeof b.as === "string" ? b.as : null);
  if (!scope) return NextResponse.json({ error: "Not allowed." }, { status: 403 });
  const lead = await leadById(me.token, String(b.lead_id ?? ""), scope.ownerId);
  if (!lead) return NextResponse.json({ error: "Lead not found." }, { status: 404 });
  if (!/^\+\d{10,15}$/.test(lead.phone)) return NextResponse.json({ error: "This contact's number is hidden by WhatsApp — reply from your phone." }, { status: 400 });
  let text = typeof b.text === "string" ? b.text.trim().slice(0, 3000) : "";
  const https = (v: unknown) => (typeof v === "string" && /^https:\/\//.test(v) ? v.slice(0, 500) : undefined);
  const imageUrl = https(b.imageUrl), documentUrl = https(b.fileUrl);
  const fileName = typeof b.fileName === "string" ? b.fileName.slice(0, 80) : undefined;
  if (!text && !imageUrl && !documentUrl) return NextResponse.json({ error: "Type a message first." }, { status: 400 });
  if (text.includes("{")) {
    const ctx = await businessContext(scope.ownerId);
    text = fillTemplate(text, lead, { name: ctx.name, phone: ctx.phone, card: await cardLink(scope.ownerId) });
  }
  // Official Cloud API connected → send through it (no bridge needed).
  const cloud = await cloudAccount(scope.ownerId);
  if (cloud?.enabled) {
    try {
      const id = imageUrl ? await sendCloud(cloud, lead.phone, { imageUrl, caption: text }) : documentUrl ? await sendCloud(cloud, lead.phone, { documentUrl, fileName, caption: text }) : await sendCloud(cloud, lead.phone, { text });
      const label = imageUrl ? `📷 ${text || "Photo"}` : documentUrl ? `📄 ${fileName || "Document"}${text ? ` — ${text}` : ""}` : text;
      if (id) await logCloud({ ownerId: scope.ownerId, cardId: lead.card_id, phone: lead.phone, waId: id, direction: "out", sender: "owner", text: label, sentBy: scope.role === "owner" ? null : me.id });
      if (typeof b.template_id === "string" && /^[0-9a-f-]{36}$/i.test(b.template_id)) await restAsService(`rpc/wa_template_used`, { method: "POST", body: JSON.stringify({ p_id: b.template_id, p_owner: scope.ownerId }) }).catch(() => {});
      await addEvent(me.token, scope.ownerId, lead.id, "sent", label);
      if (lead.status === "new") await restAsService(`leads?id=eq.${lead.id}&owner_id=eq.${scope.ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "contacted" }) });
      return NextResponse.json({ ok: true, text: label, channel: "cloud" });
    } catch (e) { return NextResponse.json({ error: friendlyGraphError(e) }, { status: 502 }); }
  }
  const exp = scope.role === "owner" ? await waPlanExpiry(me.token) : await ownerPlanExpiry(scope.ownerId);
  if (!exp) return NextResponse.json({ error: "plan_expired", message: "WhatsApp sending needs the Business plan." }, { status: 402 });
  const r = await bridge(scope.ownerId, exp, "send", { to: lead.phone, text, imageUrl, documentUrl, fileName, asOwner: true, sentBy: scope.role === "owner" ? undefined : me.id });
  if (!r.ok) {
    const msg = r.data.error === "not connected" ? "WhatsApp is not connected — open the WhatsApp AI tab and scan the QR." : r.data.error === "bridge_offline" ? "WhatsApp service is offline right now." : String(r.data.error ?? "Send failed.");
    return NextResponse.json({ error: msg }, { status: r.status === 409 ? 409 : 502 });
  }
  if (typeof b.template_id === "string" && /^[0-9a-f-]{36}$/i.test(b.template_id)) {
    await restAsService(`rpc/wa_template_used`, { method: "POST", body: JSON.stringify({ p_id: b.template_id, p_owner: scope.ownerId }) }).catch(() => {});
  }
  await addEvent(me.token, scope.ownerId, lead.id, "sent", imageUrl ? `📷 ${text || "Photo"}` : documentUrl ? `📄 ${fileName || "Document"}` : text);
  if (lead.status === "new") await restAsService(`leads?id=eq.${lead.id}&owner_id=eq.${scope.ownerId}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "contacted" }) });
  return NextResponse.json({ ok: true, text: imageUrl ? `📷 ${text || "Photo"}` : documentUrl ? `📄 ${fileName || "Document"}${text ? ` — ${text}` : ""}` : text });
}
