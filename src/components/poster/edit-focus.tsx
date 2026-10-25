"use client";
// An edit screen with a live window takes the whole top of the phone: the avatar / share row goes away while it is open, and the window
// starts right under the edge (owner, 25 Oct 2026: "screen ko upper ki side"). The Back button and "See it" link sit on the window.
import { useEffect } from "react";
export function EditFocus() {
  useEffect(() => {
    document.documentElement.setAttribute("data-edit-focus", "1");
    return () => document.documentElement.removeAttribute("data-edit-focus");
  }, []);
  return null;
}
