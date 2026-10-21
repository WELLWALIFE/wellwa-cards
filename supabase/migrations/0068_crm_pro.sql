-- 0068 — CRM Pro, phase 1 (owner's call, 21 Oct 2026: "professional CRM — direct call, sab kuch wahi se").
-- Spec: docs/crm-pro.md. This migration adds what the Today screen, tasks and call logging need:
--   leads: lifecycle (kind), more profile fields, last_activity_at / last_call_at / calls_count
--   crm_tasks: call / whatsapp / visit / meeting / other with a due time, reminders, done + outcome
--   crm_calls: every call the owner or an agent made (tap-to-call now, Exotel in phase 2) with its outcome
--   owner_prefs.crm: automation switches and calling settings (jsonb)
--   phone_lines: caller_id + outbound (phase 2 click-to-call)
-- Triggers keep leads.next_follow_up = the earliest open task, bump last_activity_at from every event, message, call
-- and task, and keep kind in step with the stage. Existing follow-up dates become tasks (backfill), so the old
-- reminder cron and the new Today screen see the same thing.

-- ---- leads ---------------------------------------------------------------
alter table public.leads
  add column if not exists kind             text not null default 'lead',   -- lead | customer | lost
  add column if not exists alt_phone        text not null default '',
  add column if not exists business         text not null default '',
  add column if not exists address          text not null default '',
  add column if not exists pincode          text not null default '',
  add column if not exists birthday         date,
  add column if not exists anniversary      date,
  add column if not exists lang             text not null default '',       -- '' | hi | en (customer's preference)
  add column if not exists product_ids      uuid[] not null default '{}',   -- poster_products of interest
  add column if not exists budget_paise     bigint not null default 0,
  add column if not exists last_activity_at timestamptz not null default now(),
  add column if not exists last_call_at     timestamptz,
  add column if not exists calls_count      int not null default 0;
alter table public.leads alter column card_id drop not null;   -- already so since 0035; harmless
update public.leads set last_activity_at = greatest(coalesce(last_message_at, created_at), coalesce(updated_at, created_at), created_at);
update public.leads set kind = 'customer' where status in ('converted', 'won') and kind = 'lead';
update public.leads set kind = 'lost' where status = 'lost' and kind = 'lead';
create index if not exists leads_owner_activity_idx on public.leads (owner_id, last_activity_at desc);
create index if not exists leads_owner_phone_idx on public.leads (owner_id, phone);
create index if not exists leads_owner_kind_idx on public.leads (owner_id, kind);

-- kind follows the stage: Won → customer (and stays a customer), Lost → lost unless they bought before, back open → lead.
create or replace function public.crm_lead_before() returns trigger
language plpgsql as $$
begin
  if new.status in ('converted', 'won') then new.kind := 'customer';
  elsif new.status = 'lost' then if new.kind <> 'customer' then new.kind := 'lost'; end if;
  elsif new.kind = 'lost' then new.kind := 'lead';
  end if;
  if tg_op = 'UPDATE' then
    if new.status is distinct from old.status or new.notes is distinct from old.notes or new.tags is distinct from old.tags
       or new.assigned_to is distinct from old.assigned_to or new.value_paise is distinct from old.value_paise then
      new.last_activity_at := greatest(coalesce(new.last_activity_at, 'epoch'::timestamptz), now());
    end if;
    if new.last_message_at is distinct from old.last_message_at and new.last_message_at is not null then
      new.last_activity_at := greatest(coalesce(new.last_activity_at, 'epoch'::timestamptz), new.last_message_at);
    end if;
  end if;
  return new;
end $$;
drop trigger if exists crm_lead_before on public.leads;
create trigger crm_lead_before before insert or update on public.leads for each row execute function public.crm_lead_before();

-- Any timeline line is activity (notes, stage, calls, tasks, AI replies all write lead_events).
create or replace function public.crm_touch_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.leads set last_activity_at = greatest(last_activity_at, coalesce(new.created_at, now())) where id = new.lead_id;
  return new;
end $$;
drop trigger if exists crm_touch_on_event on public.lead_events;
create trigger crm_touch_on_event after insert on public.lead_events for each row execute function public.crm_touch_lead();

-- A WhatsApp message (bridge or Cloud API, both insert into wa_messages) is activity too.
create or replace function public.crm_touch_lead_by_phone() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.leads set last_activity_at = greatest(last_activity_at, coalesce(new.sent_at, now()))
   where owner_id = new.owner_id and phone = new.phone;
  return new;
end $$;
drop trigger if exists crm_touch_on_message on public.wa_messages;
create trigger crm_touch_on_message after insert on public.wa_messages for each row execute function public.crm_touch_lead_by_phone();

-- ---- tasks ---------------------------------------------------------------
create table if not exists public.crm_tasks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references public.profiles(id) on delete cascade,
  lead_id     uuid references public.leads(id) on delete cascade,
  assigned_to uuid references public.profiles(id) on delete set null,
  created_by  uuid references public.profiles(id) on delete set null,
  kind        text not null default 'call' check (kind in ('call','whatsapp','visit','meeting','other')),
  title       text not null default '',
  text        text not null default '',            -- whatsapp: the message to send at due_at (phase 3)
  due_at      timestamptz not null,
  remind_at   timestamptz,                         -- null = at due_at
  reminded_at timestamptz,
  done_at     timestamptz,
  outcome     text not null default '',
  source      text not null default 'manual' check (source in ('manual','auto','ai','backfill')),
  created_at  timestamptz not null default now()
);
create index if not exists crm_tasks_due_idx on public.crm_tasks (owner_id, due_at) where done_at is null;
create index if not exists crm_tasks_lead_idx on public.crm_tasks (lead_id, due_at);
create index if not exists crm_tasks_remind_idx on public.crm_tasks (coalesce(remind_at, due_at)) where done_at is null and reminded_at is null;
alter table public.crm_tasks enable row level security;
drop policy if exists "owner all crm_tasks" on public.crm_tasks;
create policy "owner all crm_tasks" on public.crm_tasks for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "agent crm_tasks" on public.crm_tasks;
create policy "agent crm_tasks" on public.crm_tasks for all
  using (public.crm_agent_of(owner_id) = 'manager' or (public.crm_agent_of(owner_id) = 'agent' and (assigned_to = auth.uid()
         or exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid()))))
  with check (public.crm_agent_of(owner_id) is not null);
