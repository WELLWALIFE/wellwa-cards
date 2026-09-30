"use client";

// Greets the signed-in user by name — the dashboard used to hardcode one
// business name for everybody.

import { useEffect, useState } from "react";
import { getSessionUser } from "@/lib/cloud";

export function WelcomeName() {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    getSessionUser().then((u) => setName(u ? (u.name.split(" ")[0] || u.email.split("@")[0] || u.email) : null));
  }, []);

  if (!name) return null;
  return (
    <div className="hidden md:block text-sm text-muted">
      Welcome back, <span className="text-ink font-medium">{name}</span>
    </div>
  );
}
