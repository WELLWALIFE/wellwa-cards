-- 0070 — CRM Pro, phase 3 (docs/crm-pro.md 3.9, 3.10, 3.11): what was sold, quotations, and merging a customer who
-- came in twice (WhatsApp sometimes hides the number behind an id, so one person can arrive as two leads).

-- ---- sales -----------------------------------------------------------------
create table if not exists public.crm_sales (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  lead_id      uuid not null references public.leads(id) on delete cascade,
  agent_id     uuid references public.profiles(id) on delete set null,
  items        jsonb not null default '[]'::jsonb,     -- [{product_id, name, qty, rate_paise}]
  amount_paise bigint not null default 0,
  paid_paise   bigint not null default 0,
  status       text not null default 'open' check (status in ('open','partial','paid','refunded')),
  method       text not null default '',               -- upi | cash | card | bank | other
  sold_at      timestamptz not null default now(),
  note         text not null default '',
  quote_id     uuid,
  created_at   timestamptz not null default now()
);
create index if not exists crm_sales_owner_idx on public.crm_sales (owner_id, sold_at desc);
create index if not exists crm_sales_lead_idx on public.crm_sales (lead_id, sold_at desc);
alter table public.crm_sales enable row level security;
drop policy if exists "owner all crm_sales" on public.crm_sales;
create policy "owner all crm_sales" on public.crm_sales for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "agent crm_sales" on public.crm_sales;
create policy "agent crm_sales" on public.crm_sales for all
  using (public.crm_agent_of(owner_id) = 'manager' or (public.crm_agent_of(owner_id) = 'agent' and exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid())))
  with check (public.crm_agent_of(owner_id) is not null);
grant select, insert, update, delete on public.crm_sales to authenticated;
revoke all on public.crm_sales from anon;

-- A sale makes the lead a customer and keeps the deal value at least the sum of what was sold.
create or replace function public.crm_sales_touch() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_lead uuid := coalesce(new.lead_id, old.lead_id); v_sum bigint;
begin
  select coalesce(sum(amount_paise), 0) into v_sum from public.crm_sales where lead_id = v_lead and status <> 'refunded';
  update public.leads set kind = case when v_sum > 0 then 'customer' else kind end,
    value_paise = greatest(value_paise, v_sum), last_activity_at = greatest(last_activity_at, now()) where id = v_lead;
  return coalesce(new, old);
end $$;
drop trigger if exists crm_sales_touch on public.crm_sales;
create trigger crm_sales_touch after insert or update or delete on public.crm_sales for each row execute function public.crm_sales_touch();

-- ---- quotations -------------------------------------------------------------
create table if not exists public.crm_quotes (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles(id) on delete cascade,
  lead_id        uuid not null references public.leads(id) on delete cascade,
  number         text not null,                          -- Q-2026-0001, per owner
  items          jsonb not null default '[]'::jsonb,     -- [{product_id, name, qty, rate_paise, discount_pct}]
  subtotal_paise bigint not null default 0,
  discount_paise bigint not null default 0,
  gst_pct        numeric(5,2) not null default 0,
  total_paise    bigint not null default 0,
  valid_till     date,
  note           text not null default '',
  pdf_url        text,
  status         text not null default 'draft' check (status in ('draft','sent','accepted','rejected','expired')),
  sale_id        uuid references public.crm_sales(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (owner_id, number)
);
create index if not exists crm_quotes_lead_idx on public.crm_quotes (lead_id, created_at desc);
alter table public.crm_quotes enable row level security;
drop policy if exists "owner all crm_quotes" on public.crm_quotes;
create policy "owner all crm_quotes" on public.crm_quotes for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "agent crm_quotes" on public.crm_quotes;
create policy "agent crm_quotes" on public.crm_quotes for all
  using (public.crm_agent_of(owner_id) = 'manager' or (public.crm_agent_of(owner_id) = 'agent' and exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid())))
  with check (public.crm_agent_of(owner_id) is not null);
grant select, insert, update, delete on public.crm_quotes to authenticated;
revoke all on public.crm_quotes from anon;