grant select, insert, update, delete on public.crm_tasks to authenticated;
revoke all on public.crm_tasks from anon;

-- leads.next_follow_up = the earliest open task (the old reminder cron, inbox badges and analytics keep working).
create or replace function public.crm_tasks_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_lead uuid; v_next timestamptz; v_old timestamptz;
begin
  v_lead := coalesce(new.lead_id, old.lead_id);
  if v_lead is null then return coalesce(new, old); end if;
  select min(due_at) into v_next from public.crm_tasks where lead_id = v_lead and done_at is null;
  select next_follow_up into v_old from public.leads where id = v_lead;
  if v_next is distinct from v_old then
    update public.leads set next_follow_up = v_next, reminded_at = null, updated_at = now() where id = v_lead;
  end if;
  if tg_op <> 'DELETE' then
    update public.leads set last_activity_at = greatest(last_activity_at, now()) where id = v_lead;
  end if;
  return coalesce(new, old);
end $$;
drop trigger if exists crm_tasks_sync on public.crm_tasks;
create trigger crm_tasks_sync after insert or update of due_at, done_at, lead_id or delete on public.crm_tasks for each row execute function public.crm_tasks_sync();

-- Backfill: every open follow-up date becomes a task, once (reminded_at carried over so nobody is reminded twice).
insert into public.crm_tasks (owner_id, lead_id, assigned_to, kind, title, due_at, reminded_at, source)
select l.owner_id, l.id, l.assigned_to, 'call', 'Follow-up', l.next_follow_up, l.reminded_at, 'backfill'
  from public.leads l
 where l.next_follow_up is not null and l.status not in ('converted', 'won', 'lost')
   and not exists (select 1 from public.crm_tasks t where t.lead_id = l.id and t.done_at is null);

