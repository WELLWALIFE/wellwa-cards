-- WhatsApp CRM: a real message log per contact, lead tags / AI insights /
-- activity timeline, quick-reply templates. The bridge (service role) writes
-- messages through wa_log_message(); the app reads under RLS as the owner.

-- ---- message log --------------------------------------------------------
create table if not exists public.wa_messages (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  card_id    uuid references public.cards(id) on delete set null,
  phone      text not null,                 -- "+91…" (or the raw jid when WhatsApp hides the number)
  wa_id      text not null,                 -- WhatsApp message key id (dedupe)
  direction  text not null check (direction in ('in','out')),
  sender     text not null check (sender in ('customer','bot','owner')),
  kind       text not null default 'text',  -- text|image|video|audio|document|sticker|location|contact|other
  text       text not null default '',
  sent_at    timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (owner_id, wa_id)
);
create index if not exists wa_messages_thread_idx on public.wa_messages(owner_id, phone, sent_at desc);
alter table public.wa_messages enable row level security;
drop policy if exists "owner reads wa_messages" on public.wa_messages;
create policy "owner reads wa_messages" on public.wa_messages for select using (auth.uid() = owner_id);
grant select on public.wa_messages to authenticated;

-- ---- lead CRM columns ---------------------------------------------------
alter table public.leads add column if not exists tags text[] not null default '{}';
alter table public.leads add column if not exists last_message_at timestamptz;
alter table public.leads add column if not exists unread int not null default 0;
alter table public.leads add column if not exists ai_intent text not null default '';    -- e.g. "Price enquiry"
alter table public.leads add column if not exists ai_sentiment text not null default ''; -- positive|neutral|negative
alter table public.leads add column if not exists ai_summary text not null default '';
alter table public.leads add column if not exists ai_next text not null default '';      -- suggested next step
alter table public.leads add column if not exists ai_at timestamptz;
alter table public.leads add column if not exists reminded_at timestamptz;               -- follow-up reminder sent
alter table public.leads add column if not exists city text not null default '';
create index if not exists leads_inbox_idx on public.leads(owner_id, last_message_at desc nulls last);
-- The owner adds leads by hand from the CRM (anon insert stays revoked).
drop policy if exists "owner inserts leads" on public.leads;
create policy "owner inserts leads" on public.leads for insert with check (auth.uid() = owner_id);
grant insert on public.leads to authenticated;

-- ---- activity timeline --------------------------------------------------
create table if not exists public.lead_events (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  lead_id    uuid not null references public.leads(id) on delete cascade,
  kind       text not null,                 -- note|status|followup|call|tag|ai|sent|created
  text       text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists lead_events_lead_idx on public.lead_events(lead_id, created_at desc);
alter table public.lead_events enable row level security;
drop policy if exists "owner all lead_events" on public.lead_events;
create policy "owner all lead_events" on public.lead_events for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, delete on public.lead_events to authenticated;

-- ---- quick replies ------------------------------------------------------
create table if not exists public.wa_templates (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  shortcut   text not null default '',      -- type "/price" in the composer
  body       text not null,                 -- {name} {business} {card} placeholders
  uses       int not null default 0,
  created_at timestamptz not null default now()
);
alter table public.wa_templates enable row level security;
drop policy if exists "owner all wa_templates" on public.wa_templates;
create policy "owner all wa_templates" on public.wa_templates for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, update, delete on public.wa_templates to authenticated;

-- ---- bridge write path --------------------------------------------------
-- One call per WhatsApp message: logs it (idempotent on wa_id) and keeps the
-- lead row current (latest text, last_message_at, unread counter).
create or replace function public.wa_log_message(
  p_owner uuid, p_card uuid, p_phone text, p_name text, p_wa_id text,
  p_direction text, p_sender text, p_kind text, p_text text, p_sent_at timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_lead uuid; v_inserted boolean;
begin
  insert into public.wa_messages (owner_id, card_id, phone, wa_id, direction, sender, kind, text, sent_at)
  values (p_owner, p_card, p_phone, p_wa_id, p_direction, p_sender, p_kind, left(coalesce(p_text,''), 4000), coalesce(p_sent_at, now()))
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
revoke all on function public.wa_log_message(uuid,uuid,text,text,text,text,text,text,text,timestamptz) from public, anon, authenticated;
grant execute on function public.wa_log_message(uuid,uuid,text,text,text,text,text,text,text,timestamptz) to service_role;

-- Template use counter (service role, called after a successful send).
create or replace function public.wa_template_used(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.wa_templates set uses = uses + 1 where id = p_id;
$$;
revoke all on function public.wa_template_used(uuid) from public, anon, authenticated;
grant execute on function public.wa_template_used(uuid) to service_role;

-- A lead added by hand may exist before the owner has made a card.
alter table public.leads alter column card_id drop not null;
