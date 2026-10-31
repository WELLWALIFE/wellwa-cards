// Admin v2 (owner, 31 Oct 2026): ONE admin panel for the company's own people and for franchises, with rights instead of
// one password. A right is a thing a person may do; a role is a ready-made bundle of rights (changeable per person).
// Shared by the panel (menu, buttons) and the server (src/lib/admin-v2.ts checks every call) — the server decides.
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard, Users, Store, UserCog, ScrollText, IndianRupee, CreditCard, Wallet, Headset, LayoutTemplate, Image as ImageIcon,
  Building2, Sparkles, Bot, Bell, Globe, Settings, Network, Activity, SlidersHorizontal, ShieldCheck,
} from "lucide-react";

export const RIGHTS = [
  { key: "users.view",        group: "Users",     label: "See users and their details" },
  { key: "users.edit",        group: "Users",     label: "Change a user's profile, mobile, username" },
  { key: "users.plan",        group: "Users",     label: "Change plans, credits and add-ons" },
  { key: "users.block",       group: "Users",     label: "Block / unblock a user" },
  { key: "users.delete",      group: "Users",     label: "Delete a user" },
  { key: "users.login_as",    group: "Users",     label: "Log in as a user (recorded)" },
  { key: "users.export",      group: "Users",     label: "Export user lists" },
  { key: "support.live",      group: "Support",   label: "Live help and screen share" },
  { key: "support.notes",     group: "Support",   label: "Read and write notes on a user" },
  { key: "support.tickets",   group: "Support",   label: "Support tickets" },
  { key: "franchises.view",   group: "Franchise", label: "See franchises, their users and earnings" },
  { key: "franchises.manage", group: "Franchise", label: "Create / change franchises, assign users" },
  { key: "franchises.payouts",group: "Franchise", label: "Approve and pay franchise payouts" },
  { key: "billing.view",      group: "Money",     label: "See payments and revenue" },
  { key: "billing.manage",    group: "Money",     label: "Manual payments, refunds, funds" },
  { key: "plans.manage",      group: "Money",     label: "Plans, pricing and offers" },
  { key: "content.manage",    group: "Content",   label: "Templates, banners, site settings" },
  { key: "brands.manage",     group: "Content",   label: "White label brands" },
  { key: "ai.manage",         group: "Content",   label: "AI settings and training" },
  { key: "notifications.send",group: "Content",   label: "Send announcements and notifications" },
  { key: "partner.panel",     group: "Partner",   label: "Partner (MLM) panel and its staff" },
  { key: "reports.view",      group: "Admin",     label: "Reports" },
  { key: "audit.view",        group: "Admin",     label: "Audit log" },
  { key: "staff.manage",      group: "Admin",     label: "Add staff and give rights" },
  { key: "settings.manage",   group: "Admin",     label: "Platform settings (security, commissions, keys)" },
  { key: "system.view",       group: "Admin",     label: "System health" },
] as const;
export type Right = (typeof RIGHTS)[number]["key"];
export const ALL_RIGHTS: Right[] = RIGHTS.map((r) => r.key);
export const RIGHT_GROUPS = [...new Set(RIGHTS.map((r) => r.group))];

export type Role = "super_admin" | "admin" | "support" | "sales" | "content" | "franchise" | "custom";
export const ROLES: { key: Role; label: string; hint: string; rights: Right[] }[] = [
  { key: "super_admin", label: "Super Admin", hint: "Everything. The company owner only.", rights: ALL_RIGHTS },
  { key: "admin", label: "Admin", hint: "Runs the platform day to day; cannot change platform settings or keys.", rights: ALL_RIGHTS.filter((r) => r !== "settings.manage") },
  { key: "support", label: "Support", hint: "Helps users: sees them, live help, notes, tickets. No money.", rights: ["users.view", "support.live", "support.notes", "support.tickets"] },
  { key: "sales", label: "Sales / Accounts", hint: "Plans, payments, franchises' numbers. Cannot delete or block.", rights: ["users.view", "users.plan", "billing.view", "billing.manage", "franchises.view", "reports.view", "support.notes"] },
  { key: "content", label: "Content", hint: "Templates, banners, AI, announcements, white label.", rights: ["content.manage", "brands.manage", "ai.manage", "notifications.send"] },
  { key: "franchise", label: "Franchise", hint: "Their own users only: see, help, notes, earnings and payouts.", rights: ["users.view", "support.live", "support.notes", "franchises.view", "billing.view", "reports.view"] },
  { key: "custom", label: "Custom", hint: "Tick exactly what this person may do.", rights: [] },
];
export const roleLabel = (r: string) => ROLES.find((x) => x.key === r)?.label ?? r;

