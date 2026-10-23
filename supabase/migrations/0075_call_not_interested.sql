-- 0075: "Not interested" as a call outcome (owner, 23 Oct 2026: a field on the after-call sheet; such a customer gets no more
-- automatic messages — see AI_STOP_TAG in src/lib/crm-pro.ts). Until this is run the app saves such a call as "connected" with
-- "Not interested" in its note. Safe to run more than once.
alter table public.crm_calls drop constraint if exists crm_calls_outcome_check;
alter table public.crm_calls add constraint crm_calls_outcome_check
  check (outcome in ('connected','no_answer','busy','switched_off','wrong_number','call_back','not_interested','unknown'));
