-- ============================================================
-- Wellwa Cards — role grants (newer Supabase projects don't
-- auto-grant table privileges to anon/authenticated).
-- RLS policies from 0001 still control WHICH rows are visible.
-- ============================================================

grant usage on schema public to anon, authenticated;

-- Visitors (anon): read published cards, submit leads.
grant select on public.cards, public.card_links, public.card_sections to anon;
grant insert on public.leads to anon;

-- Logged-in users: full CRUD (RLS restricts to their own rows).
grant select, insert, update, delete
  on public.profiles, public.cards, public.card_links, public.card_sections, public.leads
  to authenticated;

-- Future tables inherit sane defaults.
alter default privileges in schema public grant select on tables to anon;
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;

-- Ensure the media bucket exists (idempotent) and show it for verification.
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

select id, name, public from storage.buckets;
