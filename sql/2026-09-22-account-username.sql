-- One Shubhora account = card + partner account (22 Sep 2026).
-- Run once in the Supabase SQL editor (project kyywwgkrbozbsyodolvj). Safe to re-run.
--
--   profiles.username     the account's public name: card link /c/<username>, referral name, partner name
--   profiles.referred_by  the introducer (the account whose card / link brought this person in)
--   account_username_available(p)  live check while typing (anon + signed-in)
--   resolve_introducer(p)          who "by=<username or old referral code>" is — returns only the username
--   claim_username(p, by)          the signed-in user takes a username once and records the introducer
--   card_owner_username(card)      the public card's owner username, for the "Get your own Shubhora" button

alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists referred_by uuid references auth.users (id) on delete set null;
create unique index if not exists profiles_username_uq on public.profiles (lower(username)) where username is not null;
create index if not exists profiles_referred_by_idx on public.profiles (referred_by) where referred_by is not null;

create or replace function public.username_rules_ok(p text) returns boolean
language sql immutable as $$
  select p is not null
     and length(p) between 4 and 20
     and p ~ '^[A-Za-z0-9_]+$'
     and lower(p) not in ('admin','administrator','shubhora','subhora','wellwa','support','help','login','signup','signin','logout','api','app',
                          'poster','partners','partner','dashboard','settings','cards','card','c','www','root','owner','staff','system','null','undefined');
$$;

create or replace function public.account_username_available(p_username text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.username_rules_ok(p_username)
     and not exists (select 1 from public.profiles where lower(username) = lower(p_username))
     and not exists (select 1 from public.cards where lower(username) = lower(p_username));
$$;
grant execute on function public.account_username_available(text) to anon, authenticated;

create or replace function public.resolve_introducer(p text) returns table (username text)
language sql stable security definer set search_path = public as $$
  select username from public.profiles
  where username is not null and (lower(username) = lower(p) or (referral_code is not null and upper(referral_code) = upper(p)))
  limit 1;
$$;
grant execute on function public.resolve_introducer(text) to anon, authenticated;

create or replace function public.claim_username(p_username text, p_by text default null) returns json
language plpgsql security definer set search_path = public as $$
declare
  v_me uuid := auth.uid();
  v_by uuid;
  v_current text;
begin
  if v_me is null then return json_build_object('ok', false, 'error', 'sign in required'); end if;
  select username into v_current from public.profiles where id = v_me;
  if v_current is not null then return json_build_object('ok', false, 'error', 'already set', 'username', v_current); end if;
  if not public.account_username_available(p_username) then return json_build_object('ok', false, 'error', 'taken'); end if;
  if p_by is not null and length(p_by) > 0 then
    select id into v_by from public.profiles
     where id <> v_me and (lower(username) = lower(p_by) or (referral_code is not null and upper(referral_code) = upper(p_by)))
     limit 1;
  end if;
  update public.profiles set username = p_username, referred_by = coalesce(referred_by, v_by) where id = v_me and username is null;
  if not found then return json_build_object('ok', false, 'error', 'already set'); end if;
  return json_build_object('ok', true, 'username', p_username, 'referred_by', v_by);
end $$;
grant execute on function public.claim_username(text, text) to authenticated;

create or replace function public.card_owner_username(p_card text) returns table (username text)
language sql stable security definer set search_path = public as $$
  select p.username from public.cards c join public.profiles p on p.id = c.owner_id
  where c.username = p_card and p.username is not null limit 1;
$$;
grant execute on function public.card_owner_username(text) to anon, authenticated;

-- A card link may never take another account's username (the card editor lets people rename their link).
create or replace function public.cards_username_guard() returns trigger
language plpgsql as $$
begin
  if new.username is not null and exists (select 1 from public.profiles p where lower(p.username) = lower(new.username) and p.id <> new.owner_id) then
    raise exception 'That link is taken' using errcode = '23505';
  end if;
  return new;
end $$;
drop trigger if exists cards_username_guard on public.cards;
create trigger cards_username_guard before insert or update of username on public.cards
  for each row execute function public.cards_username_guard();
