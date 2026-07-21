import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_TAGS, RETIRED_DEFAULT_TAGS } from './config'
import { nowIso } from './dates'
import type { Habit, LogEntry, MetaRow, OutboxRow, Severity, SyncTable, Tag } from './types'

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

// v2: habits.log_same_day (kein neuer Index nötig, nur Backfill für Bestandsdaten)
db.version(2)
  .stores({
    habits: 'id, updated_at',
    logs: 'id, [habit_id+date], habit_id, updated_at',
    tags: 'id, label, updated_at',
    outbox: '++seq, row_id',
    meta: 'key',
  })
  .upgrade((tx) =>
    tx
      .table('habits')
      .toCollection()
      .modify((h) => {
        if (h.log_same_day === undefined) h.log_same_day = false
      }),
  )

/** Frisch vergebene IDs pro Zeile (nie feste UUIDs — siehe config.ts). */
function buildDefaultTagRows(): Tag[] {
  const t = nowIso()
  return DEFAULT_TAGS.map((label) => ({ id: crypto.randomUUID(), label, created_at: t, updated_at: t }))
}

/**
 * Anzeige-Reihenfolge der Trigger: Start-Trigger in der Reihenfolge aus
 * config.ts, eigene danach nach Anlagedatum. Ohne das stehen die Chips zufällig
 * durcheinander — alle Start-Trigger tragen denselben Zeitstempel.
 */
export function sortTags(tags: Tag[]): Tag[] {
  const rank = (t: Tag): number => {
    const i = DEFAULT_TAGS.indexOf(t.label)
    return i === -1 ? DEFAULT_TAGS.length : i
  }
  return [...tags].sort((a, b) => rank(a) - rank(b) || a.created_at.localeCompare(b.created_at))
}

/** Sät die Start-Trigger neu — z. B. nachdem `clearLocalData()` das Gerät geleert hat. */
export async function seedDefaultTags(): Promise<void> {
  await db.tags.bulkAdd(buildDefaultTagRows())
}

// v3: logs.special (Special Days — markiert statt bewertet)
db.version(3)
  .stores({
    habits: 'id, updated_at',
    logs: 'id, [habit_id+date], habit_id, updated_at',
    tags: 'id, label, updated_at',
    outbox: '++seq, row_id',
    meta: 'key',
  })
  .upgrade((tx) =>
    tx
      .table('logs')
      .toCollection()
      .modify((l) => {
        if (l.special === undefined) l.special = false
      }),
  )

// v4: logs.rated (Notiz vor der Bewertung) + aufgefrischte Start-Trigger
db.version(4)
  .stores({
    habits: 'id, updated_at',
    logs: 'id, [habit_id+date], habit_id, updated_at',
    tags: 'id, label, updated_at',
    outbox: '++seq, row_id',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    // Alles, was es bisher gibt, ist bewertet
    await tx
      .table('logs')
      .toCollection()
      .modify((l) => {
        if (l.rated === undefined) l.rated = true
      })

    const t = nowIso()
    const tags = (await tx.table('tags').toArray()) as Tag[]
    const known = new Set(tags.map((x) => x.label))
    for (const label of DEFAULT_TAGS) {
      if (known.has(label)) continue
      const id = crypto.randomUUID()
      await tx.table('tags').add({ id, label, created_at: t, updated_at: t })
      await tx.table('outbox').add({ table: 'tags', op: 'upsert', row_id: id })
    }

    // Zu spezielle Start-Trigger wieder abräumen — aber nur, wenn sie in
    // keinem Eintrag stecken: was jemand benutzt hat, bleibt seins.
    const logs = (await tx.table('logs').toArray()) as LogEntry[]
    const inUse = new Set(logs.flatMap((l) => l.trigger_tags))
    for (const tag of tags) {
      if (!RETIRED_DEFAULT_TAGS.includes(tag.label) || inUse.has(tag.label)) continue
      await tx.table('tags').delete(tag.id)
      await tx.table('outbox').add({ table: 'tags', op: 'delete', row_id: tag.id })
    }
  })

db.on('populate', (tx) => {
  void tx.table('tags').bulkAdd(buildDefaultTagRows())
})

/**
 * Löscht alle lokalen Daten (z. B. beim Abmelden) und sät die Start-Trigger
 * neu, damit das Gerät für den nächsten Account/Login sauber dasteht.
 */
export async function clearLocalData(): Promise<void> {
  await db.transaction('rw', db.habits, db.logs, db.tags, db.outbox, db.meta, async () => {
    await db.habits.clear()
    await db.logs.clear()
    await db.tags.clear()
    await db.outbox.clear()
    await db.meta.clear()
    await seedDefaultTags()
  })
}

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

export async function addHabit(name: string, logSameDay = false): Promise<string> {
  const id = crypto.randomUUID()
  const t = nowIso()
  await db.transaction('rw', db.habits, db.outbox, async () => {
    await db.habits.add({ id, name: name.trim(), log_same_day: logSameDay, created_at: t, updated_at: t })
    await enqueue('habits', 'upsert', id)
  })
  return id
}

