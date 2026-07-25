# bounceBack

**Trend statt Streak.** Persönlicher Habit-Recovery-Tracker als PWA — kein Zähler, der bei einem Ausrutscher auf null springt, sondern rollierende 30-Tage-Kurven, ein Momentum-Score und automatische Trigger-Muster.

## Prinzipien

- **Kein Reset auf null.** Alle Metriken sind rollierend oder gedämpft — ein Ausrutscher ist ein kleiner Dip, kein Absturz.
- **Keine Scham-Sprache, keine Ampelfarben.** Gedecktes Salbei/Sand statt Rot/Grün, neutrale Texte.
- **Loggen in unter 5 Sekunden.** Zwei große Buttons, Trigger-Tags optional (1 Tap), Notiz optional.
- **Trend vor Status.** Die Kurve der letzten 30/60/90 Tage ist die Hauptansicht.

## Features

- Mehrere Habits mit **Eintrag-Modus pro Habit**: Aktiv-Habits (Gym) trägst du am selben Tag ein („Heute nicht“), Lass-Habits (Rauchen) erst am Folgetag („Gestern nicht“) — ein Lass-Tag wird erst bewertet, wenn er vorbei ist
- **Notieren, während der Tag noch läuft**: Bei Folgetag-Habits gibt es neben „Gestern bewerten“ den Tab „Heute notieren“ — für den Moment, in dem der Druck da ist. Trigger und Notiz landen am heutigen Tag, ohne ihn zu bewerten; morgen steht beides schon da, wenn der Tag drankommt. So wird der Tracker nebenbei zum Tagebuch
- Trigger-Tags — Defaults plus eigene, direkt im Log-Flow anlegbar
- Rolling 30-Tage-% (nicht geloggte Tage zählen nicht gegen dich) + Kurve über 30/60/90 Tage
- Momentum-Score: +2 pro on-track-Tag, −6/−10/−14 pro Ausrutscher je nach Stärke (optional bewertbar: Leicht/Mittel/Deutlich — z. B. „wie weit über dem Kalorienbudget?“), begrenzt auf 0–100, Start bei 50. Mit Kurve und In-App-Erklärung (ⓘ) im Trend-Tab
- **Perfekte Wochen**: Wochenstreifen (Mo–So) auf der Heute-Karte plus ein Lebenszeit-Zähler voller Wochen. Ein Sammelstand, kein Streak — er kann nur steigen, eine schlechte Woche nimmt nichts weg
- Im Notieren-Tab steht, was ein Ausrutscher heute wirklich kosten würde („Momentum 62 → 52“) — geschätzt fällt das im Zweifel zu niedrig aus
- Muster-Ansicht: häufigste Trigger + Wochentagsverteilung der „Heute nicht“-Tage (ab 3 Einträgen)
- Kalender-Verlauf mit Nachtragen/Ändern beliebiger Tage
- **Special Days**: richtig gute Tage blau hervorheben (mit Notiz und Triggern zum Erinnern) — sie zählen ganz normal als on track, das Blau ist nur die Krone obendrauf. Farbwechsel löscht nie Notizen. Tage mit Notiz tragen ein kleines Bookmark im Kalender
- Local-first: alles liegt in IndexedDB auf dem Gerät, funktioniert komplett offline; mit Supabase-Keys synct es zusätzlich zwischen Geräten

## Lokal starten (Mac)

```bash
npm install
npm run dev
```

