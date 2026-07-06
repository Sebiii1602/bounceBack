# bounceBack

**Trend statt Streak.** Persönlicher Habit-Recovery-Tracker als PWA — kein Zähler, der bei einem Ausrutscher auf null springt, sondern rollierende 30-Tage-Kurven, ein Momentum-Score und automatische Trigger-Muster.

## Prinzipien

- **Kein Reset auf null.** Alle Metriken sind rollierend oder gedämpft — ein Ausrutscher ist ein kleiner Dip, kein Absturz.
- **Keine Scham-Sprache, keine Ampelfarben.** Gedecktes Salbei/Sand statt Rot/Grün, neutrale Texte.
- **Loggen in unter 5 Sekunden.** Zwei große Buttons, Trigger-Tags optional (1 Tap), Notiz optional.
- **Trend vor Status.** Die Kurve der letzten 30/60/90 Tage ist die Hauptansicht.

## Features

- Mehrere Habits, tägliches Log („On track“ / „Heute nicht“)
- Trigger-Tags — Defaults plus eigene, direkt im Log-Flow anlegbar
- Rolling 30-Tage-% (nicht geloggte Tage zählen nicht gegen dich) + Kurve über 30/60/90 Tage
- Momentum-Score: +2 pro on-track-Tag, −8 pro Ausrutscher, begrenzt auf 0–100, Start bei 50
- Muster-Ansicht: häufigste Trigger + Wochentagsverteilung der „Heute nicht“-Tage (ab 3 Einträgen)
- Kalender-Verlauf mit Nachtragen/Ändern beliebiger Tage
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

Optional (empfohlen, sobald dein Account existiert): **Authentication → Sign In / Up → „Allow new users to sign up“ ausschalten** — dann kann niemand sonst ein Konto auf deinem Projekt anlegen.

> Hinweis Free Tier: Nach ~1 Woche ohne Nutzung pausiert Supabase das Projekt. Die App läuft dann lokal weiter; im Dashboard „Restore“ klicken und der Sync holt alles nach.

## Auf GitHub + Vercel (fürs iPhone)

1. Neues GitHub-Repo `BounceBack` anlegen, dann:
   ```bash
   git remote add origin git@github.com:DEIN-USER/BounceBack.git
   git push -u origin main
   ```
2. Auf [vercel.com](https://vercel.com) mit GitHub anmelden → **Add New → Project** → `BounceBack` importieren. Framework „Vite“ wird automatisch erkannt.
3. Bei **Environment Variables** die beiden Werte aus `.env.local` eintragen (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) → **Deploy**.
4. In Supabase die **Site URL** auf die Vercel-URL ändern (z. B. `https://bounceback.vercel.app`).

## Aufs iPhone (PWA installieren)

1. Vercel-URL in **Safari** öffnen und anmelden.
2. **Teilen-Button → „Zum Home-Bildschirm“**.
3. bounceBack liegt jetzt als App-Icon auf dem Home-Bildschirm — eigenes Fenster, offline-fähig, Logs syncen sobald wieder Netz da ist.

## Wie die Zahlen funktionieren

- **30-Tage-%:** Anteil „on track“ an den *geloggten* Tagen der letzten 30 Kalendertage. Vergessene Tage zählen nicht in den Nenner — Vergessen wird nicht bestraft. Nachtragen geht jederzeit über den Kalender.
- **Momentum:** startet bei 50, `+2` pro on-track-Tag, `−8` pro „Heute nicht“, immer zwischen 0 und 100. Nicht geloggte Tage frieren den Wert ein. Konstanten in [`src/lib/config.ts`](src/lib/config.ts).
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
- Sanfte tägliche Erinnerung (Web Push, iOS 16.4+)
- Kombinierter Score über mehrere Habits
- Dark Mode
