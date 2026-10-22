-- 0072 — payment safety (code review, Oct 2026). Safe to run more than once.
--
-- 1) apply_saas_payment: take the profile lock BEFORE the "already applied?" check (0058 had it this way; 0066 put the
--    check first again). When the payment page's verify and Razorpay's webhook arrive together, the second call now waits,
--    then sees the first one's row and answers "replayed" instead of failing on the unique index (a 500 for a customer
--    who has paid).
create or replace function public.apply_saas_payment(p_user uuid, p_tier text, p_ref text, p_order_ref text, p_amount int, p_credits int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_from timestamptz; v_end timestamptz; v_grace interval := interval '7 days';
begin
  if p_user is null or p_tier not in ('starter','growth','pro') or coalesce(trim(p_ref),'') = '' or coalesce(trim(p_order_ref),'') = '' or p_amount <= 0 then
    raise exception 'Invalid verified payment';
  end if;
  select greatest(coalesce(saas_expires_at, now()), now()) into v_from from public.profiles where id = p_user for update;
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
         poster_plan = case when p_tier = 'starter' then poster_plan else 'business' end,
         poster_plan_expires_at = case when p_tier = 'starter' then poster_plan_expires_at else v_end + v_grace end
   where id = p_user;
  insert into public.subscriptions(owner_id, plan, status, provider, provider_ref, amount, period, current_end)
    values (p_user, 'pro', 'active', 'razorpay', p_ref, p_amount, 'monthly', v_end);
  perform public.grant_monthly_credits(p_user, p_credits, v_end);
  return jsonb_build_object('ok', true, 'replayed', false, 'tier', p_tier, 'expires', v_end, 'credits', p_credits);
end $$;
revoke all on function public.apply_saas_payment(uuid,text,text,text,int,int) from public, anon, authenticated;
grant execute on function public.apply_saas_payment(uuid,text,text,text,int,int) to service_role;

-- 2) One credit purchase per Razorpay payment, enforced by the database (the app's own check is per process only).
--    Created only when no duplicate already exists, so this migration never fails on old data.
do $$
begin
  if not exists (
    select 1 from public.credit_ledger where reason = 'purchase' and ref is not null group by ref having count(*) > 1
  ) then
    execute 'create unique index if not exists credit_ledger_purchase_ref_uidx on public.credit_ledger(ref) where reason = ''purchase'' and ref is not null';
  else
    raise notice 'credit_ledger has duplicate purchase refs — unique index not created';
  end if;
end $$;

select 'payment safety ready' as status;
