-- Nur nötig, wenn schema.sql schon VOR dem 14.07.2026 eingespielt wurde.
--
-- Grund: die Default-Trigger-Tags nutzten bisher sechs feste, global identische
-- UUIDs (gedacht für "eine Person, mehrere eigene Geräte"). Sobald ein zweiter,
-- unabhängiger Account (z. B. ein Kollege) sich anmeldet, seedet dessen Gerät
-- dieselben UUIDs — der erste Sync kollidiert dann mit dem primary key von
-- public.tags und bleibt dauerhaft auf Fehler stehen. Ab jetzt bekommt jedes
-- Tag eine frische, zufällige ID; die Konvergenz zwischen Geräten desselben
-- Accounts läuft stattdessen über einen eindeutigen (user_id, label)-Index.

-- Vor dem Ausführen prüfen, ob (user_id, label) schon Duplikate enthält —
-- CREATE UNIQUE INDEX schlägt sonst fehl. Bei Treffern die neueren/unerwünschten
-- Zeilen manuell löschen, bevor der Index unten erstellt wird.
-- select user_id, label, count(*) from public.tags group by 1, 2 having count(*) > 1;

create unique index if not exists tags_user_label_idx on public.tags (user_id, label);
