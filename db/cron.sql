-- Recordatorios a la hora exacta con pg_cron + pg_net (Supabase).
-- pg_cron trabaja en UTC: 9:00 pm Colombia = 02:00 UTC y 9:30 pm = 02:30 UTC.
--
-- La URL de la app y la clave del cron viven en `privado.cron_config` (esquema que la
-- API de Supabase no publica). Mientras `url` esté vacía, los jobs no hacen nada.
-- Para activarlos:
--   update privado.cron_config set url = 'https://TU-APP.vercel.app', secreto = 'TU_CRON_SECRET';

create extension if not exists pg_cron;
create extension if not exists pg_net;

create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;

create table if not exists privado.cron_config (
  id      int primary key default 1 check (id = 1),
  url     text,
  secreto text
);
insert into privado.cron_config (id) values (1) on conflict do nothing;

create or replace function privado.llamar_cron() returns void
language plpgsql security definer set search_path = privado, public as $$
declare c privado.cron_config;
begin
  select * into c from privado.cron_config where id = 1;
  if c.url is null or c.secreto is null then return; end if;
  perform net.http_post(
    url     := c.url || '/api/cron',
    headers := jsonb_build_object('Authorization', 'Bearer ' || c.secreto, 'Content-Type', 'application/json'),
    body    := '{}'::jsonb
  );
end $$;

select cron.unschedule(jobname) from cron.job where jobname like 'pastillita-%';
select cron.schedule('pastillita-9pm',   '0 2 * * *',  'select privado.llamar_cron()');
select cron.schedule('pastillita-930pm', '30 2 * * *', 'select privado.llamar_cron()');

-- Para revisar que corren:
--   select jobname, schedule from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select id, status_code, content from net._http_response order by id desc limit 10;
