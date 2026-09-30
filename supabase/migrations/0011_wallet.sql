-- Plan activation + white-label partner wallet.
--
-- Three ways a card holder can end up on a paid plan, all landing in one place:
--   1. Direct  — they pay by Razorpay on neuraledge.me
--   2. Partner — a white-label partner activates them from a prepaid balance
--   3. Admin   — super admin grants it (comp, support, correction)
--
-- Fixes a real bug on the way: set_plan() wrote profiles.plan, but the feature
-- gating read cards.data.plan, so a genuine payment unlocked nothing. There is
-- now one source of truth (profiles.plan + plan_expires_at) and one reader.

/* ---------------- one source of truth for a user's plan ---------------- */
alter table public.profiles add column if not exists plan_expires_at timestamptz;
alter table public.profiles add column if not exists brand_id uuid references public.brands(id) on delete set null;
create index if not exists profiles_brand_idx on public.profiles(brand_id);

-- Plan with expiry applied. Everything in the app asks this, so a lapsed plan
-- can never keep paid features unlocked.
create or replace function public.effective_plan(p_user uuid)
returns text language sql stable security definer set search_path = public as $$
  select case
    when p.plan is null or p.plan = 'free' then 'free'
    when p.plan_expires_at is not null and p.plan_expires_at < now() then 'free'
    else p.plan
  end
  from public.profiles p where p.id = p_user;
$$;
grant execute on function public.effective_plan(uuid) to anon, authenticated;

/** The signed-in user's own plan — what the app calls on every page load. */
create or replace function public.my_plan()
returns table (plan text, expires_at timestamptz, brand_id uuid)
language sql stable security definer set search_path = public as $$
  select public.effective_plan(auth.uid()), p.plan_expires_at, p.brand_id
  from public.profiles p where p.id = auth.uid();
$$;
grant execute on function public.my_plan() to authenticated;

/* ---------------- wholesale rates ---------------- */
create table if not exists public.plan_rates (
  plan        text primary key check (plan in ('pro','team')),
  price_paise bigint not null                   -- list price for one month
);
insert into public.plan_rates (plan, price_paise) values ('pro', 39900), ('team', 24900)
  on conflict (plan) do nothing;

-- Partners buy activations below list price; the gap is their margin.
alter table public.brands add column if not exists rate_discount_pct int not null default 0
  check (rate_discount_pct between 0 and 90);

grant select on public.plan_rates to anon, authenticated;

/* ---------------- who may act for a partner ---------------- */
create table if not exists public.brand_admins (
  brand_id uuid not null references public.brands(id) on delete cascade,
  user_id  uuid not null references public.profiles(id) on delete cascade,
  primary key (brand_id, user_id)
);
alter table public.brand_admins enable row level security;
drop policy if exists "read own brand admin" on public.brand_admins;
create policy "read own brand admin" on public.brand_admins
  for select using (auth.uid() = user_id);
grant select on public.brand_admins to authenticated;

/** Which brand does this user administer? Null for ordinary members. */
create or replace function public.my_brand()
returns uuid language sql stable security definer set search_path = public as $$
  select brand_id from public.brand_admins where user_id = auth.uid() limit 1;
$$;
grant execute on function public.my_brand() to authenticated;

/* ---------------- wallet ---------------- */
create table if not exists public.partner_wallets (
  brand_id      uuid primary key references public.brands(id) on delete cascade,
  balance_paise bigint not null default 0 check (balance_paise >= 0),
  updated_at    timestamptz not null default now()
);

-- Append-only history. Every credit and debit is a row, so the balance can
-- always be re-derived and disputes have an audit trail.
create table if not exists public.wallet_ledger (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands(id) on delete cascade,
  kind          text not null check (kind in ('topup','activation','refund','adjustment')),
  amount_paise  bigint not null,                 -- positive credit, negative debit
  balance_after bigint not null,
  member_id     uuid references public.profiles(id) on delete set null,
  member_email  text,
  plan          text,
  months        int,
  note          text,
  created_at    timestamptz not null default now()
);
create index if not exists ledger_brand_idx on public.wallet_ledger(brand_id, created_at desc);

create table if not exists public.topup_requests (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands(id) on delete cascade,
  amount_paise  bigint not null check (amount_paise > 0),
  method        text not null default 'bank',    -- bank | upi | cash | other
  reference     text,                            -- UTR / transaction reference
  note          text,
  status        text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note    text,
  requested_by  uuid references public.profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  decided_at    timestamptz
);
create index if not exists topups_status_idx on public.topup_requests(status, created_at desc);