/** The menu: every page, the right that shows it, and its group. A franchise login sees the same panel with fewer pages. */
export type MenuItem = { href: string; label: string; icon: LucideIcon; right: Right | null; franchise?: boolean };
export const MENU: { title: string; items: MenuItem[] }[] = [
  { title: "", items: [{ href: "/admin", label: "Dashboard", icon: LayoutDashboard, right: null, franchise: true }] },
  { title: "People", items: [
    { href: "/admin/users", label: "Users", icon: Users, right: "users.view", franchise: true },
    { href: "/admin/franchises", label: "Franchises", icon: Store, right: "franchises.view" },
    { href: "/admin/support", label: "Live help", icon: Headset, right: "support.live", franchise: true },
    { href: "/admin/cards", label: "Cards", icon: CreditCard, right: "users.view" },
  ] },
  { title: "Money", items: [
    { href: "/admin/earnings", label: "My earnings", icon: IndianRupee, right: "franchises.view", franchise: true },
    { href: "/admin/plans", label: "Plans & pricing", icon: SlidersHorizontal, right: "plans.manage" },
    { href: "/admin/wallets", label: "Funds", icon: Wallet, right: "billing.manage" },
  ] },
  { title: "Content", items: [
    { href: "/admin/templates", label: "Templates", icon: LayoutTemplate, right: "content.manage" },
    { href: "/admin/banners", label: "Daily banners", icon: ImageIcon, right: "content.manage" },
    { href: "/admin/brands", label: "White label", icon: Building2, right: "brands.manage" },
    { href: "/admin/notifications", label: "Notifications", icon: Bell, right: "notifications.send" },
  ] },
  { title: "AI", items: [
    { href: "/admin/shubhora-ai", label: "Shubhora AI", icon: Sparkles, right: "ai.manage" },
    { href: "/admin/ai", label: "AI bot training", icon: Bot, right: "ai.manage" },
  ] },
  { title: "Partner (MLM)", items: [
    { href: "/admin/partner-staff", label: "Partner panel staff", icon: Network, right: "partner.panel" },
  ] },
  { title: "Admin", items: [
    { href: "/admin/staff", label: "Staff & roles", icon: UserCog, right: "staff.manage" },
    { href: "/admin/audit", label: "Audit log", icon: ScrollText, right: "audit.view" },
    { href: "/admin/system", label: "System health", icon: Activity, right: "system.view" },
    { href: "/admin/google", label: "Google Business", icon: Globe, right: "settings.manage" },
    { href: "/admin/site", label: "Site settings", icon: Settings, right: "content.manage" },
    { href: "/admin/settings", label: "Platform settings", icon: ShieldCheck, right: "settings.manage" },
  ] },
];

/** What the panel knows about the person who is logged in (from /api/admin/v2/me). */
export type AdminMe = {
  id: string; email: string; name: string; role: Role; rights: Right[];
  franchise: { id: string; code: string; name: string; canActivate: boolean } | null;
  mfaEnrolled: boolean; mfaRequired: boolean; aal: "aal1" | "aal2"; mustChangePassword: boolean;
  via: "session" | "key" | "handoff";
};
export const can = (me: Pick<AdminMe, "rights"> | null | undefined, r: Right | null) => r === null || !!me?.rights.includes(r);
export function menuFor(me: AdminMe | null) {
  if (!me) return [];
  return MENU.map((g) => ({ ...g, items: g.items.filter((i) => can(me, i.right) && (!me.franchise || i.franchise) && (i.href !== "/admin/earnings" || !!me.franchise)) })).filter((g) => g.items.length);
}
