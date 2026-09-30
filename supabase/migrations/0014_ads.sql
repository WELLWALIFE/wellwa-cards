-- Ads & attribution.
--
-- Two halves that matter:
--   1. Pixels — Facebook / Google Ads / GA4 on the card, firing real conversion
--      events (a WhatsApp tap is the conversion on this product, not a form).
--   2. Attribution — carry the campaign all the way to the lead, so the owner
--      can see which ad produced which customer instead of a bare click count.

/* ---------------- attribution on events and leads ---------------- */
alter table public.card_events add column if not exists utm_source   text;
alter table public.card_events add column if not exists utm_medium   text;
alter table public.card_events add column if not exists utm_campaign text;
alter table public.card_events add column if not exists utm_content  text;
alter table public.card_events add column if not exists utm_term     text;
alter table public.card_events add column if not exists referrer     text;

alter table public.leads add column if not exists utm_source   text;
alter table public.leads add column if not exists utm_medium   text;
alter table public.leads add column if not exists utm_campaign text;
alter table public.leads add column if not exists utm_content  text;
alter table public.leads add column if not exists utm_term     text;
alter table public.leads add column if not exists referrer     text;
-- Kept alongside utm_source because ?src= is the short share tag we already
-- stamp on WhatsApp/QR links; UTMs come from paid ads.
alter table public.leads add column if not exists src          text;

create index if not exists leads_campaign_idx on public.leads(owner_id, utm_campaign);

/* ---------------- brand-level pixels (white label) ----------------
 * A partner puts one pixel on their brand and every member card reports into
 * the same ad account — they run one campaign for the whole network.
 */
alter table public.brands add column if not exists fb_pixel_id     text;
alter table public.brands add column if not exists ga4_id          text;
alter table public.brands add column if not exists google_ads_id   text;
alter table public.brands add column if not exists ads_conversion_label text;

/* ---------------- what the public card page needs ----------------
 * Anonymous callers can't read profiles or brands directly, so this returns
 * only the tracking ids for one card — nothing else about the owner.
 */
create or replace function public.card_tracking(p_username text)
returns table (
  fb_pixel_id text, ga4_id text, google_ads_id text, ads_label text,
  brand_fb_pixel_id text, brand_ga4_id text, brand_google_ads_id text, brand_ads_label text
)
language sql stable security definer set search_path = public as $$
  select
    nullif(trim(c.data->>'fbPixelId'), ''),
    nullif(trim(c.data->>'ga4Id'), ''),
    nullif(trim(c.data->>'googleAdsId'), ''),
    nullif(trim(c.data->>'googleAdsLabel'), ''),
    b.fb_pixel_id, b.ga4_id, b.google_ads_id, b.ads_conversion_label
  from public.cards c
  left join public.brands b on b.id = c.brand_id and b.active = true
  where lower(c.username) = lower(trim(p_username))
    and c.active = true
    -- Paid feature: an expired card stops reporting to the owner's ad account.
    and public.effective_plan(c.owner_id) <> 'free'
  limit 1;
$$;
grant execute on function public.card_tracking(text) to anon, authenticated;

select 'ads schema ready' as status;