export async function setHabitLogMode(id: string, logSameDay: boolean): Promise<void> {
  await db.transaction('rw', db.habits, db.outbox, async () => {
    await db.habits.update(id, { log_same_day: logSameDay, updated_at: nowIso() })
    await enqueue('habits', 'upsert', id)
  })
}

export async function renameHabit(id: string, name: string): Promise<void> {
  await db.transaction('rw', db.habits, db.outbox, async () => {
    await db.habits.update(id, { name: name.trim(), updated_at: nowIso() })
    await enqueue('habits', 'upsert', id)
  })
}

/**
 * Bewertet (Habit, Tag) — legt den Log an oder aktualisiert ihn.
 * Nimmt einem Special Day die Markierung, aber Notiz und Trigger bleiben:
 * was du notiert hast, bleibt — nur die Farbe wechselt.
 */
export async function setLogState(habitId: string, date: string, onTrack: boolean): Promise<void> {
  await db.transaction('rw', db.logs, db.outbox, async () => {
    const existing = await db.logs.where('[habit_id+date]').equals([habitId, date]).first()
    const t = nowIso()
    if (existing) {
      // Ein vorher nur notierter Tag (Urge) wird hier zum bewerteten Tag —
      // Notiz und Trigger von damals bleiben dabei erhalten.
      await db.logs.update(existing.id, { rated: true, on_track: onTrack, special: false, updated_at: t })
      await enqueue('logs', 'upsert', existing.id)
    } else {
      const id = crypto.randomUUID()
      await db.logs.add({
        id,
        habit_id: habitId,
        date,
        rated: true,
        on_track: onTrack,
        special: false,
        severity: null,
        trigger_tags: [],
        note: null,
        created_at: t,
        updated_at: t,
      })
      await enqueue('logs', 'upsert', id)
    }
  })
}

/** Bewertet die Stärke eines „Nicht on track“-Tags (wirkt nur aufs Momentum). */
export async function setLogSeverity(logId: string, severity: Severity): Promise<void> {
  await db.transaction('rw', db.logs, db.outbox, async () => {
    await db.logs.update(logId, { severity, updated_at: nowIso() })
    await enqueue('logs', 'upsert', logId)
  })
}

/**
 * Markiert (Habit, Tag) als Special Day — ein Highlight-Tag, der ganz normal
 * als on track zählt und nur zusätzlich blau hervorgehoben wird.
 */
export async function setLogSpecial(habitId: string, date: string): Promise<void> {
  await db.transaction('rw', db.logs, db.outbox, async () => {
    const existing = await db.logs.where('[habit_id+date]').equals([habitId, date]).first()
    const t = nowIso()
    if (existing) {
      await db.logs.update(existing.id, { rated: true, on_track: true, special: true, updated_at: t })
      await enqueue('logs', 'upsert', existing.id)
    } else {
      const id = crypto.randomUUID()
      await db.logs.add({
        id,
        habit_id: habitId,
        date,
        rated: true,
        on_track: true,
        special: true,
        severity: null,
        trigger_tags: [],
        note: null,
        created_at: t,
        updated_at: t,
      })
      await enqueue('logs', 'upsert', id)
    }
  })
}

/**
 * Gibt den Eintrag für (Habit, Tag) zurück und legt ihn bei Bedarf **unbewertet**
 * an: für Notizen und Trigger am laufenden Tag („gerade Druck“), lange bevor
 * feststeht, wie der Tag ausgeht. Zählt in keiner Metrik mit — sobald der Tag
 * vorbei ist und bewertet wird, ist alles Notierte schon da.
 */
export async function ensureLogRow(habitId: string, date: string): Promise<string> {
  return db.transaction('rw', db.logs, db.outbox, async () => {
    const existing = await db.logs.where('[habit_id+date]').equals([habitId, date]).first()
    if (existing) return existing.id
    const id = crypto.randomUUID()
    const t = nowIso()
    await db.logs.add({
      id,
      habit_id: habitId,
      date,
      rated: false,
      on_track: false,
      special: false,
      severity: null,
      trigger_tags: [],
      note: null,
      created_at: t,
      updated_at: t,
    })
    await enqueue('logs', 'upsert', id)
    return id
  })
}

/**
 * Räumt einen nur notierten Tag wieder weg, sobald nichts mehr drinsteht —
 * ein leerer Platzhalter soll nicht als Notiz-Bookmark im Kalender stehen.
 */
export async function dropEmptyUnratedLog(logId: string): Promise<void> {
  await db.transaction('rw', db.logs, db.outbox, async () => {
    const log = await db.logs.get(logId)
    if (!log || log.rated) return
    if (log.trigger_tags.length > 0 || (log.note ?? '') !== '') return
    await db.logs.delete(logId)
    await enqueue('logs', 'delete', logId)
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
