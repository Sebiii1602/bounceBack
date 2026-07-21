-- Sammel-Migration: bringt eine bestehende Datenbank auf den aktuellen Stand.
-- Enthält alles, was seit dem ersten schema.sql dazugekommen ist, und ist
-- idempotent — mehrfaches Ausführen schadet nicht. Wer unsicher ist, welche
-- Einzel-Migrationen schon gelaufen sind, führt einfach diese Datei aus.
--
-- Im Supabase-Dashboard: SQL Editor → einfügen → Run.
-- Erwartetes Ergebnis: „Success. No rows returned“.
--
-- Nicht enthalten (weil sie eigene Schritte brauchen): die Zeitplanung der
-- Erinnerungen (pg_cron) — siehe migration-2026-07-22-reminders.sql, Teil 2.

-- 08.07.2026 — Eintrag-Modus pro Habit (gleicher Tag vs. Folgetag)
alter table public.habits add column if not exists log_same_day boolean not null default false;

-- 19.07.2026 — Special Days (Highlight, zählt normal als on track)
alter table public.logs add column if not exists special boolean not null default false;

-- 20.07.2026 — Stärke eines Ausrutschers (wirkt nur aufs Momentum)
alter table public.logs add column if not exists severity smallint;

-- 23.07.2026 — Notizen am laufenden Tag, bevor der Tag bewertbar ist
alter table public.logs add column if not exists rated boolean not null default true;

-- 14.07.2026 — Tags konvergieren über (user_id, label) statt über feste IDs.
-- Vorher prüfen, ob es Dubletten gibt (muss 0 Zeilen liefern):
--   select user_id, label, count(*) from public.tags
--   group by 1, 2 having count(*) > 1;
-- Falls doch welche auftauchen, erst die überzähligen Zeilen löschen.
create unique index if not exists tags_user_label_idx on public.tags (user_id, label);

-- 22.07.2026 — Erinnerungen (Tabelle + RLS; der Zeitplan folgt separat)
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
