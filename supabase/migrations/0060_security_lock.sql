-- 0060 — security lock (owner's review, 28 Sep 2026).
-- Run this AFTER deploying the app version that has /api/admin/platform-settings: from then on the two Super Admin
-- AI pages save through that route, not straight from the browser.

-- 1. Platform-wide AI training (bot_persona, bot_knowledge, shubhora_persona / knowledge / faq, ai_v2).
--    0004_platform.sql let ANY signed-in account update it ("TODO before launch"), i.e. any customer could rewrite what
--    every card chat and every WhatsApp bot says. Reading stays public (the bots read it); only the server may write.
drop policy if exists platform_settings_write on public.platform_settings;
revoke insert, update, delete on public.platform_settings from anon, authenticated;
grant select, update on public.platform_settings to service_role;

-- 2. A username may never look like a partner ID (two letters + 4 or more digits, e.g. SH100245). Joining links carry
--    either one, so a username equal to someone's ID would take that partner's sign-ups. Same rule in the app
--    (src/lib/username.ts) and the partner panel (members.ts).
create or replace function public.username_rules_ok(p text) returns boolean
language sql immutable as $$
  select p is not null
     and length(p) between 4 and 20
     and p ~ '^[A-Za-z0-9_]+$'
     and p !~* '^[a-z]{2}[0-9]{4,}$'
     and lower(p) not in ('admin','administrator','shubhora','subhora','wellwa','support','help','login','signup','signin','logout','api','app',
                          'poster','partners','partner','dashboard','settings','cards','card','c','www','root','owner','staff','system','null','undefined');
$$;

-- 3. Existing usernames shaped like a partner ID — shown for review, nothing is changed.
--    An empty result means there is nothing to fix.
select id, username, created_at
  from public.profiles
 where username ~* '^[a-z]{2}[0-9]{4,}$'
 order by created_at;
