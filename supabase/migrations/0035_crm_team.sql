-- CRM team inbox: the owner invites agents with a join code; an agent logs in
-- to Shubhora with their own account, enters the code and then works the
-- owner's leads (assigned ones, or all when the owner allows). Every agent
-- action is still recorded against the owner's data, so nothing moves.

create table if not exists public.crm_agents (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  agent_user_id uuid references public.profiles(id) on delete set null,   -- null until the agent joins
  name          text not null default '',
  phone         text not null default '',
  role          text not null default 'agent' check (role in ('agent','manager')), -- manager sees every lead
  join_code     text not null unique,
  active        boolean not null default true,
  joined_at     timestamptz,
  created_at    timestamptz not null default now()
);
create index if not exists crm_agents_owner_idx on public.crm_agents(owner_id);
create index if not exists crm_agents_agent_idx on public.crm_agents(agent_user_id);
alter table public.crm_agents enable row level security;
drop policy if exists "owner all crm_agents" on public.crm_agents;
create policy "owner all crm_agents" on public.crm_agents for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "agent reads own membership" on public.crm_agents;
create policy "agent reads own membership" on public.crm_agents for select using (auth.uid() = agent_user_id);
grant select, insert, update, delete on public.crm_agents to authenticated;

alter table public.leads add column if not exists assigned_to uuid references public.profiles(id) on delete set null;
create index if not exists leads_assigned_idx on public.leads(assigned_to) where assigned_to is not null;
alter table public.wa_messages add column if not exists sent_by uuid references public.profiles(id) on delete set null; -- which agent sent an 'owner' message

-- Which owner workspaces the caller may work in (as an active, joined agent).
create or replace function public.crm_agent_of(p_owner uuid) returns text
language sql stable security definer set search_path = public as $$
  select role from public.crm_agents where owner_id = p_owner and agent_user_id = auth.uid() and active limit 1;
$$;
grant execute on function public.crm_agent_of(uuid) to authenticated;

-- Agents: read/update the owner's leads (managers all, agents only assigned), read chats & templates, write timeline.
drop policy if exists "agent reads leads" on public.leads;
create policy "agent reads leads" on public.leads for select using (
  public.crm_agent_of(owner_id) = 'manager' or (public.crm_agent_of(owner_id) = 'agent' and assigned_to = auth.uid()));
drop policy if exists "agent updates leads" on public.leads;
create policy "agent updates leads" on public.leads for update using (
  public.crm_agent_of(owner_id) = 'manager' or (public.crm_agent_of(owner_id) = 'agent' and assigned_to = auth.uid()));
drop policy if exists "agent reads wa_messages" on public.wa_messages;
create policy "agent reads wa_messages" on public.wa_messages for select using (public.crm_agent_of(owner_id) is not null);
drop policy if exists "agent reads wa_templates" on public.wa_templates;
create policy "agent reads wa_templates" on public.wa_templates for select using (public.crm_agent_of(owner_id) is not null);
drop policy if exists "agent lead_events" on public.lead_events;
create policy "agent lead_events" on public.lead_events for all using (public.crm_agent_of(owner_id) is not null) with check (public.crm_agent_of(owner_id) is not null);

-- Join with a code: links the caller to the invite. Returns the owner id.
create or replace function public.crm_join(p_code text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_owner uuid;
begin
  update public.crm_agents set agent_user_id = auth.uid(), joined_at = now()
   where join_code = upper(trim(p_code)) and active and (agent_user_id is null or agent_user_id = auth.uid())
  returning owner_id into v_owner;
  if v_owner is null then raise exception 'INVALID_CODE'; end if;
  return v_owner;
end $$;
grant execute on function public.crm_join(text) to authenticated;

-- wa_log_message: optional sent_by (agent) — same signature plus one arg.
drop function if exists public.wa_log_message(uuid,uuid,text,text,text,text,text,text,text,timestamptz);
create or replace function public.wa_log_message(
  p_owner uuid, p_card uuid, p_phone text, p_name text, p_wa_id text,
  p_direction text, p_sender text, p_kind text, p_text text, p_sent_at timestamptz, p_sent_by uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_lead uuid; v_inserted boolean;
begin
  insert into public.wa_messages (owner_id, card_id, phone, wa_id, direction, sender, kind, text, sent_at, sent_by)
  values (p_owner, p_card, p_phone, p_wa_id, p_direction, p_sender, p_kind, left(coalesce(p_text,''), 4000), coalesce(p_sent_at, now()), p_sent_by)
  on conflict (owner_id, wa_id) do nothing;
  v_inserted := found;
  select id into v_lead from public.leads where owner_id = p_owner and phone = p_phone order by created_at limit 1;
  if v_lead is null then
    insert into public.leads (card_id, owner_id, phone, name, source, message, last_message_at, unread)
    values (p_card, p_owner, p_phone, coalesce(p_name,''), 'whatsapp', left(coalesce(p_text,''), 500), coalesce(p_sent_at, now()),
            case when p_direction = 'in' then 1 else 0 end)
    returning id into v_lead;
    insert into public.lead_events (owner_id, lead_id, kind, text) values (p_owner, v_lead, 'created', 'Lead created from WhatsApp');
  elsif v_inserted then
    update public.leads set
      message = case when coalesce(p_text,'') <> '' then left(p_text, 500) else message end,
      name = case when coalesce(name,'') = '' and coalesce(p_name,'') <> '' then p_name else name end,
      last_message_at = greatest(coalesce(last_message_at, 'epoch'::timestamptz), coalesce(p_sent_at, now())),
      unread = case when p_direction = 'in' then unread + 1 when p_sender = 'owner' then 0 else unread end,
      updated_at = now()
    where id = v_lead;
  end if;
  return v_lead;
end $$;
revoke all on function public.wa_log_message(uuid,uuid,text,text,text,text,text,text,text,timestamptz,uuid) from public, anon, authenticated;
grant execute on function public.wa_log_message(uuid,uuid,text,text,text,text,text,text,text,timestamptz,uuid) to service_role;

-- (also in 0034 tail) a hand-added lead may exist before the owner has a card
alter table public.leads alter column card_id drop not null;
