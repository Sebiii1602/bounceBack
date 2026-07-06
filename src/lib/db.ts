import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_TAGS } from './config'
import { nowIso } from './dates'
import type { Habit, LogEntry, MetaRow, OutboxRow, SyncTable, Tag } from './types'

class BounceBackDB extends Dexie {
  habits!: EntityTable<Habit, 'id'>
  logs!: EntityTable<LogEntry, 'id'>
  tags!: EntityTable<Tag, 'id'>
  outbox!: EntityTable<OutboxRow, 'seq'>
  meta!: EntityTable<MetaRow, 'key'>
}

export const db = new BounceBackDB('bounceback')

db.version(1).stores({
  habits: 'id, updated_at',
  logs: 'id, [habit_id+date], habit_id, updated_at',
  tags: 'id, label, updated_at',
  outbox: '++seq, row_id',
  meta: 'key',
})

db.on('populate', (tx) => {
  const t = nowIso()
  void tx
    .table('tags')
    .bulkAdd(DEFAULT_TAGS.map((d) => ({ ...d, created_at: t, updated_at: t })))
})

/**
 * Merkt eine Zeile für den Sync vor. Upserts werden pro Zeile dedupliziert;
 * ein Delete ersetzt alle vorgemerkten Upserts derselben Zeile.
 */
async function enqueue(table: SyncTable, op: 'upsert' | 'delete', rowId: string): Promise<void> {
  if (op === 'delete') {
    await db.outbox.where('row_id').equals(rowId).delete()
  } else {
    const existing = await db.outbox.where('row_id').equals(rowId).first()
    if (existing && existing.op === 'upsert' && existing.table === table) return
  }
  await db.outbox.add({ table, op, row_id: rowId })
}

export async function addHabit(name: string): Promise<string> {
  const id = crypto.randomUUID()
  const t = nowIso()
  await db.transaction('rw', db.habits, db.outbox, async () => {
    await db.habits.add({ id, name: name.trim(), created_at: t, updated_at: t })
    await enqueue('habits', 'upsert', id)
  })
  return id
}

export async function renameHabit(id: string, name: string): Promise<void> {
  await db.transaction('rw', db.habits, db.outbox, async () => {
    await db.habits.update(id, { name: name.trim(), updated_at: nowIso() })
    await enqueue('habits', 'upsert', id)
  })
}

/** Setzt den Zustand für (Habit, Tag) — legt den Log an oder aktualisiert ihn. */
export async function setLogState(habitId: string, date: string, onTrack: boolean): Promise<void> {
  await db.transaction('rw', db.logs, db.outbox, async () => {
    const existing = await db.logs.where('[habit_id+date]').equals([habitId, date]).first()
    const t = nowIso()
    if (existing) {
      await db.logs.update(existing.id, {
        on_track: onTrack,
        // Beim Wechsel auf „on track“ sind Trigger gegenstandslos
        trigger_tags: onTrack ? [] : existing.trigger_tags,
        updated_at: t,
      })
      await enqueue('logs', 'upsert', existing.id)
    } else {
      const id = crypto.randomUUID()
      await db.logs.add({
        id,
        habit_id: habitId,
        date,
        on_track: onTrack,
        trigger_tags: [],
        note: null,
        created_at: t,
        updated_at: t,
      })
      await enqueue('logs', 'upsert', id)
    }
  })
}

export async function toggleLogTag(logId: string, label: string): Promise<void> {
  await db.transaction('rw', db.logs, db.outbox, async () => {
    const log = await db.logs.get(logId)
    if (!log) return
    const tags = log.trigger_tags.includes(label)
      ? log.trigger_tags.filter((x) => x !== label)
      : [...log.trigger_tags, label]
    await db.logs.update(logId, { trigger_tags: tags, updated_at: nowIso() })
    await enqueue('logs', 'upsert', logId)
  })
}

export async function setLogNote(logId: string, note: string): Promise<void> {
  await db.transaction('rw', db.logs, db.outbox, async () => {
    const trimmed = note.trim()
    await db.logs.update(logId, { note: trimmed === '' ? null : trimmed, updated_at: nowIso() })
    await enqueue('logs', 'upsert', logId)
  })
}

export async function deleteLog(logId: string): Promise<void> {
  await db.transaction('rw', db.logs, db.outbox, async () => {
    await db.logs.delete(logId)
    await enqueue('logs', 'delete', logId)
  })
}

/** Legt einen Tag an (dedupliziert nach Label) und gibt ihn zurück. */
export async function addTag(label: string): Promise<Tag | null> {
  const trimmed = label.trim()
  if (trimmed === '') return null
  return db.transaction('rw', db.tags, db.outbox, async () => {
    const all = await db.tags.toArray()
    const existing = all.find((t) => t.label.toLocaleLowerCase() === trimmed.toLocaleLowerCase())
    if (existing) return existing
    const t = nowIso()
    const tag: Tag = { id: crypto.randomUUID(), label: trimmed, created_at: t, updated_at: t }
    await db.tags.add(tag)
    await enqueue('tags', 'upsert', tag.id)
    return tag
  })
}

export async function renameTag(id: string, label: string): Promise<void> {
  await db.transaction('rw', db.tags, db.outbox, async () => {
    await db.tags.update(id, { label: label.trim(), updated_at: nowIso() })
    await enqueue('tags', 'upsert', id)
  })
}

/** Löscht nur den Tag selbst — bestehende Logs behalten das Label. */
export async function deleteTag(id: string): Promise<void> {
  await db.transaction('rw', db.tags, db.outbox, async () => {
    await db.tags.delete(id)
    await enqueue('tags', 'delete', id)
  })
}
