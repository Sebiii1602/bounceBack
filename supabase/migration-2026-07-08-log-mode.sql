-- Nur nötig, wenn schema.sql schon VOR dem 08.07.2026 eingespielt wurde:
-- fügt den Eintrag-Modus pro Habit nach (Gleicher Tag vs. Folgetag).
-- Einfach im Supabase SQL Editor ausführen — ist idempotent.
alter table public.habits add column if not exists log_same_day boolean not null default false;
