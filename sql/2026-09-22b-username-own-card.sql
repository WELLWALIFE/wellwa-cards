-- Patch (22 Sep 2026, after 2026-09-22-account-username.sql): a signed-in person may take the link name of
-- their OWN card as their username (rahul with the card /c/rahul), so existing users can line the two up.
-- Anyone else's card link stays blocked, and so does every card link for a visitor who is not signed in.
-- Run once in the Supabase SQL editor. Safe to re-run.

create or replace function public.account_username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.username_rules_ok(p_username)
     and not exists (select 1 from public.profiles where lower(username) = lower(p_username) and id is distinct from auth.uid())
     and not exists (select 1 from public.cards where lower(username) = lower(p_username) and owner_id is distinct from auth.uid());
$$;
grant execute on function public.account_username_available(text) to anon, authenticated;
