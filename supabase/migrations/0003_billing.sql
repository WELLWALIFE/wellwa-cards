-- ============================================================
-- Wellwa Cards — billing (Razorpay)
-- Run in Supabase SQL Editor after 0001/0002.
-- ============================================================

-- Track paid subscriptions. `plan` on profiles reflects the active plan.
create table if not exists public.subscriptions (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  plan          text not null check (plan in ('free','pro','team')),
  status        text not null default 'active',      -- active | cancelled | expired
  provider      text not null default 'razorpay',
  provider_ref  text,                                 -- razorpay payment id
  amount        int,                                  -- paise
  period        text default 'monthly',
  created_at    timestamptz not null default now(),
  current_end   timestamptz
);
create index if not exists subs_owner_idx on public.subscriptions(owner_id);

alter table public.subscriptions enable row level security;

drop policy if exists "owner reads subs" on public.subscriptions;
create policy "owner reads subs" on public.subscriptions
  for select using (auth.uid() = owner_id);

-- Inserts/updates come from the server (service role or verified route);
-- allow the owner to insert their own row too (post-payment write from client).
drop policy if exists "owner writes subs" on public.subscriptions;
create policy "owner writes subs" on public.subscriptions
  for insert with check (auth.uid() = owner_id);

grant select, insert on public.subscriptions to authenticated;

-- helper: set a user's plan (called after verified payment)
create or replace function public.set_plan(p_plan text)
returns void language sql security definer set search_path = public as $$
  update public.profiles set plan = p_plan where id = auth.uid();
$$;
grant execute on function public.set_plan(text) to authenticated;

select 'billing schema ready' as status;