alter table public.partner_wallets enable row level security;
alter table public.wallet_ledger   enable row level security;
alter table public.topup_requests  enable row level security;

-- A partner sees only their own wallet, ledger and requests.
drop policy if exists "partner reads wallet" on public.partner_wallets;
create policy "partner reads wallet" on public.partner_wallets
  for select using (brand_id = public.my_brand());

drop policy if exists "partner reads ledger" on public.wallet_ledger;
create policy "partner reads ledger" on public.wallet_ledger
  for select using (brand_id = public.my_brand());

drop policy if exists "partner reads topups" on public.topup_requests;
create policy "partner reads topups" on public.topup_requests
  for select using (brand_id = public.my_brand());

drop policy if exists "partner creates topups" on public.topup_requests;
create policy "partner creates topups" on public.topup_requests
  for insert with check (brand_id = public.my_brand() and status = 'pending');

grant select on public.partner_wallets, public.wallet_ledger to authenticated;
grant select, insert on public.topup_requests to authenticated;

/* ---------------- what an activation costs this partner ---------------- */
create or replace function public.activation_cost(p_brand uuid, p_plan text, p_months int)
returns bigint language sql stable security definer set search_path = public as $$
  select greatest(0, (r.price_paise * greatest(p_months, 1)
         * (100 - coalesce(b.rate_discount_pct, 0)) / 100)::bigint)
  from public.plan_rates r
  cross join public.brands b
  where r.plan = p_plan and b.id = p_brand;
$$;
grant execute on function public.activation_cost(uuid, text, int) to authenticated;

/* ---------------- activate a member, debiting the partner ----------------
 * One transaction: check balance → debit → log → set the plan. A failure at
 * any step rolls the whole thing back, so the wallet can never be charged for
 * an activation that didn't happen (or vice versa).
 */
create or replace function public.partner_activate(
  p_member_email text, p_plan text, p_months int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_brand   uuid := public.my_brand();
  v_member  uuid;
  v_cost    bigint;
  v_balance bigint;
  v_from    timestamptz;
begin
  if v_brand is null then
    return jsonb_build_object('ok', false, 'error', 'You are not a partner administrator.');
  end if;
  if p_plan not in ('pro','team') then
    return jsonb_build_object('ok', false, 'error', 'Unknown plan.');
  end if;
  p_months := greatest(coalesce(p_months, 1), 1);

  select u.id into v_member from auth.users u
   where lower(u.email) = lower(trim(p_member_email)) limit 1;
  if v_member is null then
    return jsonb_build_object('ok', false, 'error', 'No user with that email. Ask them to sign up first.');
  end if;

  -- A partner may only activate their own members, never someone else's.
  if (select brand_id from public.profiles where id = v_member) is distinct from v_brand then
    return jsonb_build_object('ok', false, 'error', 'That user is not one of your members.');
  end if;

  v_cost := public.activation_cost(v_brand, p_plan, p_months);

  -- Lock the wallet row so two activations can't spend the same balance.
  select balance_paise into v_balance from public.partner_wallets
   where brand_id = v_brand for update;
  if v_balance is null then
    insert into public.partner_wallets (brand_id, balance_paise) values (v_brand, 0);
    v_balance := 0;
  end if;
  if v_balance < v_cost then
    return jsonb_build_object('ok', false, 'error', 'Not enough balance. Add funds and try again.',
                              'cost', v_cost, 'balance', v_balance);
  end if;

  v_balance := v_balance - v_cost;
  update public.partner_wallets set balance_paise = v_balance, updated_at = now()
   where brand_id = v_brand;

  -- Extend from the current expiry when the plan is still running, so an early
  -- renewal adds time instead of throwing away what they already paid for.
  select greatest(coalesce(plan_expires_at, now()), now()) into v_from
    from public.profiles where id = v_member;

  update public.profiles
     set plan = p_plan, plan_expires_at = v_from + (p_months || ' months')::interval
   where id = v_member;

  insert into public.wallet_ledger (brand_id, kind, amount_paise, balance_after,
                                    member_id, member_email, plan, months, note)
  values (v_brand, 'activation', -v_cost, v_balance, v_member, lower(trim(p_member_email)),
          p_plan, p_months, 'Activated by partner');

  return jsonb_build_object('ok', true, 'cost', v_cost, 'balance', v_balance,
                            'expires', v_from + (p_months || ' months')::interval);
end $$;
grant execute on function public.partner_activate(text, text, int) to authenticated;

select 'wallet schema ready' as status;
