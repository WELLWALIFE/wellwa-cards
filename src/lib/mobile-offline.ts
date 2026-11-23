"use client";
// Mobile Shop without internet (owner, 23 Nov 2026: "bina internet ke chal sakta hai to wo bhi bana dijiye"). The phone keeps the
// item list, and a bill made with no network waits here in a queue; when the network is back it goes to the server by itself.
// Every queued bill carries a client_id, and the server saves one client_id only once, so a retry can never make two bills.
// Honest limits: the bill number is given by the server, so an offline bill prints as "OFFLINE" until it is sent; WhatsApp and
// IMEI lookups need the network.
import { api } from "@/lib/poster-client";
import type { BillRow } from "@/lib/mobile";

const ITEMS = (ws: string | null) => `ms.items.${ws || "me"}`;
const QUEUE = "ms.queue";
export type Queued = { client_id: string; at: string; body: Record<string, unknown>; total: number; name: string; error?: string };

const read = <T,>(k: string, d: T): T => { try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : d; } catch { return d; } };
const write = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } };

/** The last item list this phone loaded (items, setup, access), for when there is no network. */
export const keepItems = (ws: string | null, data: unknown) => { write(ITEMS(ws), { at: Date.now(), data }); };
export const keptItems = <T,>(ws: string | null): { at: number; data: T } | null => read<{ at: number; data: T } | null>(ITEMS(ws), null);

export const queued = (): Queued[] => read<Queued[]>(QUEUE, []);
/** false when the phone could not keep it (storage full or blocked) — the caller must tell the person. */
export const enqueue = (q: Queued): boolean => write(QUEUE, [...queued(), q]);
export const dropQueued = (clientId: string) => { write(QUEUE, queued().filter((q) => q.client_id !== clientId)); };
export const newClientId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `c-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);

let running = false;
/** Send the waiting bills, oldest first. Stops at the first network failure; a bill the server refuses (say the stock is gone)
 *  stays in the queue with the reason, for the shop to see and decide. */
export async function syncQueue(): Promise<{ sent: number; left: number }> {
  if (running) return { sent: 0, left: queued().length };
  running = true;
  let sent = 0;
  try {
    for (const q of queued()) {
      if (q.error) continue;
      let r: { ok: boolean; status: number; data: { bill?: BillRow; error?: string } };
      try { r = await api<{ bill?: BillRow; error?: string }>("/api/mobile/bills", { method: "POST", json: q.body }); } catch { break; }
      if (r.ok) { dropQueued(q.client_id); sent += 1; continue; }
      if (r.status === 401 || r.status >= 500) break;   // login needed or the server is down: try again later
      write(QUEUE, queued().map((x) => (x.client_id === q.client_id ? { ...x, error: r.data?.error || "Not saved." } : x)));
    }
  } finally { running = false; }
  return { sent, left: queued().length };
}
