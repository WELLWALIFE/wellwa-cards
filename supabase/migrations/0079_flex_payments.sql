-- 0079 — Flexible payments (owner, 1 Nov 2026: "kai baar payment Standard package se alag ho sakti hai … admin / franchise ko
-- payment link banane ka option; user bhi khud alag amount — advance, booking — de paaye, admin ko kuch na bhejna pade").
-- Safe to run more than once.
--
--   payment_requests  one payable thing with a short link (/pay/<code>): made by Super Admin / staff / a franchise for a user, or by
--                     the user for themself. kind 'plan' = N months of a tier at any agreed amount; 'advance' = money kept on the
--                     account (advance_ledger) and used later for a plan; 'custom' = anything else (custom work, module set-up).
--   advance_ledger    rupees (paise) the account holds in advance; balance = sum(delta_paise).
--   apply_flex_plan() N months of a tier for a verified payment (apply_saas_payment extends by one month only).
--   use_advance_for_plan() pays a plan from the advance balance, in one transaction.
-- All of it is service-role only: the app's API routes write it; nothing is exposed to anon / authenticated.

create table if not exists public.payment_requests (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,                                   -- the link: shubhora.com/pay/<code>
  owner_id      uuid not null references public.profiles(id) on delete cascade,   -- who pays / whose account it applies to
  created_by    uuid,                                                   -- admin / franchise login, or the owner (self)
  created_role  text not null default 'self' check (created_role in ('self','admin','franchise')),
  kind          text not null check (kind in ('plan','advance','custom')),
  tier          text check (tier is null or tier in ('growth','premium')),
  months        int  not null default 1 check (months between 1 and 36),
  amount_paise  int  not null check (amount_paise >= 10000 and amount_paise <= 50000000),  -- Rs 100 .. Rs 5,00,000
  title         text not null default '',
  note          text not null default '',
  status        text not null default 'open' check (status in ('open','paid','cancelled')),
  order_id      text,
  payment_id    text unique,
  paid_at       timestamptz,
  expires_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists payment_requests_owner_idx on public.payment_requests (owner_id, status, created_at desc);
create index if not exists payment_requests_status_idx on public.payment_requests (status, created_at desc);

create table if not exists public.advance_ledger (
  id          bigserial primary key,
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  delta_paise int  not null,
  reason      text not null default '',
  ref         text unique,                                              -- payment id / "plan:<id>" — one line per event
  created_at  timestamptz not null default now()
);
create index if not exists advance_ledger_owner_idx on public.advance_ledger (owner_id, created_at desc);

alter table public.payment_requests enable row level security;
alter table public.advance_ledger   enable row level security;
revoke all on public.payment_requests from anon, authenticated;
revoke all on public.advance_ledger   from anon, authenticated;
grant all on public.payment_requests to service_role;
grant all on public.advance_ledger   to service_role;
grant usage, select on sequence public.advance_ledger_id_seq to service_role;

create or replace function public.advance_balance(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(delta_paise), 0)::int from public.advance_ledger where owner_id = p_user;
$$;
revoke all on function public.advance_balance(uuid) from public, anon, authenticated;
grant execute on function public.advance_balance(uuid) to service_role;

-- N months of Standard (tier 'growth'; Premium is 'growth' + the Premium website granted by the app) for one verified payment.
-- Same shape as apply_saas_payment (0072): the profile lock first, then the "already applied?" check, so verify + webhook together
-- answer "replayed" rather than failing.
create or replace function public.apply_flex_plan(p_user uuid, p_tier text, p_months int, p_ref text, p_order_ref text, p_amount int, p_credits int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_from timestamptz; v_end timestamptz; v_grace interval := interval '7 days'; v_months int := greatest(1, least(36, coalesce(p_months, 1)));
begin
  if p_user is null or p_tier not in ('growth','pro') or coalesce(trim(p_ref),'') = '' or p_amount < 0 then
    raise exception 'Invalid flex payment';
  end if;
  select greatest(coalesce(saas_expires_at, now()), now()) into v_from from public.profiles where id = p_user for update;
  if exists (select 1 from public.subscriptions where provider = 'razorpay' and provider_ref = p_ref) then
    select current_end into v_end from public.subscriptions where provider = 'razorpay' and provider_ref = p_ref;
    return jsonb_build_object('ok', true, 'replayed', true, 'expires', v_end);
  end if;
  v_end := v_from + make_interval(months => v_months);
  update public.profiles
     set saas_tier = p_tier,
         saas_expires_at = v_end,
         saas_started_at = coalesce(saas_started_at, now()),
         plan = 'pro', plan_source = 'paid', plan_expires_at = v_end + v_grace,
         poster_plan = 'business', poster_plan_expires_at = v_end + v_grace
   where id = p_user;
  insert into public.subscriptions(owner_id, plan, status, provider, provider_ref, amount, period, current_end)
    values (p_user, 'pro', 'active', 'razorpay', p_ref, p_amount, case when v_months = 12 then 'yearly' else 'monthly' end, v_end);
  perform public.grant_monthly_credits(p_user, p_credits, v_end);
  return jsonb_build_object('ok', true, 'replayed', false, 'tier', p_tier, 'months', v_months, 'expires', v_end, 'credits', p_credits);
end $$;
revoke all on function public.apply_flex_plan(uuid,text,int,text,text,int,int) from public, anon, authenticated;
grant execute on function public.apply_flex_plan(uuid,text,int,text,text,int,int) to service_role;

-- A plan paid from the advance balance: the ledger line and the months in one transaction; refuses when the balance is short.
create or replace function public.use_advance_for_plan(p_user uuid, p_tier text, p_months int, p_amount int, p_credits int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_bal int; v_ref text; v_res jsonb;
begin
  if p_user is null or p_amount <= 0 then raise exception 'Invalid advance use'; end if;
  perform 1 from public.profiles where id = p_user for update;
  select coalesce(sum(delta_paise), 0) into v_bal from public.advance_ledger where owner_id = p_user;
  if v_bal < p_amount then
    return jsonb_build_object('ok', false, 'reason', 'short', 'balance', v_bal);
  end if;
  v_ref := 'advance:' || p_user::text || ':' || extract(epoch from clock_timestamp())::bigint::text;
  insert into public.advance_ledger(owner_id, delta_paise, reason, ref) values (p_user, -p_amount, 'plan ' || p_tier || ' x' || p_months::text, v_ref);
  v_res := public.apply_flex_plan(p_user, p_tier, p_months, v_ref, v_ref, p_amount, p_credits);
  return v_res || jsonb_build_object('balance', v_bal - p_amount);
end $$;
revoke all on function public.use_advance_for_plan(uuid,text,int,int,int) from public, anon, authenticated;
grant execute on function public.use_advance_for_plan(uuid,text,int,int,int) to service_role;

select 'ok' as status;
