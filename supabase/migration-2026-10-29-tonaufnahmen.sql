-- 29.10.2026 — Tonaufnahmen pro Habit (z. B. Gitarre)
--
-- Nur das Flag kommt in die Datenbank. Die Aufnahmen selbst bleiben lokal in
-- IndexedDB und werden nie hochgeladen: Audio-Blobs durch die Sync-Outbox zu
-- schieben würde den Speicher sprengen und jeden Konflikt unlösbar machen.
--
-- Im Supabase-Dashboard: SQL Editor → einfügen → Run.
-- Erwartetes Ergebnis: „Success. No rows returned“.

alter table public.habits add column if not exists audio_notes boolean not null default false;
