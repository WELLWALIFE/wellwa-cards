-- 0082 — Ads v2 (owner, 1 Nov 2026: "ad wale part ko perfect aur professional banao"). Safe to run more than once.
-- The app's record of a Facebook / Instagram campaign (sql/2026-09-30-ad-campaigns.sql) now also keeps what the hourly sync reads from
-- Meta (status, review feedback, spend, results, the dates), what the owner chose (placements, link, phone, the cover), and which messages
-- were already sent (told), so the owner hears once when an ad goes live, is rejected or ends.
alter table public.ad_campaigns add column if not exists placements       text not null default 'auto';   -- auto | feeds | stories
alter table public.ad_campaigns add column if not exists description      text;
alter table public.ad_campaigns add column if not exists link             text;
alter table public.ad_campaigns add column if not exists phone            text;
alter table public.ad_campaigns add column if not exists thumb_url        text;
alter table public.ad_campaigns add column if not exists start_time       timestamptz;
alter table public.ad_campaigns add column if not exists end_time         timestamptz;
alter table public.ad_campaigns add column if not exists effective_status text;                            -- last seen from Meta
alter table public.ad_campaigns add column if not exists review_feedback  text;                            -- why Meta rejected it
alter table public.ad_campaigns add column if not exists spend_paise      integer not null default 0;
alter table public.ad_campaigns add column if not exists reach            integer not null default 0;
alter table public.ad_campaigns add column if not exists results          integer not null default 0;
alter table public.ad_campaigns add column if not exists result_label     text;                            -- chats | clicks
alter table public.ad_campaigns add column if not exists synced_at        timestamptz;
alter table public.ad_campaigns add column if not exists told             jsonb not null default '{}'::jsonb;  -- { live, rejected, ended, day }
alter table public.ad_campaigns add column if not exists ended_at         timestamptz;
create index if not exists ad_campaigns_open_idx on public.ad_campaigns (ended_at, end_time);
-- A WhatsApp lead that came from an ad (bridge markAdLead): the ad's title, when WhatsApp passes it.
alter table public.leads add column if not exists ad_title text;
select 'ok' as status;
