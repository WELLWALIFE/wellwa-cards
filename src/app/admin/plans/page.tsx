"use client";

import { useEffect, useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { loadSettings, saveSettings, type SiteSettings } from "@/lib/site-settings";

export default function AdminPlans() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setSettings(loadSettings()); }, []);
  if (!settings) return null;

  function patchPlan(i: number, p: Partial<SiteSettings["plans"][number]>) {
    setSettings((s) => {
      if (!s) return s;
      const plans = s.plans.slice();
      plans[i] = { ...plans[i], ...p };
      return { ...s, plans };
    });
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plans & pricing</h1>
          <p className="text-muted mt-1">Edits here update the public Pricing page instantly.</p>
        </div>
        <button
          onClick={() => { saveSettings(settings); setSaved(true); }}
          className="inline-flex items-center gap-1.5 rounded-lg grad-brand px-4 py-2 text-sm font-semibold text-white shadow-card">
          {saved ? <Check className="h-4 w-4" /> : null} {saved ? "Saved" : "Save changes"}
        </button>
      </div>

      <div className="grid md:grid-cols-3 gap-5">
        {settings.plans.map((p, i) => (
          <div key={i} className={`rounded-2xl border bg-surface p-5 shadow-card space-y-3 ${p.hot ? "border-brand" : "border-border"}`}>
            <div className="flex items-center justify-between">
              <input className="ed-input !w-28 font-semibold" value={p.name} onChange={(e) => patchPlan(i, { name: e.target.value })} />
              <label className="flex items-center gap-1.5 text-xs text-muted">
                Popular
                <input type="checkbox" checked={p.hot} onChange={(e) => patchPlan(i, { hot: e.target.checked })} className="accent-[var(--brand)]" />
              </label>
            </div>
            <div className="flex gap-2">
              <input className="ed-input !w-24" value={p.price} onChange={(e) => patchPlan(i, { price: e.target.value })} />
              <input className="ed-input" value={p.period} onChange={(e) => patchPlan(i, { period: e.target.value })} />
            </div>
            <input className="ed-input" value={p.tagline} placeholder="Tagline" onChange={(e) => patchPlan(i, { tagline: e.target.value })} />
            <div className="space-y-1.5">
              {p.features.map((f, fi) => (
                <div key={fi} className="flex items-center gap-1.5">
                  <input className="ed-input" value={f}
                    onChange={(e) => { const features = p.features.slice(); features[fi] = e.target.value; patchPlan(i, { features }); }} />
                  <button className="ed-icon hover:text-danger shrink-0"
                    onClick={() => patchPlan(i, { features: p.features.filter((_, x) => x !== fi) })}><X className="h-4 w-4" /></button>
                </div>
              ))}
              <button className="ed-add" onClick={() => patchPlan(i, { features: [...p.features, ""] })}>
                <Plus className="h-3.5 w-3.5" /> Add feature
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
