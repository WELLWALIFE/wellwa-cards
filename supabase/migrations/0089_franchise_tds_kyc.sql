-- Franchise Phase 3 (owner, 6 Nov 2026): TDS on payouts, and KYC documents in a private bucket.
-- TDS: the part of a paid payout that Shubhora deducts and deposits as tax; the bank gets amount − TDS. The franchise balance still
-- goes down by the full amount (the TDS is paid on its behalf).
alter table public.payouts add column if not exists tds_paise bigint not null default 0;

-- KYC documents (PAN, cancelled cheque, Aadhaar, GST): private — read only through short signed links made by the server.
insert into storage.buckets (id, name, public) values ('franchise-kyc', 'franchise-kyc', false) on conflict (id) do nothing;
