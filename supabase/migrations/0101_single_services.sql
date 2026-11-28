-- 0101 — Single services (owner, 28 Nov 2026: "Growth Plan me jo bhi hai, unko individual bhi kar dete hain; koi akela lena chahe le
-- sakta hai, aur suggestion denge ki Growth Plan me ye sab itne me milega"). Safe to run more than once.
--
--   A part of the Growth Plan can be bought alone, by the month: WhatsApp AI (wa_ai), CRM (crm), daily posters + auto-post (posters),
--   Google review replies and posts (google). Prices live in src/lib/single-services.ts. Broadcasts and the monthly report stay Growth-only.
--
--   profiles.svc_<key>_until  the paid end of that one service. The app gives the same 7 grace days the Growth Plan has. A running
--                             Growth / Pro plan covers every service, so these dates only matter for an account without one.
--   payment_requests          kind 'service' + the `service` it buys (an admin / franchise link, or the account's own purchase).
--   apply_service()           N months of one service for a verified payment, from the later of today and its current end.
--
-- No partner BV is reported for a single service until the owner fixes its BV in the partner panel (src/lib/payments-server.ts).
-- The app reads these columns in their own request, so it keeps working (without single services) before this file is run.

alter table public.profiles add column if not exists svc_wa_ai_until   timestamptz;
alter table public.profiles add column if not exists svc_crm_until     timestamptz;
alter table public.profiles add column if not exists svc_posters_until timestamptz;
alter table public.profiles add column if not exists svc_google_until  timestamptz;

-- The billing guard (0057): the user cannot write these from the app either. Also 0087's website package (package,
-- package_until), which only Super Admin sets and which the guard had missed.
create or replace function public.profiles_billing_guard()
returns trigger language plpgsql set search_path = public as $$
declare
  cols text[] := array['plan','plan_source','plan_expires_at','trial_started_at','saas_tier','saas_expires_at',
                       'saas_started_at','poster_plan','poster_plan_expires_at','card_expires_at',
                       'package','package_until',
                       'svc_wa_ai_until','svc_crm_until','svc_posters_until','svc_google_until'];
  o jsonb; n jsonb; c text; changed boolean := false;
begin
  if current_user not in ('authenticated', 'anon') then return new; end if;
  if tg_op = 'INSERT' then
    raise exception 'Profiles are created by the server';
  end if;
  o := to_jsonb(old); n := to_jsonb(new);
  foreach c in array cols loop
    if o ? c and (n -> c) is distinct from (o -> c) then
      n := jsonb_set(n, array[c], o -> c);
      changed := true;
    end if;
  end loop;
  if changed then new := jsonb_populate_record(new, n); end if;
  return new;
end $$;

-- Payment links for one service.
alter table public.payment_requests add column if not exists service text;
do $$ declare c record; begin
  for c in select conname from pg_constraint
            where conrelid = 'public.payment_requests'::regclass and contype = 'c'
              and (pg_get_constraintdef(oid) ~ '\mkind\M' or pg_get_constraintdef(oid) ~ '\mservice\M')
  loop execute format('alter table public.payment_requests drop constraint %I', c.conname); end loop;
end $$;
alter table public.payment_requests add constraint payment_requests_kind_check check (kind in ('plan','advance','custom','service'));
alter table public.payment_requests add constraint payment_requests_service_check
  check ((kind = 'service' and service in ('wa_ai','crm','posters','google')) or (kind <> 'service' and service is null));

-- N months of one service. Idempotent per payment: the request is claimed by its payment id before this runs, and a second call
-- with the same ref finds it in svc_ledger and answers "replayed".
create table if not exists public.svc_ledger (
  id         bigserial primary key,
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  service    text not null check (service in ('wa_ai','crm','posters','google')),
  months     int  not null check (months between 1 and 36),
  amount     int  not null,
  ref        text not null unique,
  until      timestamptz not null,
  created_at timestamptz not null default now()
);
alter table public.svc_ledger enable row level security;
revoke all on public.svc_ledger from anon, authenticated;
grant all on public.svc_ledger to service_role;
grant usage, select on sequence public.svc_ledger_id_seq to service_role;

create or replace function public.apply_service(p_user uuid, p_service text, p_months int, p_ref text, p_amount int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_col text; v_from timestamptz; v_end timestamptz; v_months int := greatest(1, least(36, coalesce(p_months, 1)));
begin
  if p_user is null or p_service not in ('wa_ai','crm','posters','google') or coalesce(trim(p_ref), '') = '' or coalesce(p_amount, 0) < 0 then
    raise exception 'Invalid service payment';
  end if;
  v_col := 'svc_' || p_service || '_until';
  perform 1 from public.profiles where id = p_user for update;
  if not found then raise exception 'User profile not found'; end if;
  select until into v_end from public.svc_ledger where ref = p_ref;
  if v_end is not null then return jsonb_build_object('ok', true, 'replayed', true, 'until', v_end); end if;
  execute format('select greatest(coalesce(%I, now()), now()) from public.profiles where id = $1', v_col) into v_from using p_user;
  v_end := v_from + make_interval(months => v_months);
  execute format('update public.profiles set %I = $1 where id = $2', v_col) using v_end, p_user;
  insert into public.svc_ledger(owner_id, service, months, amount, ref, until) values (p_user, p_service, v_months, p_amount, p_ref, v_end);
  return jsonb_build_object('ok', true, 'replayed', false, 'service', p_service, 'months', v_months, 'until', v_end);
end $$;
revoke all on function public.apply_service(uuid, text, int, text, int) from public, anon, authenticated;
grant execute on function public.apply_service(uuid, text, int, text, int) to service_role;

notify pgrst, 'reload schema';

select count(*) as profiles, count(svc_wa_ai_until) as with_wa_ai from public.profiles;
