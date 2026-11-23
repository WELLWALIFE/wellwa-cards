-- 0099: Shubhora Mobile Shop, phase 3 (owner, 23 Nov 2026): goods that come back. A return (credit note) is its own row in
-- ms_bills (kind 'return') that points at the bill it came from; the original bill is never changed. Safe to run more than once.

alter table public.ms_bills drop constraint if exists ms_bills_kind_check;
alter table public.ms_bills add constraint ms_bills_kind_check check (kind in ('sale','estimate','return'));
alter table public.ms_bills add column if not exists ref_bill_id uuid references public.ms_bills(id) on delete set null;
create index if not exists ms_bills_ref_idx on public.ms_bills (ref_bill_id) where ref_bill_id is not null;
