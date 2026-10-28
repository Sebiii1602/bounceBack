-- Nur nötig, wenn schema.sql schon VOR dem 28.10.2026 eingespielt wurde.
-- Idempotent, einfach im Supabase SQL Editor ausführen.

-- Deckname für den Diskret-Modus: gesetzt = der Habit gilt als privat und
-- zeigt verdeckt diesen Namen statt des echten.
alter table public.habits add column if not exists private_alias text;

-- Frei wählbare Reihenfolge in allen Listen.
alter table public.habits add column if not exists sort_order integer not null default 0;
