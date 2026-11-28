-- Shubhora partner menu (owner, 28 Nov 2026): the numbered menu every Shubhora partner's assistant sends (website, Growth Plan,
-- custom software, WhatsApp AI, CRM, Direct Selling Plan, talk to a person) and the PDF / videos it shares are set once in
-- Super Admin → Shubhora AI → Menu and reach every partner within 5 minutes. Empty = the built-in text in
-- bridge/shubhora-menu.mjs. A partner's own change to an item lives on their card (data.botMenu) and wins for that item only.
-- Shape: { "items": { "<id>": { "title": { "hi", "en" }, "reply": { "hi", "en" } } }, "links": { "pdf", "productVideo", "planVideo", "tutorial" } }
-- Written only through /api/admin/platform-settings (service role); read like the other platform_settings columns. Safe to re-run.
alter table public.platform_settings add column if not exists shubhora_menu jsonb not null default '{}'::jsonb;

select shubhora_menu from public.platform_settings where id = 1;
