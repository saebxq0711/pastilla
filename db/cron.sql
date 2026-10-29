-- Recordatorios a la hora exacta con pg_cron + pg_net (Supabase → SQL Editor).
-- pg_cron trabaja en UTC: 9:00 pm Colombia = 02:00 UTC y 9:30 pm = 02:30 UTC.
-- Cambia TU-APP y TU_CRON_SECRET antes de ejecutarlo.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule(jobname) from cron.job where jobname like 'pastillita-%';

select cron.schedule('pastillita-9pm', '0 2 * * *', $$
  select net.http_post(
    url     := 'https://TU-APP.vercel.app/api/cron',
    headers := '{"Authorization": "Bearer TU_CRON_SECRET", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
$$);

select cron.schedule('pastillita-930pm', '30 2 * * *', $$
  select net.http_post(
    url     := 'https://TU-APP.vercel.app/api/cron',
    headers := '{"Authorization": "Bearer TU_CRON_SECRET", "Content-Type": "application/json"}'::jsonb,
    body    := '{}'::jsonb
  );
$$);

-- Para revisar que corren:
--   select jobname, schedule from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select id, status_code, content from net._http_response order by id desc limit 10;
