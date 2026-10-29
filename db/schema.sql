-- Tablas de Pastillita. Se puede correr varias veces sin romper nada.

create table if not exists tomas (
  fecha            date primary key,                 -- día en hora de Colombia
  tomada_en        timestamptz not null default now(),
  registrada_tarde boolean not null default false    -- marcada después desde el calendario
);

-- Un aviso por día y tipo: evita correos repetidos aunque el cron llame dos veces.
create table if not exists avisos (
  fecha      date not null,
  tipo       text not null check (tipo in ('recordatorio', 'alerta')),
  enviado_en timestamptz not null default now(),
  primary key (fecha, tipo)
);

create table if not exists ajustes (
  id              int primary key default 1 check (id = 1),
  blister         text not null default '28' check (blister in ('28', '21')),
  inicio_blister  date,                                -- día 1 del blister actual
  inicio_registro date not null default (now() at time zone 'America/Bogota')::date
);

insert into ajustes (id) values (1) on conflict do nothing;

-- Suscripciones de notificaciones push (el iPhone de ella).
create table if not exists push_suscripciones (
  endpoint    text primary key,
  suscripcion jsonb not null,
  creada      timestamptz not null default now()
);

-- Sesión de WhatsApp vinculado. Va en un esquema que la API de Supabase no publica.
create schema if not exists privado;
revoke all on schema privado from public, anon, authenticated;
create table if not exists privado.whatsapp_auth (
  id    text primary key,
  valor text not null
);

-- Supabase publica el esquema public por su API. Con RLS activo y sin políticas,
-- nadie entra por ahí; la web se conecta como postgres, que no pasa por RLS.
alter table tomas   enable row level security;
alter table avisos  enable row level security;
alter table ajustes enable row level security;
alter table push_suscripciones enable row level security;
