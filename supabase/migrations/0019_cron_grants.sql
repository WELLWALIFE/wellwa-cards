-- The trial-reminder cron runs with the service key; 0018's hardening pass
-- left trials_ending without an execute grant for it. Applied live 2026-08-16.
grant execute on function public.trials_ending(int) to service_role;

select 'cron grants ready' as status;
