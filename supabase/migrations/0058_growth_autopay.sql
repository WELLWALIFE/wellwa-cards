-- 0058: Growth by autopay (owner's call, 27 Sep 2026).
--   Growth (₹2,999 a month) is now taken only with an auto-debit mandate — UPI Autopay (PhonePe, Google Pay, Paytm, …)
--   or a card — through Razorpay Subscriptions. Every monthly debit adds one month exactly like a manual payment
--   (apply_saas_payment) and counts as renewal business for the partner panel. The customer can stop it any time from
--   My plan or from their UPI app; the month already paid keeps running.
--
--   • saas_autopay — one row per Razorpay subscription (sub_…): whose it is and where it stands. Written only by the
--     server (service role); the owner can read their own.
--   • apply_saas_payment — the same as 0047, but the profile row is locked BEFORE the "already applied?" check, so the
--     checkout confirmation and Razorpay's webhook arriving together for the same payment can never add two months.

create table if not exists public.saas_autopay (
  id          text primary key,                                   -- Razorpay subscription id (sub_…)
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  tier        text not null default 'growth' check (tier in ('growth','pro')),
  status      text not null default 'created',                    -- Razorpay's: created | authenticated | active | pending | halted | cancelled | completed | expired | paused
  charge_at   timestamptz,                                        -- the next debit, as Razorpay last told us
  paid_count  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists saas_autopay_owner_idx on public.saas_autopay(owner_id, created_at desc);

alter table public.saas_autopay enable row level security;
drop policy if exists saas_autopay_own_read on public.saas_autopay;
create policy saas_autopay_own_read on public.saas_autopay for select to authenticated using (owner_id = auth.uid());
revoke all on public.saas_autopay from anon, authenticated;
grant select on public.saas_autopay to authenticated;          -- RLS above: own rows only
grant all on public.saas_autopay to service_role;

create or replace function public.apply_saas_payment(p_user uuid, p_tier text, p_ref text, p_order_ref text, p_amount int, p_credits int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_from timestamptz; v_end timestamptz; v_grace interval := interval '7 days';
begin
  if p_user is null or p_tier not in ('growth','pro') or coalesce(trim(p_ref),'') = '' or coalesce(trim(p_order_ref),'') = '' or p_amount <= 0 then
    raise exception 'Invalid verified payment';
  end if;
  -- Lock first: a second call for the same payment waits here, then sees it below as already applied.
  select greatest(coalesce(saas_expires_at, now()), now()) into v_from from public.profiles where id = p_user for update;
  if not found then raise exception 'Unknown user'; end if;
  if exists (select 1 from public.subscriptions where provider = 'razorpay' and provider_ref = p_ref) then
    select current_end into v_end from public.subscriptions where provider = 'razorpay' and provider_ref = p_ref;
    return jsonb_build_object('ok', true, 'replayed', true, 'expires', v_end);
  end if;
  v_end := v_from + interval '1 month';
  update public.profiles
     set saas_tier = p_tier,
         saas_expires_at = v_end,
         saas_started_at = coalesce(saas_started_at, now()),
         plan = 'pro', plan_source = 'paid', plan_expires_at = v_end + v_grace,
         poster_plan = 'business', poster_plan_expires_at = v_end + v_grace
   where id = p_user;
  insert into public.subscriptions(owner_id, plan, status, provider, provider_ref, amount, period, current_end)
    values (p_user, 'pro', 'active', 'razorpay', p_ref, p_amount, 'monthly', v_end);
  perform public.grant_monthly_credits(p_user, p_credits, v_end);
  return jsonb_build_object('ok', true, 'tier', p_tier, 'expires', v_end, 'credits', p_credits);
end $$;
revoke all on function public.apply_saas_payment(uuid,text,text,text,int,int) from public, anon, authenticated;
grant execute on function public.apply_saas_payment(uuid,text,text,text,int,int) to service_role;

notify pgrst, 'reload schema';
select 'ok' as status;
