"use client";
// Sidebar button of the Super Admin: opens the partner (MLM) admin in a new tab, no second password.
import { useState } from "react";
import { Handshake, ExternalLink, LoaderCircle } from "lucide-react";
import { partnerAdminUrl } from "@/lib/partner-admin-client";

export function PartnerAdminButton() {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  async function go(e: React.MouseEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    const w = window.open("", "_blank");            // opened on the click itself, so the browser allows it
    const url = await partnerAdminUrl();
    if (url) { if (w) w.location.href = url; else window.location.href = url; }
    else { w?.close(); setErr("Could not open Staff Admin — is the panel linked?"); }
    setBusy(false);
  }
  return (
    <div>
      <a href="/partners/admin" onClick={go}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface2 hover:text-ink">
        {busy ? <LoaderCircle className="h-[18px] w-[18px] animate-spin" /> : <Handshake className="h-[18px] w-[18px]" strokeWidth={2} />}
        Staff Admin (MLM) <ExternalLink className="ml-auto h-3.5 w-3.5 text-faint" />
      </a>
      {err && <p className="px-3 text-[11px] text-red-500">{err}</p>}
    </div>
  );
}
