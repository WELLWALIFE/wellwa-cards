-- Every lead the platform's own website brings (owner, 25 Nov 2026: "site se koi bhi lead aati hai to kahan dikhti hai?"): the
-- contact form and the free Google check. Saved here first, always — before, they went only to the company card named in
-- SITE_LEAD_CARD and were lost when that was not set. Admin → Leads reads this table. Service role only.
create table if not exists public.site_leads (
  id bigint generated always as identity primary key,
  source text not null default 'form',          -- website-contact | google-check
  name text not null default '',
  phone text not null default '',
  email text not null default '',
  message text not null default '',
  card text not null default '',                -- the card the lead also went to (partner / company), '' = none
  status text not null default 'new',           -- new | contacted | closed
  created_at timestamptz not null default now()
);
create index if not exists site_leads_created_idx on public.site_leads (created_at desc);
alter table public.site_leads enable row level security;
