-- Nur nötig, wenn schema.sql schon VOR dem 20.07.2026 eingespielt wurde:
-- Stärke-Bewertung für „Nicht on track“-Tage (1 leicht / 2 mittel / 3 deutlich).
-- Wirkt nur aufs Momentum (−4/−8/−12), nie auf die 30-Tage-%.
-- Idempotent, einfach im Supabase SQL Editor ausführen.
alter table public.logs add column if not exists severity smallint;
