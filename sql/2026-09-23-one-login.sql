-- One login, one account (23 Sep 2026). Run once in the Supabase SQL editor (project kyywwgkrbozbsyodolvj). Safe to re-run.
--
--   1. auth_email_for(p)  the server turns whatever the person typed at login — username, mobile number or email —
--                         into the account's sign-in address. Service role only (the app's /api/login), never public,
--                         so nobody can look up addresses.
--   2. Every existing account gets a username (its card link name when it has one), so every card carries the
--                         "Get your own Shubhora" button and every account can take its partner ID.

-- 1 ------------------------------------------------------------------------------------------------------------
create or replace function public.auth_email_for(p text) returns text
language plpgsql security definer set search_path = public as $$
declare
  q text := lower(trim(coalesce(p, '')));
  d text;
  v text;
begin
  if q = '' then return null; end if;

  -- a username
  select u.email into v from public.profiles pr join auth.users u on u.id = pr.id where lower(pr.username) = q limit 1;
  if v is not null then return v; end if;

  -- an email: the sign-in address itself, else the contact email of a mobile-number account
  if position('@' in q) > 0 then
    select u.email into v from auth.users u where lower(u.email) = q limit 1;
    if v is null then
      select u.email into v from auth.users u where lower(u.raw_user_meta_data->>'contact_email') = q order by u.created_at limit 1;
    end if;
    return v;
  end if;

  -- a mobile number (the last 10 digits): mobile accounts live under an internal address; email accounts may carry a phone
  d := regexp_replace(q, '\D', '', 'g');
  if length(d) >= 10 then
    d := right(d, 10);
    select u.email into v from auth.users u
     where u.email = 'p91' || d || '@phone.neuraledge.me'
        or right(regexp_replace(coalesce(u.raw_user_meta_data->>'phone', ''), '\D', '', 'g'), 10) = d
        or right(coalesce(u.phone, ''), 10) = d
     order by (u.email = 'p91' || d || '@phone.neuraledge.me') desc, u.created_at
     limit 1;
    return v;
  end if;
  return null;
end $$;
revoke all on function public.auth_email_for(text) from public;
revoke all on function public.auth_email_for(text) from anon, authenticated;
grant execute on function public.auth_email_for(text) to service_role;

-- 2 ------------------------------------------------------------------------------------------------------------
do $$
declare
  r record;
  base text;
  cand text;
  i int;
  ok boolean;
begin
  for r in
    select p.id, u.email,
           (select c.username from public.cards c where c.owner_id = p.id order by c.created_at asc limit 1) as card
    from public.profiles p join auth.users u on u.id = p.id
    where p.username is null
  loop
    base := null;
    -- the card link name, with - turned into _ (usernames allow letters, numbers and _)
    if r.card is not null then
      base := regexp_replace(replace(lower(r.card), '-', '_'), '[^a-z0-9_]', '', 'g');
    end if;
    -- else the email's local part (real inboxes only, never the internal mobile address)
    if (base is null or length(base) < 4) and r.email is not null and r.email not like 'p%@phone.%' then
      base := regexp_replace(lower(split_part(r.email, '@', 1)), '[^a-z0-9_]', '_', 'g');
    end if;
    -- else a neutral name the person can read on the Me page
    if base is null or length(base) < 4 then base := 'user_' || substr(md5(r.id::text), 1, 6); end if;
    base := left(base, 20);
    if length(base) < 4 then base := rpad(base, 4, '0'); end if;

    cand := base; i := 0;
    loop
      ok := public.username_rules_ok(cand)
            and not exists (select 1 from public.profiles x where lower(x.username) = lower(cand))
            and not exists (select 1 from public.cards c where lower(c.username) = lower(cand) and c.owner_id <> r.id);
      exit when ok;
      i := i + 1;
      exit when i > 60;
      cand := left(base, 20 - length(i::text) - 1) || '_' || i;
    end loop;
    if ok then update public.profiles set username = cand where id = r.id and username is null; end if;
  end loop;
end $$;

-- how it went
select count(*) filter (where username is not null) as with_username, count(*) filter (where username is null) as still_without
from public.profiles;
