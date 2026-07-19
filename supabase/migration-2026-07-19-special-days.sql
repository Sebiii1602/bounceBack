-- Nur nötig, wenn schema.sql schon VOR dem 19.07.2026 eingespielt wurde:
-- Special Days — Tage blau markieren (mit Notiz/Triggern), ohne sie zu bewerten.
-- Idempotent, einfach im Supabase SQL Editor ausführen.
alter table public.logs add column if not exists special boolean not null default false;
