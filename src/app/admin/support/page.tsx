"use client";
// Super Admin → Live help. People who tapped "Admin" under "Call for live help" in the app, and their Shubhora screen, live and view only.
// (The older polling console, staff invitations and "open their app as them" were removed on 19 Oct 2026: this is one system now.)
import { Headset } from "lucide-react";
import { ShareRequests } from "@/components/admin/share-requests";

export default function LiveHelpPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold"><Headset className="h-5 w-5 text-brand" /> Live help</h1>
        <p className="mt-1 text-sm text-muted">
          A card holder asks for help from the app; you see the Shubhora screen they are on, live, and guide them. They always know you are there,
          they confirm it on their phone, and it ends after 15 minutes or when they tap End. You can only look.
        </p>
      </div>
      <ShareRequests />
    </div>
  );
}
