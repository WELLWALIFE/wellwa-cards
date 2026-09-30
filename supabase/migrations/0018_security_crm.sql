-- Production hardening plus the expanded lead pipeline.

-- Paid plans can only be activated by the server after provider verification.
do $$ begin
  if to_regprocedure('public.set_plan(text)') is not null then
    execute 'revoke all on function public.set_plan(text) from public, anon, authenticated';
  end if;
  if to_regprocedure('public.record_payment(text,integer,text,integer)') is not null then
    execute 'revoke all on function public.record_payment(text, int, text, int) from public, anon, authenticated';
  end if;
end $$;

-- Some early live installs skipped 0003 even though later billing functions
-- were added. Create the ledger table here so the hardening migration is
-- self-contained on those databases too.
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null check (plan in ('free','pro','team')),
  status text not null default 'active',
  provider text not null default 'razorpay',
  provider_ref text,
  amount int,
  period text default 'monthly',
  created_at timestamptz not null default now(),
  current_end timestamptz
);
create index if not exists subs_owner_idx on public.subscriptions(owner_id);
alter table public.subscriptions enable row level security;
drop policy if exists "owner reads subs" on public.subscriptions;
create policy "owner reads subs" on public.subscriptions
  for select using (auth.uid() = owner_id);
grant select on public.subscriptions to authenticated;

revoke insert on public.subscriptions from authenticated;
drop policy if exists "owner writes subs" on public.subscriptions;

alter table public.subscriptions add column if not exists provider_order_ref text;
create unique index if not exists subscriptions_provider_ref_unique
  on public.subscriptions(provider, provider_ref) where provider_ref is not null;

create or replace function public.apply_verified_payment(
  p_user uuid, p_plan text, p_ref text, p_order_ref text, p_amount int
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_from timestamptz; v_end timestamptz;
begin
  if p_user is null or p_plan not in ('pro','team') or
     coalesce(trim(p_ref), '') = '' or coalesce(trim(p_order_ref), '') = '' or p_amount <= 0 then
    raise exception 'Invalid verified payment';
  end if;

  if exists (select 1 from public.subscriptions where provider = 'razorpay' and provider_ref = p_ref) then
    select current_end into v_end from public.subscriptions
      where provider = 'razorpay' and provider_ref = p_ref;
    return jsonb_build_object('ok', true, 'replayed', true, 'expires', v_end);
  end if;

  select greatest(coalesce(plan_expires_at, now()), now()) into v_from
    from public.profiles where id = p_user for update;
  if v_from is null then raise exception 'User profile not found'; end if;
  v_end := v_from + interval '1 month';

  insert into public.subscriptions
    (owner_id, plan, status, provider, provider_ref, provider_order_ref, amount, current_end)
  values (p_user, p_plan, 'active', 'razorpay', p_ref, p_order_ref, p_amount, v_end);

  update public.profiles set plan = p_plan, plan_source = 'paid', plan_expires_at = v_end
    where id = p_user;
  return jsonb_build_object('ok', true, 'replayed', false, 'plan', p_plan, 'expires', v_end);
end $$;
revoke all on function public.apply_verified_payment(uuid,text,text,text,int) from public, anon, authenticated;
grant execute on function public.apply_verified_payment(uuid,text,text,text,int) to service_role;

-- Password copies are forbidden; Supabase Auth remains the credential store.
update public.admin_vault set credentials = '[]'::jsonb, updated_at = now() where id = 1;
revoke all on public.admin_vault from anon, authenticated;

-- A complete but deliberately simple sales pipeline.
alter table public.leads add column if not exists notes text not null default '';
alter table public.leads add column if not exists next_follow_up timestamptz;
alter table public.leads add column if not exists value_paise bigint not null default 0;
alter table public.leads add column if not exists lost_reason text not null default '';
alter table public.leads add column if not exists updated_at timestamptz not null default now();
create index if not exists leads_follow_up_idx on public.leads(owner_id, next_follow_up)
  where next_follow_up is not null;

-- Visitors submit through the validated server route, never directly to a table.
drop policy if exists "anyone submits lead" on public.leads;
revoke insert on public.leads from anon;

-- Uploads must stay inside the signed-in owner's folder.
drop policy if exists "auth uploads media" on storage.objects;
create policy "auth uploads own media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
  );
update storage.buckets set file_size_limit = 5242880 where id = 'media';

-- Do not expose arbitrary users' plan status as a public RPC.
revoke execute on function public.effective_plan(uuid) from anon, authenticated;

select 'security and CRM hardening ready' as status;
