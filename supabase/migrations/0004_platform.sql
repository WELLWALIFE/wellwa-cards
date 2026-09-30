-- Platform-wide settings edited from Super Admin. Single row (id = 1).
-- Holds the GLOBAL AI bot training that every card's bot inherits, on top of
-- which each user adds their own per-card knowledge.

create table if not exists public.platform_settings (
  id           smallint primary key default 1,
  bot_persona   text not null default '',
  bot_knowledge text not null default '',
  updated_at    timestamptz not null default now(),
  constraint platform_settings_singleton check (id = 1)
);

insert into public.platform_settings (id) values (1)
  on conflict (id) do nothing;

alter table public.platform_settings enable row level security;

-- Public read: the on-card chat + WhatsApp bridge read it to ground the bot.
drop policy if exists platform_settings_read on public.platform_settings;
create policy platform_settings_read on public.platform_settings
  for select using (true);

-- Any signed-in user can update (demo posture — admin panel is owner-operated).
-- TODO before launch: gate writes to a super-admin role.
drop policy if exists platform_settings_write on public.platform_settings;
create policy platform_settings_write on public.platform_settings
  for update using (auth.role() = 'authenticated') with check (id = 1);

grant select on public.platform_settings to anon, authenticated;
grant update on public.platform_settings to authenticated;
