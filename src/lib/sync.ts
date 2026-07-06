import { useSyncExternalStore } from 'react'
import type { Session } from '@supabase/supabase-js'
import { db } from './db'
import { nowIso } from './dates'
import { supabase } from './supabase'
import type { Habit, LogEntry, SyncTable, Tag } from './types'

export type SyncState = 'disabled' | 'offline' | 'syncing' | 'synced' | 'error'

export interface SyncSnapshot {
  state: SyncState
  lastSyncAt: string | null
}

let snapshot: SyncSnapshot = { state: supabase ? 'offline' : 'disabled', lastSyncAt: null }
const listeners = new Set<() => void>()

function setSnapshot(next: Partial<SyncSnapshot>): void {
  snapshot = { ...snapshot, ...next }
  listeners.forEach((l) => l())
}

export function useSyncStatus(): SyncSnapshot {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => snapshot,
  )
}

// Letzten Sync-Zeitpunkt aus der lokalen DB wiederherstellen
void db.meta.get('last_sync').then((row) => {
  if (row) setSnapshot({ lastSyncAt: row.value })
})

/** Reihenfolge wegen Fremdschlüsseln: logs referenzieren habits. */
const TABLE_ORDER: readonly SyncTable[] = ['habits', 'tags', 'logs']

const newerOrEqual = (a: string, b: string): boolean =>
  new Date(a).getTime() >= new Date(b).getTime()

async function pushOutbox(): Promise<void> {
  const ops = await db.outbox.orderBy('seq').toArray()
  if (ops.length === 0) return

  for (const table of TABLE_ORDER) {
    const upserts = ops.filter((o) => o.table === table && o.op === 'upsert')
    if (upserts.length === 0) continue
    const rowIds = [...new Set(upserts.map((o) => o.row_id))]
    const rows = (await db.table(table).bulkGet(rowIds)).filter((r) => r !== undefined)
    if (rows.length > 0) {
      const { error } = await supabase!
        .from(table)
        .upsert(rows, { onConflict: table === 'logs' ? 'habit_id,date' : 'id' })
      if (error) throw error
    }
    await db.outbox.bulkDelete(upserts.map((o) => o.seq))
  }

  // Deletes nach den Upserts; umgekehrte Tabellen-Reihenfolge wegen FKs
  for (const table of [...TABLE_ORDER].reverse()) {
    const dels = ops.filter((o) => o.table === table && o.op === 'delete')
    if (dels.length === 0) continue
    const { error } = await supabase!
      .from(table)
      .delete()
      .in('id', [...new Set(dels.map((o) => o.row_id))])
    if (error) throw error
    await db.outbox.bulkDelete(dels.map((o) => o.seq))
  }
}

type RemoteRow = Record<string, unknown>

function normalize(table: SyncTable, raw: RemoteRow): Habit | Tag | LogEntry {
  if (table === 'logs') {
    return {
      id: raw.id as string,
      habit_id: raw.habit_id as string,
      date: raw.date as string,
      on_track: raw.on_track as boolean,
      trigger_tags: (raw.trigger_tags as string[] | null) ?? [],
      note: (raw.note as string | null) ?? null,
      created_at: raw.created_at as string,
      updated_at: raw.updated_at as string,
    }
  }
  const base = {
    id: raw.id as string,
    created_at: raw.created_at as string,
    updated_at: raw.updated_at as string,
  }
  return table === 'habits'
    ? { ...base, name: raw.name as string }
    : { ...base, label: raw.label as string }
}

