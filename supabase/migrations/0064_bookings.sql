-- 0064 — Bookings + reminders (owner's call, 8 Oct 2026: "booking calendar aur reminder bhi bana do").
--
-- One row per appointment: taken by the AI salesman on the website chat or the seller's WhatsApp ("booking" with a
-- day and time), or added by the owner on the Bookings tab. A cron (/api/cron/booking-reminders, every 15 min) reminds
-- the customer a day before and two hours before over the owner's WhatsApp when it is linked — otherwise the owner gets
-- the reminder with a one-tap message to forward — and reminds the owner two hours before every booking.
create table if not exists public.bookings (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references public.profiles(id) on delete cascade,
  card_id               uuid references public.cards(id) on delete set null,
  lead_id               uuid references public.leads(id) on delete set null,
  name                  text not null default '',
  phone                 text not null default '',          -- as given; digits are normalised when sending
  service               text not null default '',
  starts_at             timestamptz not null,
  duration_min          int  not null default 60,
  note                  text not null default '',
  status                text not null default 'booked',    -- booked | done | cancelled | no_show
  source                text not null default 'owner',     -- chat | whatsapp | owner
  reminded_customer_24h timestamptz,
  reminded_customer_2h  timestamptz,
  reminded_owner_at     timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index if not exists bookings_owner_time_idx on public.bookings (owner_id, starts_at);
create index if not exists bookings_due_idx on public.bookings (starts_at) where status = 'booked';
alter table public.bookings enable row level security;
drop policy if exists "owner manages bookings" on public.bookings;
create policy "owner manages bookings" on public.bookings
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
