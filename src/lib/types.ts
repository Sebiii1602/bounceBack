export interface Habit {
  id: string
  name: string
  /** true = am selben Tag eintragbar (Aktiv-Habit, z. B. Gym); false = erst am Folgetag (Lass-Habit, z. B. Rauchen) */
  log_same_day: boolean
  /**
   * Ziel-Habit: `n`-mal pro Woche reicht (z. B. 2× Gym). null = täglich bewerten.
   * Bei einem Ziel-Habit wird nur eingetragen, was stattgefunden hat — ein Tag
   * ohne Eintrag ist kein Fehler, sondern einfach kein Trainingstag.
   */
  target_per_week: number | null
  /**
   * Tagesimpuls: kleiner Inhalt, der beim Öffnen erscheint (z. B. ein
   * italienischer Absatz). null = keiner.
   */
  prompt_deck: PromptDeck | null
  /**
   * Deckname für den Diskret-Modus. Ist er gesetzt, gilt der Habit als privat
   * und zeigt verdeckt diesen Namen statt des echten — bewusst ein harmloser
   * Name statt Punkten oder Weichzeichner: Zensur zieht Blicke an, Langeweile
   * nicht. Notizen und Trigger sind verdeckt ebenfalls ausgeblendet.
   */
  private_alias: string | null
  /** Reihenfolge in allen Listen; kleiner zuerst. */
  sort_order: number
  /**
   * Tonaufnahmen erlaubt (z. B. Gitarre). Bewusst eine Zugabe und keine
   * Pflicht: Abhaken geht immer ohne. Eine Aufnahme zur Bedingung zu machen
   * würde das Eintragen von fünf Sekunden auf fünf Minuten verlängern — und
   * an Tagen ohne Lust fällt dann beides aus.
   */
  audio_notes: boolean
  created_at: string
  updated_at: string
}

/** Verfügbare Tagesimpuls-Sammlungen (siehe `src/lib/prompts/`). */
export type PromptDeck = 'italienisch'

/** Stärke eines „Nicht on track“-Tags: 1 = leicht, 2 = mittel, 3 = deutlich */
export type Severity = 1 | 2 | 3

export interface LogEntry {
  id: string
  habit_id: string
  /** Lokales Kalenderdatum als 'yyyy-MM-dd' */
  date: string
  /**
   * false = nur notiert, noch nicht bewertet (Urge/Tagebuch am laufenden Tag).
   * Solche Einträge zählen nirgends mit — sie halten nur Notiz und Trigger fest,
   * bis der Tag vorbei ist und bewertet wird. `on_track` ist dann bedeutungslos.
   */
  rated: boolean
  on_track: boolean
  /**
   * Special Day: Highlight-Markierung (blau) für richtig gute Tage.
   * Zählt ganz normal als on track — `special` ist nur die Krone obendrauf.
   */
  special: boolean
  /**
   * Pausiert: Der Tag konnte nicht stattfinden — verletzt, krank, Zwangspause.
   * Kein Ausrutscher, sondern ein Tag außer Konkurrenz: zählt in keiner Metrik,
   * friert das Momentum ein und **unterbricht keine Serie**, sondern überbrückt
   * sie. Nur bei Habits sinnvoll, die man aktiv tut.
   */
  paused: boolean
  /**
   * Wie stark war der Ausrutscher? Nur relevant, wenn nicht on track;
   * null = nicht bewertet und zählt wie „mittel“. Wirkt nur aufs Momentum,
   * nie auf die 30-Tage-% — die bleiben bewusst binär (Richtung, nicht Ausmaß).
   */
  severity: Severity | null
  trigger_tags: string[]
  note: string | null
  created_at: string
  updated_at: string
}

export interface Tag {
  id: string
  label: string
  created_at: string
  updated_at: string
}

export type SyncTable = 'habits' | 'tags' | 'logs'

export interface OutboxRow {
  seq: number
  table: SyncTable
  op: 'upsert' | 'delete'
  row_id: string
}

export interface MetaRow {
  key: string
  value: string
}

/**
 * Eine Tonaufnahme zu einem Tag. Liegt **nur lokal** in IndexedDB und geht
 * nie in den Sync: Audio-Blobs durch die Outbox zu schieben würde den
 * Speicher sprengen und jeden Konflikt unlösbar machen. Das Archiv ist
 * dadurch an dieses Gerät gebunden — dafür kostet es nichts und braucht
 * keinen Upload.
 */
export interface Recording {
  id: string
  habit_id: string
  /** Lokales Kalenderdatum als 'yyyy-MM-dd' */
  date: string
  blob: Blob
  /** MIME-Typ, den der Browser tatsächlich geliefert hat. */
  mime: string
  duration_ms: number
  /** Eigener Titel, sonst null (dann wird die Uhrzeit angezeigt). */
  label: string | null
  created_at: string
}
