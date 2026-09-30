-- Card templates the platform owner manages from Super Admin → Templates.
-- Built-in templates live in src/lib/templates.ts; rows here are added by the
-- owner and merged with (or override) the built-ins by `key`.

create table if not exists public.card_templates (
  key         text primary key,
  name        text not null,
  category    text not null default '',
  description text not null default '',
  emoji       text not null default '✨',
  data        jsonb not null default '{}'::jsonb,
  sort        int not null default 100,
  active      boolean not null default true,
  updated_at  timestamptz not null default now()
);

alter table public.card_templates enable row level security;

-- Anyone can read the active ones (the picker is shown to every signed-in user).
drop policy if exists card_templates_read on public.card_templates;
create policy card_templates_read on public.card_templates
  for select using (active);

grant select on public.card_templates to anon, authenticated;
grant select, insert, update, delete on public.card_templates to service_role;
