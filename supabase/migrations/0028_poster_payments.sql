-- Shubhora plan payments (Razorpay). One row per verified payment; the
-- unique payment id makes /api/poster/pay/verify idempotent, so a retried
-- verify never extends poster_plan_expires_at twice.
create table if not exists public.poster_payments (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  plan                text not null check (plan in ('personal','business')),
  amount_paise        int  not null,
  razorpay_order_id   text not null unique,
  razorpay_payment_id text not null unique,
  created_at          timestamptz not null default now()
);
create index if not exists poster_payments_user_idx on public.poster_payments(user_id, created_at desc);

alter table public.poster_payments enable row level security;
drop policy if exists "own poster payments" on public.poster_payments;
create policy "own poster payments" on public.poster_payments
  for select using (auth.uid() = user_id);

grant select on public.poster_payments to authenticated;
grant all on public.poster_payments to service_role;
