-- 0057: the free V-Card runs for 1 year, then ₹1,499 a year (owner's call, 27 Sep 2026).
--
--   • Every account has profiles.card_expires_at. Existing accounts: 1 year from the day they joined.
--     New accounts: 1 year from sign-up (column default, so every way an account is made gets it).
--   • A running paid plan (Growth / Pro / partner / admin) covers the card — no separate ₹1,499.
--   • When the year ends the card keeps working for 7 more days (reminders go out). After that the public
--     link shows "Card renew karein". Paying ₹1,499 brings the card back at once — nothing is ever deleted.
--   • ₹1,499 renewals give NO BV: they are recorded here only and never reported to the partner panel.
--   • Plan and card dates can only be changed by the server (payments, Super Admin), never by the user.
--
-- Run once in Supabase → SQL editor. Safe to run again.

-- ---------- 1. the card year ----------
alter table public.profiles add column if not exists card_expires_at timestamptz;
alter table public.profiles alter column card_expires_at set default (now() + interval '1 year');
comment on column public.profiles.card_expires_at is
  'End of the V-Card year (free first year, then ₹1,499 a year). A running paid plan also covers the card. The card works 7 more days after this, then pauses until renewed.';

-- Existing accounts: one year from the day they joined.
update public.profiles p
   set card_expires_at = coalesce(u.created_at, p.created_at, now()) + interval '1 year'
  from auth.users u
 where u.id = p.id and p.card_expires_at is null;
update public.profiles set card_expires_at = coalesce(created_at, now()) + interval '1 year' where card_expires_at is null;

-- ---------- 2. plan and card dates are the server's to change ----------
-- Signed-in users may update their own profile row (name etc.), but the billing columns keep their values when
-- the change comes straight from the app (roles authenticated / anon). Payments, the partner panel link and
-- Super Admin go through the service role or definer functions and are not affected.
create or replace function public.profiles_billing_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  cols text[] := array['plan','plan_source','plan_expires_at','trial_started_at','saas_tier','saas_expires_at',
                       'saas_started_at','poster_plan','poster_plan_expires_at','card_expires_at'];
  o jsonb; n jsonb; c text; changed boolean := false;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    raise exception 'Profiles are created by the server';
  end if;
  o := to_jsonb(old); n := to_jsonb(new);
  foreach c in array cols loop
    if o ? c and (n -> c) is distinct from (o -> c) then
      n := jsonb_set(n, array[c], o -> c);
      changed := true;
    end if;
  end loop;
  if changed then new := jsonb_populate_record(new, n); end if;
  return new;
end $$;
drop trigger if exists profiles_billing_guard on public.profiles;
create trigger profiles_billing_guard before insert or update on public.profiles
  for each row execute function public.profiles_billing_guard();

-- ---------- 3. until when is the card covered? ----------
-- The later of the card year and a paid plan's end. 'infinity' = never ends (no date on record, or a paid plan
-- without an end date). Growth's plan_expires_at already includes its own 7 grace days.
create or replace function public.card_paid_until(p_user uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select case
    when p.plan in ('pro','team') and p.plan_expires_at is null then 'infinity'::timestamptz
    when p.card_expires_at is null then 'infinity'::timestamptz
    when p.plan in ('pro','team') then greatest(p.card_expires_at, p.plan_expires_at)
    else p.card_expires_at
  end
  from public.profiles p where p.id = p_user;
$$;
revoke all on function public.card_paid_until(uuid) from public, anon, authenticated;

-- ---------- 4. the public card page: is this card paused? ----------
-- Only this one yes/no leaves the database (the page is anonymous). A card with no owner row is never paused.
create or replace function public.card_paused(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((
    select now() >= public.card_paid_until(c.owner_id) + interval '7 days'
      from public.cards c
     where lower(c.username) = lower(trim(p_username))
     limit 1), false);
$$;
grant execute on function public.card_paused(text) to anon, authenticated;

-- ---------- 5. what the app shows the owner ----------
--   state: included (a paid plan covers it) | active (free / renewed year running) | grace (ended, still live
--          for 7 days) | paused;  until: end of the covered time;  days_left: negative once it has ended;
--   pause_on: when the link switches to "Card renew karein";  renewed: has paid ₹1,499 before.
create or replace function public.my_card()
returns table (state text, until timestamptz, days_left int, pause_on timestamptz, renewed boolean)
language sql stable security definer set search_path = public as $$
  with x as (
    select public.effective_plan(p.id) as eff, public.card_paid_until(p.id) as upto
      from public.profiles p where p.id = auth.uid()
  )
  select
    case when x.eff <> 'free' then 'included'
         when x.upto = 'infinity'::timestamptz or now() < x.upto then 'active'
         when now() < x.upto + interval '7 days' then 'grace'
         else 'paused' end,
    nullif(x.upto, 'infinity'::timestamptz),
    case when x.upto = 'infinity'::timestamptz then null
         else ceil(extract(epoch from (x.upto - now())) / 86400)::int end,
    case when x.upto = 'infinity'::timestamptz then null else x.upto + interval '7 days' end,
    exists (select 1 from public.subscriptions s where s.owner_id = auth.uid() and s.plan = 'card' and s.status = 'active')
  from x;
$$;
grant execute on function public.my_card() to authenticated;

-- ---------- 6. the ₹1,499 subscription row ----------
do $$ declare c record; begin
  for c in select conname from pg_constraint
            where conrelid = 'public.subscriptions'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ~ '\mplan\M'
  loop execute format('alter table public.subscriptions drop constraint %I', c.conname); end loop;
end $$;
alter table public.subscriptions add constraint subscriptions_plan_check check (plan in ('free','pro','team','card'));

-- One verified ₹1,499 payment = one more year, from the later of today and the current end (renewing early
-- loses nothing). Idempotent per Razorpay payment id. No partner BV — the app never reports it to the panel.
create or replace function public.apply_card_renewal(p_user uuid, p_ref text, p_order_ref text, p_amount int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_from timestamptz; v_end timestamptz;
begin
  if p_user is null or coalesce(trim(p_ref), '') = '' or coalesce(trim(p_order_ref), '') = '' or coalesce(p_amount, 0) <= 0 then
    raise exception 'Invalid verified payment';
  end if;
  if exists (select 1 from public.subscriptions where provider = 'razorpay' and provider_ref = p_ref) then
    select current_end into v_end from public.subscriptions where provider = 'razorpay' and provider_ref = p_ref;
    return jsonb_build_object('ok', true, 'replayed', true, 'expires', v_end);
  end if;
  select greatest(coalesce(card_expires_at, now()), now()) into v_from from public.profiles where id = p_user for update;
  if v_from is null then raise exception 'User profile not found'; end if;
  v_end := v_from + interval '1 year';
  update public.profiles set card_expires_at = v_end where id = p_user;
  insert into public.subscriptions (owner_id, plan, status, provider, provider_ref, provider_order_ref, amount, period, current_end)
    values (p_user, 'card', 'active', 'razorpay', p_ref, p_order_ref, p_amount, 'yearly', v_end);
  return jsonb_build_object('ok', true, 'replayed', false, 'expires', v_end);
end $$;
revoke all on function public.apply_card_renewal(uuid, text, text, int) from public, anon, authenticated;
grant execute on function public.apply_card_renewal(uuid, text, text, int) to service_role;

-- ---------- 7. who to remind (the daily reminder job, service role only) ----------
-- Accounts on the free plan that have a card and whose covered time ended in the last 30 days or ends within
-- p_days days. The job picks the day-marks (30 / 7 / 1 days before, the end day, 2 days before the pause, the pause).
create or replace function public.cards_ending(p_days int default 30)
returns table (user_id uuid, email text, until timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, u.email::text, public.card_paid_until(p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
   where p.card_expires_at is not null
     and public.effective_plan(p.id) = 'free'
     and public.card_paid_until(p.id) between now() - interval '30 days' and now() + make_interval(days => greatest(coalesce(p_days, 30), 1))
     and exists (select 1 from public.cards c where c.owner_id = p.id)
   order by 3;
$$;
revoke all on function public.cards_ending(int) from public, anon, authenticated;
grant execute on function public.cards_ending(int) to service_role;

-- ---------- 8. Super Admin: add years by hand (cash / offline payment) ----------
create or replace function public.admin_extend_card(p_user uuid, p_years int default 1)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare v_end timestamptz;
begin
  if p_years is null or p_years < 1 or p_years > 5 then raise exception 'Years must be 1 to 5'; end if;
  update public.profiles
     set card_expires_at = greatest(coalesce(card_expires_at, now()), now()) + make_interval(years => p_years)
   where id = p_user
  returning card_expires_at into v_end;
  if v_end is null then raise exception 'User profile not found'; end if;
  return v_end;
end $$;
revoke all on function public.admin_extend_card(uuid, int) from public, anon, authenticated;
grant execute on function public.admin_extend_card(uuid, int) to service_role;

-- ---------- 9. email reminders are logged like push / WhatsApp, so each goes out once ----------
do $$ declare c record; begin
  if to_regclass('public.notification_log') is null then return; end if;
  for c in select conname from pg_constraint
            where conrelid = 'public.notification_log'::regclass and contype = 'c'
              and pg_get_constraintdef(oid) ~ '\mchannel\M'
  loop execute format('alter table public.notification_log drop constraint %I', c.conname); end loop;
  alter table public.notification_log add constraint notification_log_channel_check check (channel in ('push', 'whatsapp', 'email'));
end $$;

-- ---------- 10. the "Free Digital V-Card" product the app seeds for Shubhora sellers ----------
update public.poster_products set price = 'FREE for 1 year (worth ₹1,499)' where price = 'FREE for ever (worth ₹1,499)';

-- PostgREST caches the schema; tell it about the new column and functions straight away.
notify pgrst, 'reload schema';

select count(*)                                   as accounts,
       count(*) filter (where card_expires_at is not null) as with_card_year,
       min(card_expires_at)::date                 as first_year_ends,
       max(card_expires_at)::date                 as last_year_ends
  from public.profiles;
