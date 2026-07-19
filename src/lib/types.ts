export interface Habit {
  id: string
  name: string
  /** true = am selben Tag eintragbar (Aktiv-Habit, z. B. Gym); false = erst am Folgetag (Lass-Habit, z. B. Rauchen) */
  log_same_day: boolean
  created_at: string
  updated_at: string
}

export interface LogEntry {
  id: string
  habit_id: string
  /** Lokales Kalenderdatum als 'yyyy-MM-dd' */
  date: string
  on_track: boolean
  /**
   * Special Day: Tag ist markiert (blau) statt bewertet — zählt nicht in
   * Prozent/Momentum. `on_track` ist dann nur ein maskierter Platzhalter.
   */
  special: boolean
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
