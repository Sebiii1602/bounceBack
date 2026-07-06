/**
 * Alle UI-Texte an einem Ort. Deutsch mit bewussten Anglizismen („on track“,
 * „Momentum“, „Trigger“). Keine Scham-Sprache: nie „versagt“, „clean“,
 * „Rückfall-Serie“ o. Ä. — neutral und faktisch.
 */
export const copy = {
  appName: 'bounceBack',
  tagline: 'Trend statt Streak.',

  tabs: {
    today: 'Heute',
    trend: 'Trend',
    history: 'Verlauf',
    more: 'Mehr',
  },

  common: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    add: 'Hinzufügen',
    delete: 'Löschen',
    rename: 'Umbenennen',
    loading: 'Lädt…',
  },

  today: {
    onTrack: 'On track',
    notToday: 'Heute nicht',
    logged: (day: string, onTrack: boolean) =>
      `Eingetragen: ${day} — ${onTrack ? 'on track' : 'nicht on track'}`,
    change: 'Ändern',
    triggers: 'Trigger? (optional)',
    newTagPlaceholder: 'Neuer Trigger…',
    addTagChip: '+ Neu',
    notePlaceholder: 'Notiz (optional)',
    done: 'Fertig',
    emptyTitle: 'Leg deinen ersten Habit an',
    emptyHint: 'Das, worum es gerade geht. Weitere kannst du später unter „Mehr“ hinzufügen.',
    habitNamePlaceholder: 'Name des Habits',
    start: 'Los geht’s',
    statLine: (pct: string, momentum: number) => `30 Tage: ${pct} · Momentum ${momentum}`,
  },

  trend: {
    headlinePct: 'der letzten 30 Tage on track',
    noData: 'Noch keine Einträge — ab dem ersten Log entsteht hier deine Kurve.',
    momentum: 'Momentum',
    momentumHint: 'Steigt langsam, sinkt bei einem Ausrutscher nur leicht — nie auf null.',
    days: (n: number) => `${n} Tage`,
    patterns: 'Muster',
    patternsEmpty: 'Noch nicht genug Daten — Muster erscheinen nach ein paar Einträgen.',
    patternTags: 'Häufigste Trigger an „Heute nicht“-Tagen',
    patternWeekdays: 'Wochentage der „Heute nicht“-Tage',
    ofTotal: (n: number, total: number) => `${n} von ${total}`,
  },

  history: {
    legendOnTrack: 'on track',
    legendNot: 'nicht on track',
    legendNone: 'kein Eintrag',
    removeEntry: 'Eintrag entfernen',
  },

  more: {
    habits: 'Habits',
    addHabit: 'Neuer Habit…',
    deleteHabitConfirm: (name: string) => `„${name}“ und alle zugehörigen Einträge löschen?`,
    habitDeleteOnlineOnly: 'Habits löschen geht nur mit Internetverbindung.',
    tags: 'Trigger-Tags',
    addTag: 'Neuer Trigger…',
    deleteTagConfirm: (label: string) => `Tag „${label}“ löschen? Bestehende Einträge behalten ihn.`,
    sync: 'Sync',
    syncLocal: 'Lokaler Modus — Supabase ist noch nicht verbunden. Anleitung: README.md',
    syncOffline: 'Offline — Änderungen werden später synchronisiert',
    syncSynced: 'Synchronisiert',
    syncSyncing: 'Synchronisiert…',
    syncError: 'Sync-Fehler — wird erneut versucht',
    syncNow: 'Jetzt synchronisieren',
    lastSync: (t: string) => `Zuletzt: ${t}`,
    account: 'Account',
    signOut: 'Abmelden',
    exportCsv: 'CSV-Export',
    exportSoon: 'bald',
  },

  auth: {
    signIn: 'Anmelden',
    signUp: 'Konto erstellen',
    email: 'E-Mail',
    password: 'Passwort (mind. 6 Zeichen)',
    switchToSignUp: 'Neu hier? Konto erstellen',
    switchToSignIn: 'Schon ein Konto? Anmelden',
    confirmSentTitle: 'Bestätigungs-Mail geschickt',
    confirmSentBody: (email: string) =>
      `Wir haben eine Mail an ${email} geschickt — auch im Spam-Ordner nachsehen. Nach dem Bestätigen hier anmelden.`,
    backToSignIn: 'Zur Anmeldung',
    errors: {
      invalid: 'E-Mail oder Passwort falsch',
      notConfirmed: 'E-Mail noch nicht bestätigt — sieh in dein Postfach (auch Spam)',
      weakPassword: 'Passwort zu kurz — mindestens 6 Zeichen',
      generic: 'Hat nicht geklappt — bitte nochmal versuchen',
    },
  },
} as const
