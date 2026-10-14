// A file for a Business form (KYC photos, payment proof, a support attachment): the app receives it, the partner service stores it for this
// member and answers a file id the form sends back with its submit. multipart: file + kind ("kyc_pan", "kyc_bank", "kyc_aadhaar_front",
// "kyc_aadhaar_back", "payment", "ticket", "photo").
import { NextResponse } from "next/server";
import { userFromRequest } from "@/lib/poster-server";
import { partnerCall, partnerLinked } from "@/lib/partner-link";
import { rateLimited } from "@/lib/api-security";

const KINDS = ["kyc_pan", "kyc_bank", "kyc_aadhaar_front", "kyc_aadhaar_back", "payment", "ticket", "photo"];

export async function POST(request: Request) {
  const me = await userFromRequest(request);
  if (!me) return NextResponse.json({ error: "Please log in." }, { status: 401 });
  if (!partnerLinked()) return NextResponse.json({ error: "The Business section is not available right now." }, { status: 503 });
  if (rateLimited(`biz-upload:${me.id}`, 30, 60 * 60_000)) return NextResponse.json({ error: "Too many uploads. Please wait a little." }, { status: 429 });
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "");
  if (!(file instanceof File) || !KINDS.includes(kind)) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > 2_500_000) return NextResponse.json({ error: "That file is too big. Please send one under 2 MB." }, { status: 413 });
  if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)) return NextResponse.json({ error: "Send a photo (JPG, PNG) or a PDF." }, { status: 415 });
  const data = Buffer.from(await file.arrayBuffer()).toString("base64");
  const r = await partnerCall<{ id?: string }>("p.upload", { suiteUserId: me.id, kind, name: file.name.slice(0, 120), mime: file.type, data }, 30_000);
  if (!r.ok || !r.data.id) return NextResponse.json({ error: r.data.error ?? "The file could not be saved. Please try again." }, { status: r.status || 502 });
  return NextResponse.json({ id: r.data.id });
}
