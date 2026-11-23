-- 0096: Shubhora Jewellery, phase 6 (owner, 23 Nov 2026): the shop's stock on its website with a live "from ₹" price. A piece may
-- carry one photo (the app's own storage). Safe to run more than once.
alter table public.jw_stock add column if not exists photo text not null default '';
