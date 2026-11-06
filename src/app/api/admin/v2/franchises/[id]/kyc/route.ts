// KYC of a franchise (owner, 6 Nov 2026): PAN, cancelled cheque / passbook, Aadhaar front & back, GST certificate.
// Files sit in the private bucket "franchise-kyc" (migration 0089) and are opened only through 5-minute signed links.
// Who: the franchise itself (upload, view) and Shubhora with "franchises.manage" (upload, view, verify / reject). A parent does not see
// its sub-franchise's KYC.
//   POST multipart { file, kind } → { kyc }        GET ?doc=pan → { url }        PATCH { status: "verified" | "rejected", note } → { kyc }
import { requireAdmin, audit, type Identity } from "@/lib/admin-v2";
import { svc, SUPA_URL } from "@/lib/service";
import type { Right } from "@/lib/admin-rights";
import { notifyFranchise } from "@/lib/franchise-server";

const DOCS = { pan: "PAN card", bank: "Cancelled cheque / passbook", aadhaar_front: "Aadhaar front", aadhaar_back: "Aadhaar back", gst: "GST certificate" } as const;
type DocKey = keyof typeof DOCS;
type Kyc = { docs?: Partial<Record<DocKey, { path: string; name: string; at: string }>>; status?: "none" | "submitted" | "verified" | "rejected"; note?: string; decided_at?: string; decided_by?: string; [k: string]: unknown };
const list = <T,>(r: { data: T[] | null }) => (Array.isArray(r.data) ? r.data : []);
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

async function access(request: Request, id: string, rights: Right[]) {
  const g = await requireAdmin(request, rights); if (!g.ok) return { res: g.res } as const;
  const me: Identity = g.me;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { res: Response.json({ error: "Franchise not found." }, { status: 404 }) } as const;
  const own = me.franchise?.id === id;
  const staff = !me.franchise && me.rights.includes("franchises.manage");
  if (!own && !staff) return { res: Response.json({ error: "Only the franchise itself or Shubhora can see its KYC." }, { status: 403 }) } as const;
  const fr = list(await svc<{ id: string; code: string; name: string; kyc: Kyc }[]>(`franchises?id=eq.${id}&select=id,code,name,kyc&limit=1`))[0];
  if (!fr) return { res: Response.json({ error: "Franchise not found." }, { status: 404 }) } as const;
  return { me, fr, own, staff } as const;
}
const isDoc = (v: unknown): v is DocKey => typeof v === "string" && v in DOCS;

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await access(request, (await ctx.params).id, ["franchises.view", "franchises.manage"] as Right[]); if ("res" in a) return a.res;
  const doc = new URL(request.url).searchParams.get("doc");
  const f = isDoc(doc) ? a.fr.kyc?.docs?.[doc] : null;
  if (!f) return Response.json({ error: "No such document." }, { status: 404 });
  const r = await fetch(`${SUPA_URL}/storage/v1/object/sign/franchise-kyc/${f.path}`, { method: "POST", headers: { apikey: key(), authorization: `Bearer ${key()}`, "content-type": "application/json" }, body: JSON.stringify({ expiresIn: 300 }) });
  const j = (await r.json().catch(() => ({}))) as { signedURL?: string };
  if (!r.ok || !j.signedURL) return Response.json({ error: "Could not open the file." }, { status: 502 });
  return Response.json({ url: `${SUPA_URL}/storage/v1${j.signedURL}` });
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await access(request, (await ctx.params).id, ["franchises.view", "franchises.manage"] as Right[]); if ("res" in a) return a.res;
  const form = await request.formData().catch(() => null);
  const file = form?.get("file"); const kind = String(form?.get("kind") ?? "");
  if (!(file instanceof File) || !isDoc(kind)) return Response.json({ error: "Choose a file." }, { status: 400 });
  if (file.size > 3_000_000) return Response.json({ error: "That file is too big — send one under 3 MB." }, { status: 413 });
  const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" } as Record<string, string>)[file.type];
  if (!ext) return Response.json({ error: "Send a photo (JPG, PNG) or a PDF." }, { status: 415 });
  const path = `${a.fr.id}/${kind}-${Date.now()}.${ext}`;
  const up = await fetch(`${SUPA_URL}/storage/v1/object/franchise-kyc/${path}`, { method: "POST", headers: { apikey: key(), authorization: `Bearer ${key()}`, "content-type": file.type, "x-upsert": "true" }, body: new Uint8Array(await file.arrayBuffer()) });
  if (!up.ok) return Response.json({ error: (await up.text()).includes("Bucket not found") ? "Run migration 0089 in Supabase (KYC bucket)." : "The file could not be saved." }, { status: 502 });
  const old = a.fr.kyc?.docs?.[kind];
  if (old) await fetch(`${SUPA_URL}/storage/v1/object/franchise-kyc/${old.path}`, { method: "DELETE", headers: { apikey: key(), authorization: `Bearer ${key()}` } }).catch(() => null);
  const kyc: Kyc = { ...(a.fr.kyc ?? {}), docs: { ...(a.fr.kyc?.docs ?? {}), [kind]: { path, name: file.name.slice(0, 80), at: new Date().toISOString() } }, status: "submitted", note: "" };
  await svc(`franchises?id=eq.${a.fr.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ kyc, updated_at: new Date().toISOString() }) });
  await audit(a.me, "franchise.kyc_upload", { type: "franchise", id: a.fr.id, label: `${a.fr.code} · ${a.fr.name}`, note: DOCS[kind] }, request);
  return Response.json({ kyc: { ...kyc, docs: strip(kyc.docs) } });
}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const a = await access(request, (await ctx.params).id, ["franchises.manage"] as Right[]); if ("res" in a) return a.res;
  if (!a.staff) return Response.json({ error: "Only Shubhora verifies KYC." }, { status: 403 });
  const b = (await request.json().catch(() => ({}))) as { status?: string; note?: string };
  if (b.status !== "verified" && b.status !== "rejected") return Response.json({ error: "Verified or rejected?" }, { status: 400 });
  const note = String(b.note ?? "").trim().slice(0, 300);
  if (b.status === "rejected" && !note) return Response.json({ error: "Write what is wrong, so the franchise can fix it." }, { status: 400 });
  const kyc: Kyc = { ...(a.fr.kyc ?? {}), status: b.status, note, decided_at: new Date().toISOString(), decided_by: a.me.name || a.me.email };
  await svc(`franchises?id=eq.${a.fr.id}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ kyc, updated_at: new Date().toISOString() }) });
  await audit(a.me, `franchise.kyc_${b.status}`, { type: "franchise", id: a.fr.id, label: `${a.fr.code} · ${a.fr.name}`, note }, request);
  void notifyFranchise(a.fr.id, { title: b.status === "verified" ? "KYC verified" : "KYC needs a fix", body: b.status === "verified" ? "Your KYC documents are verified." : `Please upload again: ${note}`, ref: `kyc:${kyc.decided_at}` });
  return Response.json({ kyc: { ...kyc, docs: strip(kyc.docs) } });
}
/** The panel gets names and dates only — never storage paths. */
function strip(d: Kyc["docs"]) { return Object.fromEntries(Object.entries(d ?? {}).map(([k, v]) => [k, { name: v!.name, at: v!.at }])); }
