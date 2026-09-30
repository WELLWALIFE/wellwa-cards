-- Fix: several service-only RPCs revoked the default PUBLIC execute right
-- but never explicitly re-granted execute to service_role afterwards —
-- meaning every server-side call to them has been silently failing with
-- "permission denied for function ..." since the day each was introduced.
--
-- Found while diagnosing why the Wellwa cards' extra pages (Technology,
-- About Us, etc.) were hidden: admin_set_plan couldn't grant a plan because
-- of this. The same missing-grant pattern also affects partner wallet
-- top-up approval/rejection/manual adjustment, and the trial-ending
-- WhatsApp reminder cron job — none of these have ever actually worked in
-- production. Compare against 0018_security_crm.sql's apply_verified_payment
-- and 0020_media_credits.sql's spend_credits/grant_credits, which got this
-- right (revoke, then an explicit grant back to service_role).

grant execute on function public.admin_approve_topup(uuid, text) to service_role;
grant execute on function public.admin_reject_topup(uuid, text) to service_role;
grant execute on function public.admin_adjust_wallet(uuid, bigint, text) to service_role;
grant execute on function public.admin_set_plan(uuid, text, int) to service_role;
grant execute on function public.trials_ending(int) to service_role;

select 'service_role grants restored' as status;
