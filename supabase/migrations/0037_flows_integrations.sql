-- Menu bot (flow builder) + integrations (outgoing webhooks, incoming lead hook).
-- The bridge reads wa_flows with the service key; the app edits under RLS.

-- ---- menu bot -----------------------------------------------------------
create table if not exists public.wa_flows (
  owner_id   uuid primary key references public.profiles(id) on delete cascade,
  enabled    boolean not null default false,
  data       jsonb not null default '{}'::jsonb,   -- { greetNew, triggers[], nodes[{id,title,text,options[{label,action,target,reply}]}] }
  updated_at timestamptz not null default now()
);
alter table public.wa_flows enable row level security;
drop policy if exists "owner all wa_flows" on public.wa_flows;
create policy "owner all wa_flows" on public.wa_flows for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, update, delete on public.wa_flows to authenticated;

-- ---- integrations -------------------------------------------------------
create table if not exists public.crm_integrations (
  owner_id        uuid primary key references public.profiles(id) on delete cascade,
  inbound_token   text not null unique,           -- POST /api/crm/hook/<token> creates a lead
  outbound_url    text not null default '',       -- webhook target (Zapier / Make / Sheets Apps Script / your server)
  outbound_secret text not null default '',       -- HMAC-SHA256 of the body → X-Shubhora-Signature
  outbound_events text[] not null default '{lead.created,lead.stage_changed,message.received,message.sent}',
  active          boolean not null default false,
  updated_at      timestamptz not null default now()
);
alter table public.crm_integrations enable row level security;
drop policy if exists "owner all crm_integrations" on public.crm_integrations;
create policy "owner all crm_integrations" on public.crm_integrations for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, update, delete on public.crm_integrations to authenticated;

-- Outbox: DB triggers queue events; bridge/crm-webhooks.mjs delivers them (service role).
create table if not exists public.crm_outbox (
  id           bigserial primary key,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  event        text not null,
  payload      jsonb not null,
  created_at   timestamptz not null default now(),
  delivered_at timestamptz,
  attempts     int not null default 0,
  last_error   text not null default ''
);
create index if not exists crm_outbox_pending_idx on public.crm_outbox(created_at) where delivered_at is null;
alter table public.crm_outbox enable row level security;
drop policy if exists "owner reads crm_outbox" on public.crm_outbox;
create policy "owner reads crm_outbox" on public.crm_outbox for select using (auth.uid() = owner_id);
grant select on public.crm_outbox to authenticated;
grant all on public.crm_outbox to service_role;
grant usage, select on sequence public.crm_outbox_id_seq to service_role;

create or replace function public.crm_queue(p_owner uuid, p_event text, p_payload jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.crm_integrations i where i.owner_id = p_owner and i.active and i.outbound_url <> '' and p_event = any(i.outbound_events)) then
    insert into public.crm_outbox (owner_id, event, payload) values (p_owner, p_event, p_payload);
  end if;
end $$;

create or replace function public.crm_lead_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_payload jsonb;
begin
  v_payload := jsonb_build_object('id', new.id, 'name', new.name, 'phone', new.phone, 'city', new.city, 'source', new.source,
    'stage', new.status, 'tags', to_jsonb(new.tags), 'score', new.score, 'message', new.message, 'value', coalesce(new.value_paise,0) / 100.0,
    'next_follow_up', new.next_follow_up, 'created_at', new.created_at);
  if tg_op = 'INSERT' then
    perform public.crm_queue(new.owner_id, 'lead.created', v_payload);
  elsif new.status is distinct from old.status then
    perform public.crm_queue(new.owner_id, 'lead.stage_changed', v_payload || jsonb_build_object('previous_stage', old.status));
  end if;
  return new;
end $$;
drop trigger if exists crm_lead_events on public.leads;
create trigger crm_lead_events after insert or update on public.leads for each row execute function public.crm_lead_trigger();

create or replace function public.crm_message_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform public.crm_queue(new.owner_id, case when new.direction = 'in' then 'message.received' else 'message.sent' end,
    jsonb_build_object('id', new.id, 'phone', new.phone, 'direction', new.direction, 'sender', new.sender, 'kind', new.kind, 'text', new.text, 'sent_at', new.sent_at));
  return new;
end $$;
drop trigger if exists crm_message_events on public.wa_messages;
create trigger crm_message_events after insert on public.wa_messages for each row execute function public.crm_message_trigger();

-- Incoming hook: create-or-update a lead by token (service role, called by the API route).
create or replace function public.crm_inbound_lead(p_token text, p_name text, p_phone text, p_message text, p_source text, p_city text, p_tags text[])
returns uuid
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_card uuid; v_lead uuid;
begin
  select owner_id into v_owner from public.crm_integrations where inbound_token = p_token;
  if v_owner is null then raise exception 'BAD_TOKEN'; end if;
  select id into v_card from public.cards where owner_id = v_owner order by created_at desc limit 1;
  select id into v_lead from public.leads where owner_id = v_owner and phone = p_phone order by created_at limit 1;
  if v_lead is null then
    insert into public.leads (owner_id, card_id, phone, name, message, source, city, tags, status)
    values (v_owner, v_card, p_phone, left(coalesce(p_name,''),80), left(coalesce(p_message,''),500), left(coalesce(nullif(p_source,''),'webhook'),30), left(coalesce(p_city,''),60), coalesce(p_tags,'{}'), 'new')
    returning id into v_lead;
    insert into public.lead_events (owner_id, lead_id, kind, text) values (v_owner, v_lead, 'created', 'From ' || coalesce(nullif(p_source,''),'webhook'));
  else
    update public.leads set message = case when coalesce(p_message,'') <> '' then left(p_message,500) else message end,
      name = case when coalesce(name,'') = '' then left(coalesce(p_name,''),80) else name end, updated_at = now()
    where id = v_lead;
    insert into public.lead_events (owner_id, lead_id, kind, text) values (v_owner, v_lead, 'note', 'New enquiry via ' || coalesce(nullif(p_source,''),'webhook') || case when coalesce(p_message,'') <> '' then ': ' || left(p_message,200) else '' end);
  end if;
  return v_lead;
end $$;
revoke all on function public.crm_inbound_lead(text,text,text,text,text,text,text[]) from public, anon, authenticated;
grant execute on function public.crm_inbound_lead(text,text,text,text,text,text,text[]) to service_role;
revoke all on function public.crm_queue(uuid,text,jsonb) from public, anon, authenticated;
grant execute on function public.crm_queue(uuid,text,jsonb) to service_role;
