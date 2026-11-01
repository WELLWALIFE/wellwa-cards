"use client";
// On a computer (app shell, globals.css .app-shell) a page is 1040px wide. Forms and settings lists read better narrower: these routes
// mark the column `data-narrow`, and the CSS caps them at 760px. Phones are untouched (the rule lives under the lg media query).
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const NARROW = /^\/poster\/(onboard|setup|plan|start-plan|settings|more|profiles|brand(?!\/setup)|testimonials|connect|share|welcome|guide|learn|report|seo|site\/seo|site\/link|photos|photoshoot|text-video|explainer|reel|video|videos|ai|d\b)/;

export function DesktopWidth() {
  const p = usePathname() || "";
  useEffect(() => {
    const col = document.querySelector(".app-col");
    if (!col) return;
    if (NARROW.test(p)) col.setAttribute("data-narrow", ""); else col.removeAttribute("data-narrow");
  }, [p]);
  return null;
}
