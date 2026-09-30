-- 14-day trial replaces the permanent free plan.
--
-- Before this, "free" was an unlimited tier: the public card page had no plan
-- check at all, so a free card stayed live forever. That wasn't a free tier, it
-- was the whole product given away. Now every new account starts on a 14-day
-- Pro trial, and when it ends the card *shrinks* rather than disappearing —
-- links already shared on WhatsApp must never turn into dead pages.

alter table public.profiles add column if not exists plan_source text
  not null default 'trial'
  check (plan_source in ('trial','paid','partner','admin'));
alter table public.profiles add column if not exists trial_started_at timestamptz;

comment on column public.profiles.plan_source is
  'How the current plan was granted — drives trial banners and renewal copy.';

/* ---------------- every new account starts a trial ---------------- */
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, plan, plan_source, trial_started_at, plan_expires_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    'pro',                       -- the trial is the full product, not a stub
    'trial',
    now(),
    now() + interval '14 days'
  );
  return new;
end; $$;

-- Existing accounts that never paid get the same 14 days from today, so nobody
-- is cut off by this change landing.
update public.profiles
   set plan = 'pro', plan_source = 'trial',
       trial_started_at = coalesce(trial_started_at, now()),
       plan_expires_at = coalesce(plan_expires_at, now() + interval '14 days')
 where plan = 'free' and plan_expires_at is null;

/* ---------------- what the app asks on every page load ---------------- */
-- Adds the trial fields so the dashboard can count down without a second query.
drop function if exists public.my_plan();
create or replace function public.my_plan()
returns table (
  plan text, expires_at timestamptz, brand_id uuid,
  plan_source text, days_left int, is_trial bool, expired bool
)
language sql stable security definer set search_path = public as $$
  select
    public.effective_plan(auth.uid()),
    p.plan_expires_at,
    p.brand_id,
    p.plan_source,
    greatest(0, ceil(extract(epoch from (p.plan_expires_at - now())) / 86400))::int,
    p.plan_source = 'trial',
    (p.plan_expires_at is not null and p.plan_expires_at < now())
  from public.profiles p where p.id = auth.uid();
$$;
grant execute on function public.my_plan() to authenticated;

/* ---------------- the public card needs the owner's state ----------------
 * The card page is anonymous, so it can't read profiles directly. This returns
 * only the one flag it needs: is the owner's plan live, or has it lapsed?
 */
create or replace function public.card_owner_state(p_username text)
returns table (plan text, expired bool)
language sql stable security definer set search_path = public as $$
  select
    public.effective_plan(c.owner_id),
    (public.effective_plan(c.owner_id) = 'free')
  from public.cards c
  where lower(c.username) = lower(trim(p_username))
  limit 1;
$$;
grant execute on function public.card_owner_state(text) to anon, authenticated;

/* ---------------- who to remind ----------------
 * Trials that end within the next `p_days` days and haven't been paid for.
 * Called by the reminder job; service-role only.
 */
create or replace function public.trials_ending(p_days int default 4)
returns table (user_id uuid, email text, days_left int, expires_at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.id, u.email::text,
         greatest(0, ceil(extract(epoch from (p.plan_expires_at - now())) / 86400))::int,
         p.plan_expires_at
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.plan_source = 'trial'
    and p.plan_expires_at is not null
    and p.plan_expires_at > now()
    and p.plan_expires_at < now() + (p_days || ' days')::interval
  order by p.plan_expires_at;
$$;
revoke all on function public.trials_ending(int) from public, anon, authenticated;

select 'trial schema ready' as status;
