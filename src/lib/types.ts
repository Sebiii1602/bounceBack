export interface Habit {
  id: string
  name: string
  /** true = am selben Tag eintragbar (Aktiv-Habit, z. B. Gym); false = erst am Folgetag (Lass-Habit, z. B. Rauchen) */
  log_same_day: boolean
  created_at: string
  updated_at: string
}

/** Stärke eines „Nicht on track“-Tags: 1 = leicht, 2 = mittel, 3 = deutlich */
export type Severity = 1 | 2 | 3

export interface LogEntry {
  id: string
  habit_id: string
  /** Lokales Kalenderdatum als 'yyyy-MM-dd' */
  date: string
  on_track: boolean
  /**
   * Special Day: Highlight-Markierung (blau) für richtig gute Tage.
   * Zählt ganz normal als on track — `special` ist nur die Krone obendrauf.
   */
  special: boolean
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
