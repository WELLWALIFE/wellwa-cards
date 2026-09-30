-- Super-admin side of the wallet: approving a top-up, and granting a plan
-- directly. Both run as definer and are only reachable through server routes
-- that already checked the super-admin password.

/** Approve a pending top-up: credit the wallet and log it, atomically. */
create or replace function public.admin_approve_topup(p_request uuid, p_admin_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r         public.topup_requests;
  v_balance bigint;
begin
  select * into r from public.topup_requests where id = p_request for update;
  if r.id is null then
    return jsonb_build_object('ok', false, 'error', 'Request not found.');
  end if;
  -- Guard against a double-click crediting the wallet twice.
  if r.status <> 'pending' then
    return jsonb_build_object('ok', false, 'error', 'Already ' || r.status || '.');
  end if;

  insert into public.partner_wallets (brand_id, balance_paise) values (r.brand_id, 0)
    on conflict (brand_id) do nothing;

  update public.partner_wallets
     set balance_paise = balance_paise + r.amount_paise, updated_at = now()
   where brand_id = r.brand_id
  returning balance_paise into v_balance;

  insert into public.wallet_ledger (brand_id, kind, amount_paise, balance_after, note)
  values (r.brand_id, 'topup', r.amount_paise, v_balance,
          coalesce(nullif(trim(r.reference), ''), 'Top-up') || ' (' || r.method || ')');

  update public.topup_requests
     set status = 'approved', admin_note = p_admin_note, decided_at = now()
   where id = p_request;

  return jsonb_build_object('ok', true, 'balance', v_balance);
end $$;

create or replace function public.admin_reject_topup(p_request uuid, p_admin_note text default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  update public.topup_requests
     set status = 'rejected', admin_note = p_admin_note, decided_at = now()
   where id = p_request and status = 'pending';
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Not pending.');
  end if;
  return jsonb_build_object('ok', true);
end $$;

/** Adjust a wallet by hand (correction, refund, goodwill credit). */
create or replace function public.admin_adjust_wallet(p_brand uuid, p_amount bigint, p_note text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_balance bigint;
begin
  insert into public.partner_wallets (brand_id, balance_paise) values (p_brand, 0)
    on conflict (brand_id) do nothing;

  select balance_paise into v_balance from public.partner_wallets where brand_id = p_brand for update;
  if v_balance + p_amount < 0 then
    return jsonb_build_object('ok', false, 'error', 'That would take the balance below zero.');
  end if;

  update public.partner_wallets set balance_paise = balance_paise + p_amount, updated_at = now()
   where brand_id = p_brand returning balance_paise into v_balance;

  insert into public.wallet_ledger (brand_id, kind, amount_paise, balance_after, note)
  values (p_brand, case when p_amount >= 0 then 'adjustment' else 'refund' end,
          p_amount, v_balance, coalesce(p_note, 'Manual adjustment'));

  return jsonb_build_object('ok', true, 'balance', v_balance);
end $$;

/** Grant or clear a plan for any user, without touching a wallet. */
create or replace function public.admin_set_plan(p_user uuid, p_plan text, p_months int default 12)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_from timestamptz;
begin
  if p_plan not in ('free','pro','team') then
    return jsonb_build_object('ok', false, 'error', 'Unknown plan.');
  end if;
  if p_plan = 'free' then
    update public.profiles set plan = 'free', plan_expires_at = null where id = p_user;
    return jsonb_build_object('ok', true, 'plan', 'free');
  end if;

  select greatest(coalesce(plan_expires_at, now()), now()) into v_from
    from public.profiles where id = p_user;
  update public.profiles
     set plan = p_plan, plan_expires_at = v_from + (greatest(coalesce(p_months,12),1) || ' months')::interval
   where id = p_user;

  return jsonb_build_object('ok', true, 'plan', p_plan);
end $$;

/** Record a verified Razorpay payment — the direct-customer path. */
create or replace function public.record_payment(p_plan text, p_months int, p_ref text, p_amount int)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_from timestamptz; v_user uuid := auth.uid();
begin
  if v_user is null then return jsonb_build_object('ok', false, 'error', 'Not signed in.'); end if;
  if p_plan not in ('pro','team') then return jsonb_build_object('ok', false, 'error', 'Unknown plan.'); end if;

  select greatest(coalesce(plan_expires_at, now()), now()) into v_from
    from public.profiles where id = v_user;

  update public.profiles
     set plan = p_plan, plan_expires_at = v_from + (greatest(coalesce(p_months,1),1) || ' months')::interval
   where id = v_user;

  insert into public.subscriptions (owner_id, plan, status, provider, provider_ref, amount, current_end)
  values (v_user, p_plan, 'active', 'razorpay', p_ref, p_amount,
          v_from + (greatest(coalesce(p_months,1),1) || ' months')::interval);

  return jsonb_build_object('ok', true, 'plan', p_plan);
end $$;
grant execute on function public.record_payment(text, int, text, int) to authenticated;

-- Only the server (service role) may call the admin functions.
revoke all on function public.admin_approve_topup(uuid, text) from public, anon, authenticated;
revoke all on function public.admin_reject_topup(uuid, text)  from public, anon, authenticated;
revoke all on function public.admin_adjust_wallet(uuid, bigint, text) from public, anon, authenticated;
revoke all on function public.admin_set_plan(uuid, text, int) from public, anon, authenticated;

select 'wallet admin ready' as status;