-- ---- calls ---------------------------------------------------------------
create table if not exists public.crm_calls (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  lead_id       uuid references public.leads(id) on delete set null,
  agent_id      uuid references public.profiles(id) on delete set null,
  direction     text not null default 'out' check (direction in ('out','in')),
  channel       text not null default 'phone' check (channel in ('phone','exotel','ai')),   -- tel: | cloud number | AI receptionist
  provider_sid  text,
  status        text not null default 'done' check (status in ('ringing','in_progress','done','failed')),
  started_at    timestamptz not null default now(),
  seconds       int not null default 0,
  outcome       text not null default 'unknown' check (outcome in ('connected','no_answer','busy','switched_off','wrong_number','call_back','unknown')),
  note          text not null default '',
  recording_url text,
  created_at    timestamptz not null default now()
);
create unique index if not exists crm_calls_sid_idx on public.crm_calls (provider_sid) where provider_sid is not null;
create index if not exists crm_calls_owner_idx on public.crm_calls (owner_id, started_at desc);
create index if not exists crm_calls_lead_idx on public.crm_calls (lead_id, started_at desc);
alter table public.crm_calls enable row level security;
drop policy if exists "owner all crm_calls" on public.crm_calls;
create policy "owner all crm_calls" on public.crm_calls for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "agent crm_calls" on public.crm_calls;
create policy "agent crm_calls" on public.crm_calls for all
  using (public.crm_agent_of(owner_id) = 'manager' or (public.crm_agent_of(owner_id) = 'agent' and (agent_id = auth.uid()
         or exists (select 1 from public.leads l where l.id = lead_id and l.assigned_to = auth.uid()))))
  with check (public.crm_agent_of(owner_id) is not null);
grant select, insert, update, delete on public.crm_calls to authenticated;
revoke all on public.crm_calls from anon;

create or replace function public.crm_calls_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.lead_id is not null and new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    update public.leads set calls_count = calls_count + 1, last_call_at = greatest(coalesce(last_call_at, 'epoch'::timestamptz), new.started_at),
      last_activity_at = greatest(last_activity_at, new.started_at) where id = new.lead_id;
  end if;
  return new;
end $$;
drop trigger if exists crm_calls_touch on public.crm_calls;
create trigger crm_calls_touch after insert or update of status on public.crm_calls for each row execute function public.crm_calls_touch();

-- ---- owner preferences: automations + calling settings ---------------------
alter table public.owner_prefs add column if not exists crm jsonb not null default '{}'::jsonb;
-- keys (all optional): ask_outcome (default true), retry_after_min (180), missed_call_wa (false), missed_call_text,
-- auto_task_new_lead (false), daily_summary (false), birthday_wish (false), stale_days (7), round_robin (false), call_target (0)

-- ---- phone lines: phase 2 click-to-call ------------------------------------
alter table public.phone_lines add column if not exists caller_id text not null default '';
alter table public.phone_lines add column if not exists outbound boolean not null default false;

-- ---- outgoing webhook events for the new objects ---------------------------
create or replace function public.crm_task_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform public.crm_queue(new.owner_id, 'task.created', jsonb_build_object('id', new.id, 'lead_id', new.lead_id, 'kind', new.kind, 'title', new.title, 'due_at', new.due_at));
  elsif new.done_at is not null and old.done_at is null then
    perform public.crm_queue(new.owner_id, 'task.done', jsonb_build_object('id', new.id, 'lead_id', new.lead_id, 'kind', new.kind, 'title', new.title, 'outcome', new.outcome, 'done_at', new.done_at));
  end if;
  return new;
end $$;
drop trigger if exists crm_task_events on public.crm_tasks;
create trigger crm_task_events after insert or update on public.crm_tasks for each row execute function public.crm_task_trigger();

create or replace function public.crm_call_trigger() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then
    perform public.crm_queue(new.owner_id, 'call.logged', jsonb_build_object('id', new.id, 'lead_id', new.lead_id, 'direction', new.direction, 'outcome', new.outcome, 'seconds', new.seconds, 'note', new.note, 'started_at', new.started_at));
  end if;
  return new;
end $$;
drop trigger if exists crm_call_events on public.crm_calls;
create trigger crm_call_events after insert or update on public.crm_calls for each row execute function public.crm_call_trigger();

select 'crm pro phase 1 ready' as status;
