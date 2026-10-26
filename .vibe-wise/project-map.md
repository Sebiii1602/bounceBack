# Project Map

## Purpose
Persönlicher Habit-Recovery-Tracker (PWA): Trend statt Streak, kein Reset auf null, keine Scham-Sprache. Mehrere unabhängige Accounts (Owner + Kollegen).

## Requirements
- Vergessene (nicht geloggte) Tage zählen nicht in den Nenner.
- Eintrag-Modus pro Habit: Aktiv-Habits am selben Tag, Lass-Habits am Folgetag.
- Neu angefragt (offen): Habits ohne Tagespflicht (z. B. Gym, Skaten) und Pausen (Urlaub, Verletzung).

## Components
- UI: React-Routen `src/routes/` (Today, History, Trends, More, Auth), Komponenten `src/components/`.
- Datenmodell: `src/lib/types.ts` — Habit (name, log_same_day), LogEntry (date, rated, on_track, special, severity, trigger_tags, note), Tag.
- Lokale DB: Dexie/IndexedDB `src/lib/db.ts` (versionierte Schemas).
- Metriken: `src/lib/metrics.ts` — 30-Tage-%, Momentum (EWMA, Werte in `src/lib/config.ts`), Perfekte Wochen (7 On-track-Tage in Folge), aktuelle Serie, letzte 7 Tage, Tag-/Wochentag-Statistik. Tests: `metrics.test.ts`.
- Sync: `src/lib/sync.ts` — Outbox → Supabase, Last-Write-Wins.
- Server: Supabase (`supabase/schema.sql` + Migrationen), Edge Function `send-reminders` (Web-Push).

## Main Flow
Nutzer bewertet Tag (DaySheet) --schreibt LogEntry--> Dexie --Outbox--> Supabase
Dexie --LiveQuery--> metrics.ts --Werte--> Today/Trends/History

## Data and Trust Boundaries
Supabase Auth (E-Mail+Passwort), Daten pro user_id. VAPID-Private-Key nur lokal (gitignored).

## Build and Deployment
Vite; `npm run dev`, `npm run dev:local` (Port 5199, ohne Supabase). Vercel Auto-Deploy bei Push auf GitHub `Sebiii1602/bounceBack`. Neue Spalten brauchen eine Supabase-Migration vor dem Push.

## Unknowns
- Wie „nicht täglich“ und „Pause“ im Datenmodell und in den Metriken aussehen — noch nicht entschieden.