→ [http://localhost:5173](http://localhost:5173). Ohne Supabase-Keys läuft die App im **lokalen Modus** — voll benutzbar, Daten bleiben auf diesem Gerät.

Tests (Metrik-Funktionen): `npm test` · Production-Build: `npm run build`

## Supabase einrichten (~5 Minuten, kostenlos)

Damit Mac und iPhone dieselben Daten sehen (und du ein Backup hast):

1. Auf [supabase.com](https://supabase.com) registrieren (Login mit GitHub geht am schnellsten).
2. **New project** → Name z. B. `bounceback`, Datenbank-Passwort generieren lassen (musst du dir nicht merken), Region **Frankfurt (eu-central-1)** → warten bis das Projekt bereit ist.
3. Links **SQL Editor** öffnen → kompletten Inhalt von [`supabase/schema.sql`](supabase/schema.sql) einfügen → **Run**. („Success. No rows returned“ ist das erwartete Ergebnis.)

   **Läuft die Datenbank schon länger?** Dann einmal [`supabase/migration-alles-nachziehen.sql`](supabase/migration-alles-nachziehen.sql) ausführen — die Sammeldatei enthält alle seither dazugekommenen Spalten, ist idempotent und ersetzt das Durchgehen der Einzel-Migrationen. Fehlt auch nur eine Spalte, schlägt der Log-Sync stillschweigend fehl (der Fehlertext steht dann unter „Mehr → Sync“).
4. **Project Settings → API**: `Project URL` und den `anon public` Key kopieren.
5. Im Projektordner:
   ```bash
   cp .env.example .env.local
   ```
   und beide Werte in `.env.local` eintragen. Dev-Server neu starten.
6. **Authentication → URL Configuration → Site URL** auf `http://localhost:5173` setzen (später auf die Vercel-URL ändern).
7. In der App mit E-Mail + Passwort registrieren.

**Falls die Bestätigungs-Mail nicht ankommt** (auch im Spam nicht — Supabase' eingebauter Mailer ist limitiert):
Dashboard → **Authentication → Sign In / Up → „Confirm email“ ausschalten**, dann unter **Authentication → Users** den halb angelegten Account löschen und in der App einfach nochmal registrieren — geht dann sofort ohne Mail. Die App kann beide Modi, Code-Änderungen sind nicht nötig.

**„Allow new users to sign up“ bleibt an** — Kollegen, denen du den Link schickst, registrieren sich über dieselbe URL mit eigener E-Mail + Passwort und bekommen automatisch ihren eigenen, per RLS getrennten Datenbereich; niemand sieht die Habits/Logs eines anderen Accounts. Nur falls die App irgendwann ausschließlich für dich allein bleiben soll, ließe sich der Toggle abschalten.

> Hinweis Free Tier: Nach ~1 Woche ohne Nutzung pausiert Supabase das Projekt. Die App läuft dann lokal weiter; im Dashboard „Restore“ klicken und der Sync holt alles nach.

## Erinnerungen einrichten (einmalig, ~10 Minuten)

Die sanfte tägliche Push-Erinnerung („Kurzer Check-in: Wie war gestern?“) braucht drei Dinge in Supabase — App-seitig ist alles schon da (Mehr → Erinnerung):

1. **Tabelle anlegen:** SQL Editor → Teil 1 aus [`supabase/migration-2026-07-22-reminders.sql`](supabase/migration-2026-07-22-reminders.sql) ausführen.
2. **Edge Function deployen:** Dashboard → **Edge Functions → Deploy a new function** → Name `send-reminders` → Code aus [`supabase/functions/send-reminders/index.ts`](supabase/functions/send-reminders/index.ts) einfügen → **„Verify JWT“ ausschalten** → Deploy. Danach unter **Secrets** drei Werte setzen: `VAPID_PUBLIC_KEY` (steht in `src/lib/config.ts`), `VAPID_PRIVATE_KEY` (liegt lokal in `supabase/vapid-private-key.txt` — nie committen!) und `CRON_SECRET` (beliebige lange Zufallszeichenkette, selbst ausdenken).
3. **Zeitplan:** SQL Editor → Teil 2 derselben Migrationsdatei, vorher `PROJECT_REF` (aus deiner Projekt-URL) und `DEIN_CRON_SECRET` ersetzen → Run. Ab dann prüft Supabase stündlich, wer gerade dran ist.

**iPhone-Hinweis:** Push funktioniert nur in der **installierten** App (Zum Home-Bildschirm, iOS 16.4+) — im normalen Safari-Tab zeigt die App stattdessen einen Hinweis. Beim Aktivieren fragt iOS einmal nach Erlaubnis.

## Auf GitHub + Vercel (fürs iPhone)

1. Neues GitHub-Repo `BounceBack` anlegen, dann:
   ```bash
   git remote add origin git@github.com:DEIN-USER/BounceBack.git
   git push -u origin main
   ```
2. Auf [vercel.com](https://vercel.com) mit GitHub anmelden → **Add New → Project** → `BounceBack` importieren. Framework „Vite“ wird automatisch erkannt.
3. Bei **Environment Variables** die beiden Werte aus `.env.local` eintragen (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) → **Deploy**.
4. ⚠️ **Wichtig, sonst laufen alle Bestätigungs- und Reset-Mails ins Leere:** In Supabase unter **Authentication → URL Configuration**
   - **Site URL** auf die Vercel-URL setzen (z. B. `https://bounceback.vercel.app`),
   - unter **Redirect URLs** zusätzlich `http://localhost:5173/**` eintragen, damit lokales Entwickeln weiter funktioniert.

   Steht dort noch der Standardwert `http://localhost:3000`, zeigen die Links in den E-Mails dorthin — auf dem Handy erscheint dann „This site can't be reached“.

## Aufs iPhone (PWA installieren)

1. Vercel-URL in **Safari** öffnen und anmelden.
2. **Teilen-Button → „Zum Home-Bildschirm“**.
3. bounceBack liegt jetzt als App-Icon auf dem Home-Bildschirm — eigenes Fenster, offline-fähig, Logs syncen sobald wieder Netz da ist.

## Wie die Zahlen funktionieren

- **Eintrag-Modus pro Habit:** „Folgetag“ (Standard) für alles, was man lässt — um 14 Uhr weißt du noch nicht, wie der Tag um 23:59 ausgeht, deshalb ist heute gesperrt (auch im Kalender). „Gleicher Tag“ für Aktives wie Gym — einmal hin, Tag geschafft. Umschalten jederzeit unter „Mehr“ am Chip neben dem Habit; ältere Tage lassen sich immer nachtragen.
- **30-Tage-%:** Anteil „on track“ an den *geloggten* Tagen der letzten 30 Kalendertage. Vergessene Tage zählen nicht in den Nenner — Vergessen wird nicht bestraft. Nachtragen geht jederzeit über den Kalender.
- **Momentum:** startet bei 50, `+2` pro on-track-Tag, `−6/−10/−14` pro Ausrutscher je nach Stärke (unbewertet = mittel), immer zwischen 0 und 100. Ein deutlicher Ausrutscher kostet damit genau sieben On-track-Tage — spürbar genug, um im Moment der Versuchung zu zählen, und trotzdem eine Delle statt eines Resets. Nicht geloggte Tage frieren den Wert ein. Die Stärke wirkt bewusst **nur** aufs Momentum — die 30-Tage-% bleiben binär (Richtung, nicht Ausmaß). Konstanten in [`src/lib/config.ts`](src/lib/config.ts).
- **Perfekte Wochen:** eine Kalenderwoche Mo–So, in der **alle sieben Tage eingetragen und on track** waren. Bewusst streng — die Schärfe ist der Punkt. Der Zähler ist ein Sammelstand über die gesamte Nutzungsdauer und geht **nie** runter: eine schlechte Woche nimmt nichts weg, sie legt nur nichts dazu. Genau darin liegt der Unterschied zum Streak. Einen vergessenen Tag kannst du über den Kalender nachtragen, dann zählt die Woche weiterhin.
- **Nur notiert ≠ bewertet:** Ein Tag, zu dem bisher nur eine Notiz existiert, zählt in **keiner** Zahl mit — nicht in den 30 Tagen, nicht im Momentum, nicht in den Mustern. Im Kalender steht er gestrichelt. Erst die Bewertung macht ihn zu einem gezählten Tag; Notiz und Trigger bleiben dabei erhalten.
- **Muster:** erscheinen ab 3 „Heute nicht“-Einträgen — Trigger-Häufigkeit und Wochentagsverteilung.

## Tech-Stack

Vite + React 19 + TypeScript · Tailwind CSS 4 · Dexie (IndexedDB, local-first) · Supabase (Postgres + Auth, Sync via Outbox/Cursor, Last-Write-Wins) · Recharts · date-fns · vite-plugin-pwa · vitest

```
src/
  lib/        Datenmodell (db.ts), Metriken (metrics.ts), Sync (sync.ts), Auth, Texte (copy.ts)
  components/ Wiederverwendbare UI (LogButtons, TagPicker, Kalender, Chart …)
  routes/     Die vier Tabs: Heute, Trend, Verlauf, Mehr + AuthScreen
supabase/     schema.sql zum Einfügen im SQL Editor
```

## Roadmap

- CSV-Export (Platz ist unter „Mehr“ reserviert)
- Kombinierter Score über mehrere Habits
- App-Lock (Face ID / PIN)
