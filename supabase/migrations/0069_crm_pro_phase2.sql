-- 0069 — CRM Pro, phase 2 (docs/crm-pro.md): automations in the database where every lead source meets.
--   * a new lead → "Call within 10 min" task when the owner switched that on (owner_prefs.crm.auto_task_new_lead);
--     the trigger runs for leads from WhatsApp, the card form, the website chat, the phone receptionist, webhooks, import
--   * round-robin: the new lead goes to the next active agent when owner_prefs.crm.round_robin is on
--   * birthday / anniversary lookups (cron /api/cron/crm-daily) get an index
--   * Exotel click-to-call rows carry the agent's number used as From (crm_calls.from_number)

alter table public.crm_calls add column if not exists from_number text not null default '';

create or replace function public.crm_new_lead_after() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_prefs jsonb; v_agent uuid;
begin
  select coalesce(crm, '{}'::jsonb) into v_prefs from public.owner_prefs where owner_id = new.owner_id;
  if v_prefs is null then return new; end if;
  -- round-robin among joined, active agents: the one who got a lead longest ago (or never) is next
  if coalesce((v_prefs->>'round_robin')::boolean, false) and new.assigned_to is null then
    select a.agent_user_id into v_agent
      from public.crm_agents a
      left join lateral (select max(l.created_at) as last_at from public.leads l where l.owner_id = new.owner_id and l.assigned_to = a.agent_user_id) x on true
     where a.owner_id = new.owner_id and a.active and a.agent_user_id is not null and a.role = 'agent'
     order by x.last_at nulls first, a.created_at
     limit 1;
    if v_agent is not null then
      update public.leads set assigned_to = v_agent where id = new.id;
      insert into public.lead_events (owner_id, lead_id, kind, text) values (new.owner_id, new.id, 'assign', 'Assigned automatically (round-robin)');
    end if;
  end if;
  if coalesce((v_prefs->>'auto_task_new_lead')::boolean, false) and new.status = 'new' then
    insert into public.crm_tasks (owner_id, lead_id, assigned_to, created_by, kind, title, due_at, source)
    values (new.owner_id, new.id, coalesce(v_agent, new.assigned_to), null, 'call', 'New lead — call now', now() + interval '10 minutes', 'auto');
  end if;
  return new;
end $$;
drop trigger if exists crm_new_lead_after on public.leads;
create trigger crm_new_lead_after after insert on public.leads for each row execute function public.crm_new_lead_after();

create index if not exists leads_birthday_idx on public.leads (owner_id, (extract(month from birthday)), (extract(day from birthday))) where birthday is not null;
create index if not exists leads_anniversary_idx on public.leads (owner_id, (extract(month from anniversary)), (extract(day from anniversary))) where anniversary is not null;

select 'crm pro phase 2 ready' as status;
