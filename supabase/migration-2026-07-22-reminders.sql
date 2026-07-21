-- Sanfte tägliche Erinnerung (Web Push) — Teil 1: Tabelle + RLS.
-- Einfach im Supabase SQL Editor ausführen (idempotent).

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  subscription jsonb not null,
  hour smallint not null default 20 check (hour between 0 and 23),
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "own push subs" on public.push_subscriptions;
create policy "own push subs" on public.push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Teil 2: stündlicher Anstoß der Edge Function „send-reminders“.
-- VORHER die Funktion deployen und die Secrets setzen (siehe README),
-- dann unten PROJECT_REF und DEIN_CRON_SECRET ersetzen und ausführen.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Bei erneutem Ausführen erst den alten Job entfernen:
-- select cron.unschedule('send-reminders-hourly');

select cron.schedule(
  'send-reminders-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', 'DEIN_CRON_SECRET'),
    body := '{}'::jsonb
  );
  $$
);