async function pullTable(table: SyncTable): Promise<void> {
  const cursorKey = `cursor_${table}`
  const cursor = (await db.meta.get(cursorKey))?.value ?? '1970-01-01T00:00:00Z'
  const { data, error } = await supabase!
    .from(table)
    .select('*')
    .gt('updated_at', cursor)
    .order('updated_at', { ascending: true })
    .limit(1000)
  if (error) throw error
  if (!data || data.length === 0) return

  const pending = new Set((await db.outbox.toArray()).map((o) => o.row_id))

  await db.transaction('rw', [db.habits, db.tags, db.logs, db.meta], async () => {
    for (const raw of data as RemoteRow[]) {
      const row = normalize(table, raw)
      const local = await db.table(table).get(row.id)
      // Lokale, noch nicht gepushte Änderung ist neuer → behalten (last write wins)
      if (local && pending.has(row.id) && newerOrEqual(local.updated_at, row.updated_at)) continue

      if (table === 'logs') {
        const log = row as LogEntry
        // Gleiches (Habit, Datum) unter anderer ID? Remote hat gewonnen → lokale Dublette ersetzen
        const dup = await db.logs.where('[habit_id+date]').equals([log.habit_id, log.date]).first()
        if (dup && dup.id !== log.id) {
          if (pending.has(dup.id) && newerOrEqual(dup.updated_at, log.updated_at)) continue
          await db.logs.delete(dup.id)
        }
      }
      await db.table(table).put(row)
    }
    await db.meta.put({ key: cursorKey, value: (data[data.length - 1] as RemoteRow).updated_at as string })
  })
}

let syncing = false

export async function syncNow(): Promise<void> {
  if (!supabase) return
  const { data } = await supabase.auth.getSession()
  if (!data.session) return
  if (!navigator.onLine) {
    setSnapshot({ state: 'offline' })
    return
  }
  if (syncing) return
  syncing = true
  setSnapshot({ state: 'syncing' })
  try {
    await pushOutbox()
    for (const table of TABLE_ORDER) await pullTable(table)
    const t = nowIso()
    await db.meta.put({ key: 'last_sync', value: t })
    setSnapshot({ state: 'synced', lastSyncAt: t })
  } catch (err) {
    console.error('[sync]', err)
    setSnapshot({ state: 'error' })
  } finally {
    syncing = false
  }
}

/**
 * Nach dem ersten Login: alles Lokale einmalig in die Outbox legen,
 * damit vor dem Login entstandene Daten hochwandern.
 */
export async function onSignedIn(session: Session): Promise<void> {
  const flagKey = `initial_push_${session.user.id}`
  const done = await db.meta.get(flagKey)
  if (!done) {
    const [habits, tags, logs] = await Promise.all([
      db.habits.toArray(),
      db.tags.toArray(),
      db.logs.toArray(),
    ])
    await db.transaction('rw', db.outbox, db.meta, async () => {
      for (const h of habits) await db.outbox.add({ table: 'habits', op: 'upsert', row_id: h.id })
      for (const t of tags) await db.outbox.add({ table: 'tags', op: 'upsert', row_id: t.id })
      for (const l of logs) await db.outbox.add({ table: 'logs', op: 'upsert', row_id: l.id })
      await db.meta.put({ key: flagKey, value: '1' })
    })
  }
  void syncNow()
}

/**
 * Habit-Löschung ist bei aktivem Sync nur online erlaubt (kein Tombstone-Sync).
 * Remote zuerst (Cascade löscht Logs), dann lokal aufräumen.
 */
export async function deleteHabitEverywhere(habitId: string): Promise<void> {
  if (supabase) {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      if (!navigator.onLine) throw new Error('offline')
      const { error } = await supabase.from('habits').delete().eq('id', habitId)
      if (error) throw error
    }
  }
  await db.transaction('rw', db.habits, db.logs, db.outbox, async () => {
    const logIds = (await db.logs.where('habit_id').equals(habitId).primaryKeys()) as string[]
    await db.logs.bulkDelete(logIds)
    await db.habits.delete(habitId)
    const gone = new Set<string>([habitId, ...logIds])
    const stale = (await db.outbox.toArray()).filter((o) => gone.has(o.row_id))
    await db.outbox.bulkDelete(stale.map((o) => o.seq))
  })
}

let wired = false

/** Sync bei Reconnect und beim Zurückkehren in den Tab anstoßen. */
export function wireSyncEvents(): void {
  if (wired || !supabase) return
  wired = true
  window.addEventListener('online', () => void syncNow())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow()
  })
}
