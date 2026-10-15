"use client";
import { useNavTracker } from "@/lib/nav-back";

/** Counts the app's own screen changes so every Back can tell "there is a previous screen" from "this is the first one" (lib/nav-back.ts). */
export function NavTracker() { useNavTracker(); return null; }
