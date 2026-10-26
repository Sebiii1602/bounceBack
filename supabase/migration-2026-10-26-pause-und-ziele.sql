-- Nur nötig, wenn schema.sql schon VOR dem 26.10.2026 eingespielt wurde.
-- Idempotent, einfach im Supabase SQL Editor ausführen.

-- Pausierte Tage (verletzt/krank): zählen in keiner Metrik und unterbrechen
-- keine Serie — sie überbrücken sie.
alter table public.logs add column if not exists paused boolean not null default false;

-- Ziel-Habits: „n-mal pro Woche reicht" statt täglicher Bewertung.
alter table public.habits add column if not exists target_per_week smallint
  check (target_per_week is null or target_per_week between 1 and 7);

-- Tagesimpuls pro Habit (z. B. ein italienischer Absatz beim Öffnen).
alter table public.habits add column if not exists prompt_deck text;
