-- 0066 — Starter plan, ₹999 a month (owner's call, 8 Oct 2026, phase 2).
-- The AI salesman, orders, bookings, follow-ups, the weekly report and festival wishes — without Growth's daily
-- posters, social posting, AI pictures and own domain. In the database it is one more saas tier; the app decides what
-- Starter may use (posterQuota and the domain box look at saas_tier).
alter table public.profiles drop constraint if exists profiles_saas_tier_check;
alter table public.profiles add constraint profiles_saas_tier_check check (saas_tier in ('none','starter','growth','pro'));

create or replace function public.apply_saas_payment(p_user uuid, p_tier text, p_ref text, p_order_ref text, p_amount int, p_credits int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_from timestamptz; v_end timestamptz; v_grace interval := interval '7 days';
begin
  if p_user is null or p_tier not in ('starter','growth','pro') or coalesce(trim(p_ref),'') = '' or coalesce(trim(p_order_ref),'') = '' or p_amount <= 0 then
    raise exception 'Invalid verified payment';
  end if;
  if exists (select 1 from public.subscriptions where provider = 'razorpay' and provider_ref = p_ref) then
    select current_end into v_end from public.subscriptions where provider = 'razorpay' and provider_ref = p_ref;
    return jsonb_build_object('ok', true, 'replayed', true, 'expires', v_end);
  end if;
  select greatest(coalesce(saas_expires_at, now()), now()) into v_from from public.profiles where id = p_user for update;
  v_end := v_from + interval '1 month';
  update public.profiles
     set saas_tier = p_tier,
         saas_expires_at = v_end,
         saas_started_at = coalesce(saas_started_at, now()),
         plan = 'pro', plan_source = 'paid', plan_expires_at = v_end + v_grace,
         -- Starter has no posters / videos: the poster plan is left as it is; Growth and Pro turn it on.
         poster_plan = case when p_tier = 'starter' then poster_plan else 'business' end,
         poster_plan_expires_at = case when p_tier = 'starter' then poster_plan_expires_at else v_end + v_grace end
   where id = p_user;
  insert into public.subscriptions(owner_id, plan, status, provider, provider_ref, amount, period, current_end)
    values (p_user, 'pro', 'active', 'razorpay', p_ref, p_amount, 'monthly', v_end);
  perform public.grant_monthly_credits(p_user, p_credits, v_end);
  return jsonb_build_object('ok', true, 'tier', p_tier, 'expires', v_end, 'credits', p_credits);
end $$;
revoke all on function public.apply_saas_payment(uuid,text,text,text,int,int) from public, anon, authenticated;
grant execute on function public.apply_saas_payment(uuid,text,text,text,int,int) to service_role;

select 'ok' as status;
