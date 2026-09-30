-- WhatsApp Cloud API mode (official Meta API, the user's own credentials):
-- per-owner account, message delivery status, broadcast campaigns.

create table if not exists public.wa_cloud_accounts (
  owner_id         uuid primary key references public.profiles(id) on delete cascade,
  phone_number_id  text not null unique,
  waba_id          text not null default '',
  access_token     text not null,                 -- permanent System User token (never returned to the client)
  app_secret       text not null default '',      -- Meta app secret: webhook signature check (optional but recommended)
  verify_token     text not null,                 -- webhook verify token (generated)
  display_phone    text not null default '',
  verified_name    text not null default '',
  quality_rating   text not null default '',
  messaging_limit  text not null default '',
  official         boolean not null default false,  -- green tick (is_official_business_account)
  enabled          boolean not null default true,
  ai_enabled       boolean not null default true,
  last_error       text not null default '',
  connected_at     timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table public.wa_cloud_accounts enable row level security;
drop policy if exists "owner all wa_cloud_accounts" on public.wa_cloud_accounts;
create policy "owner all wa_cloud_accounts" on public.wa_cloud_accounts for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, update, delete on public.wa_cloud_accounts to authenticated;
grant all on public.wa_cloud_accounts to service_role;

-- delivery status for cloud messages (sent → delivered → read / failed) + channel
alter table public.wa_messages add column if not exists channel text not null default 'qr';
alter table public.wa_messages add column if not exists status text not null default '';
grant all on public.wa_messages to service_role;
grant all on public.leads to service_role;
grant all on public.lead_events to service_role;

-- ---- broadcasts (template campaigns) ----
create table if not exists public.wa_broadcasts (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  name          text not null,
  template_name text not null,
  template_lang text not null default 'en',
  header_image  text not null default '',        -- https image for IMAGE header templates
  params        jsonb not null default '[]'::jsonb,  -- body variables: [{"source":"name"|"city"|"custom","value":"…"}]
  audience      jsonb not null default '{}'::jsonb,  -- {stages:[], tags:[], all:true}
  status        text not null default 'draft',   -- draft|scheduled|sending|done|cancelled|failed
  scheduled_at  timestamptz,
  total int not null default 0, sent int not null default 0, delivered int not null default 0, read int not null default 0, failed int not null default 0,
  created_at    timestamptz not null default now(),
  finished_at   timestamptz
);
create index if not exists wa_broadcasts_owner_idx on public.wa_broadcasts(owner_id, created_at desc);
alter table public.wa_broadcasts enable row level security;
drop policy if exists "owner all wa_broadcasts" on public.wa_broadcasts;
create policy "owner all wa_broadcasts" on public.wa_broadcasts for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
grant select, insert, update, delete on public.wa_broadcasts to authenticated;
grant all on public.wa_broadcasts to service_role;

create table if not exists public.wa_broadcast_items (
  id           bigserial primary key,
  broadcast_id uuid not null references public.wa_broadcasts(id) on delete cascade,
  owner_id     uuid not null references public.profiles(id) on delete cascade,
  lead_id      uuid references public.leads(id) on delete set null,
  phone        text not null,
  name         text not null default '',
  status       text not null default 'queued',  -- queued|sent|delivered|read|failed
  wa_msg_id    text not null default '',
  error        text not null default '',
  updated_at   timestamptz not null default now()
);
create index if not exists wa_broadcast_items_queue_idx on public.wa_broadcast_items(broadcast_id) where status = 'queued';
create index if not exists wa_broadcast_items_msg_idx on public.wa_broadcast_items(wa_msg_id) where wa_msg_id <> '';
alter table public.wa_broadcast_items enable row level security;
drop policy if exists "owner reads wa_broadcast_items" on public.wa_broadcast_items;
create policy "owner reads wa_broadcast_items" on public.wa_broadcast_items for select using (auth.uid() = owner_id);
grant select on public.wa_broadcast_items to authenticated;
grant all on public.wa_broadcast_items to service_role;
grant usage, select on sequence public.wa_broadcast_items_id_seq to service_role;

-- opt-out (customer replied STOP)
alter table public.leads add column if not exists opted_out boolean not null default false;

-- Delivery status from the webhook: update the message row and any broadcast item, roll up counters.
create or replace function public.wa_cloud_status(p_owner uuid, p_wa_id text, p_status text) returns void
language plpgsql security definer set search_path = public as $$
declare v_b uuid; v_prev text;
begin
  update public.wa_messages set status = p_status where owner_id = p_owner and wa_id = p_wa_id
    and (status = '' or (status = 'sent' and p_status in ('delivered','read','failed')) or (status = 'delivered' and p_status in ('read','failed')));
  select broadcast_id, status into v_b, v_prev from public.wa_broadcast_items where owner_id = p_owner and wa_msg_id = p_wa_id limit 1;
  if v_b is null then return; end if;
  if v_prev = p_status or (v_prev = 'read' and p_status <> 'failed') or (v_prev = 'delivered' and p_status = 'sent') then return; end if;
  update public.wa_broadcast_items set status = p_status, updated_at = now() where owner_id = p_owner and wa_msg_id = p_wa_id;
  update public.wa_broadcasts set
    delivered = (select count(*) from public.wa_broadcast_items where broadcast_id = v_b and status in ('delivered','read')),
    read = (select count(*) from public.wa_broadcast_items where broadcast_id = v_b and status = 'read'),
    failed = (select count(*) from public.wa_broadcast_items where broadcast_id = v_b and status = 'failed')
  where id = v_b;
end $$;
revoke all on function public.wa_cloud_status(uuid,text,text) from public, anon, authenticated;
grant execute on function public.wa_cloud_status(uuid,text,text) to service_role;