-- Next quote number for an owner (Q-<year>-0001 …), race-safe enough for one shop.
create or replace function public.crm_next_quote_number(p_owner uuid) returns text
language sql security definer set search_path = public as $$
  select 'Q-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-' ||
         lpad((coalesce(max(nullif(regexp_replace(split_part(number, '-', 3), '\D', '', 'g'), '')::int), 0) + 1)::text, 4, '0')
    from public.crm_quotes
   where owner_id = p_owner and number like 'Q-' || to_char(now() at time zone 'Asia/Kolkata', 'YYYY') || '-%';
$$;
revoke all on function public.crm_next_quote_number(uuid) from public, anon, authenticated;
grant execute on function public.crm_next_quote_number(uuid) to service_role;

-- ---- merge two leads of the same person ------------------------------------
-- Everything of p_drop moves to p_keep (messages by phone, timeline, tasks, calls, sales, quotes, bookings, AI calls),
-- tags are joined, the earlier created_at and the larger value win, empty profile fields are filled from p_drop.
-- The dropped lead's number is kept as alt_phone when the kept one has none, then the dropped lead is deleted.
create or replace function public.crm_merge_leads(p_owner uuid, p_keep uuid, p_drop uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare k public.leads; d public.leads;
begin
  if p_keep = p_drop then raise exception 'SAME_LEAD'; end if;
  select * into k from public.leads where id = p_keep and owner_id = p_owner for update;
  select * into d from public.leads where id = p_drop and owner_id = p_owner for update;
  if k.id is null or d.id is null then raise exception 'NOT_FOUND'; end if;

  update public.wa_messages set phone = k.phone where owner_id = p_owner and phone = d.phone and d.phone <> k.phone;
  update public.lead_events set lead_id = k.id where lead_id = d.id;
  update public.crm_tasks set lead_id = k.id where lead_id = d.id;
  update public.crm_calls set lead_id = k.id where lead_id = d.id;
  update public.crm_sales set lead_id = k.id where lead_id = d.id;
  update public.crm_quotes set lead_id = k.id where lead_id = d.id;
  update public.bookings set lead_id = k.id where lead_id = d.id;
  update public.phone_calls set lead_id = k.id where lead_id = d.id;

  update public.leads set
    name        = case when coalesce(name, '') = '' then d.name else name end,
    email       = case when coalesce(email, '') = '' then d.email else email end,
    city        = case when coalesce(city, '') = '' then d.city else city end,
    business    = case when coalesce(business, '') = '' then d.business else business end,
    address     = case when coalesce(address, '') = '' then d.address else address end,
    alt_phone   = case when coalesce(alt_phone, '') = '' and d.phone <> phone then d.phone else alt_phone end,
    notes       = trim(both E'\n' from coalesce(notes, '') || case when coalesce(d.notes, '') <> '' then E'\n' || d.notes else '' end),
    tags        = (select coalesce(array_agg(distinct t), '{}') from unnest(coalesce(tags, '{}') || coalesce(d.tags, '{}')) t),
    value_paise = greatest(value_paise, d.value_paise),
    score       = greatest(score, d.score),
    unread      = unread + d.unread,
    calls_count = calls_count + d.calls_count,
    birthday    = coalesce(birthday, d.birthday),
    anniversary = coalesce(anniversary, d.anniversary),
    assigned_to = coalesce(assigned_to, d.assigned_to),
    created_at  = least(created_at, d.created_at),
    last_message_at  = greatest(coalesce(last_message_at, 'epoch'), coalesce(d.last_message_at, 'epoch')),
    last_activity_at = greatest(last_activity_at, d.last_activity_at, now()),
    updated_at  = now()
  where id = k.id;

  delete from public.leads where id = d.id;
  insert into public.lead_events (owner_id, lead_id, kind, text) values (p_owner, k.id, 'merge', 'Merged with ' || coalesce(nullif(d.name, ''), d.phone));
  return k.id;
end $$;
revoke all on function public.crm_merge_leads(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.crm_merge_leads(uuid, uuid, uuid) to service_role;

select 'crm pro phase 3 ready' as status;
