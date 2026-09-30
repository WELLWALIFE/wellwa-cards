-- Studio: user credits + media jobs (banners & reels).
-- 1 credit = ₹1 of display value. Balances only move through the two
-- security-definer functions below — no client ever writes a number.

create table if not exists public.user_credits (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  balance int not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);
alter table public.user_credits enable row level security;
drop policy if exists "own credits" on public.user_credits;
create policy "own credits" on public.user_credits for select using (auth.uid() = user_id);
grant select on public.user_credits to authenticated;

create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  delta int not null,
  reason text not null,
  ref text,
  created_at timestamptz not null default now()
);
alter table public.credit_ledger enable row level security;
drop policy if exists "own ledger" on public.credit_ledger;
create policy "own ledger" on public.credit_ledger for select using (auth.uid() = user_id);
grant select on public.credit_ledger to authenticated;
create index if not exists credit_ledger_user_idx on public.credit_ledger(user_id, created_at desc);

create table if not exists public.media_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('banner','reel')),
  status text not null default 'queued' check (status in ('queued','running','done','failed')),
  input jsonb not null default '{}',
  output_url text,
  cost int not null default 0,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.media_jobs enable row level security;
drop policy if exists "own jobs" on public.media_jobs;
create policy "own jobs" on public.media_jobs for select using (auth.uid() = owner_id);
grant select on public.media_jobs to authenticated;
create index if not exists media_jobs_queue_idx on public.media_jobs(status, created_at) where status in ('queued','running');
create index if not exists media_jobs_owner_idx on public.media_jobs(owner_id, created_at desc);

-- Atomic debit: row-locked, refuses to go negative, always writes the ledger.
create or replace function public.spend_credits(p_user uuid, p_amount int, p_reason text, p_ref text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  if p_amount <= 0 then raise exception 'Invalid amount'; end if;
  insert into public.user_credits(user_id, balance) values (p_user, 0)
    on conflict (user_id) do nothing;
  select balance into v_balance from public.user_credits where user_id = p_user for update;
  if v_balance < p_amount then raise exception 'INSUFFICIENT_CREDITS'; end if;
  update public.user_credits set balance = balance - p_amount, updated_at = now() where user_id = p_user;
  insert into public.credit_ledger(user_id, delta, reason, ref) values (p_user, -p_amount, p_reason, p_ref);
  return v_balance - p_amount;
end $$;
revoke all on function public.spend_credits(uuid,int,text,text) from public, anon, authenticated;
grant execute on function public.spend_credits(uuid,int,text,text) to service_role;

-- Refund/grant: positive delta, ledgered. Service role only (admin API calls it).
create or replace function public.grant_credits(p_user uuid, p_amount int, p_reason text, p_ref text default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  if p_amount = 0 then raise exception 'Invalid amount'; end if;
  insert into public.user_credits(user_id, balance) values (p_user, 0)
    on conflict (user_id) do nothing;
  select balance into v_balance from public.user_credits where user_id = p_user for update;
  if v_balance + p_amount < 0 then raise exception 'INSUFFICIENT_CREDITS'; end if;
  update public.user_credits set balance = balance + p_amount, updated_at = now() where user_id = p_user;
  insert into public.credit_ledger(user_id, delta, reason, ref) values (p_user, p_amount, p_reason, p_ref);
  return v_balance + p_amount;
end $$;
revoke all on function public.grant_credits(uuid,int,text,text) from public, anon, authenticated;
grant execute on function public.grant_credits(uuid,int,text,text) to service_role;

-- The signed-in user's own balance.
create or replace function public.my_credits()
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select balance from public.user_credits where user_id = auth.uid()), 0);
$$;
grant execute on function public.my_credits() to authenticated;

-- Reels are bigger than the 5 MB avatar-era cap.
update storage.buckets set file_size_limit = 26214400 where id = 'media';

select 'studio credits ready' as status;
