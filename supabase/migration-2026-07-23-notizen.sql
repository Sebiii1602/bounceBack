-- Nur nötig, wenn schema.sql schon VOR dem 23.07.2026 eingespielt wurde:
-- Notizen am laufenden Tag („Urge festhalten“, bevor der Tag bewertbar ist).
-- rated = false bedeutet: Eintrag hält nur Notiz und Trigger fest und zählt
-- in keiner Metrik mit; on_track ist dann bedeutungslos.
-- Idempotent, einfach im Supabase SQL Editor ausführen.
alter table public.logs add column if not exists rated boolean not null default true;
