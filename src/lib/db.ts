import Dexie, { type EntityTable } from 'dexie'
import { DEFAULT_TAGS, RETIRED_DEFAULT_TAGS } from './config'
import { nowIso, shiftKey } from './dates'
import type {
  Habit,
  LogEntry,
  MetaRow,
  OutboxRow,
  PromptDeck,
  Severity,
  SyncTable,
  Tag,
} from './types'

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

/** Anzeige-Reihenfolge der Habits: selbst gewählt, sonst nach Anlagedatum. */
export function sortHabits(habits: Habit[]): Habit[] {
  return [...habits].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.created_at.localeCompare(b.created_at),
  )
}

/** Schiebt einen Habit in der Liste um eine Position nach oben oder unten. */
export async function moveHabit(id: string, richtung: -1 | 1): Promise<void> {
  await db.transaction('rw', db.habits, db.outbox, async () => {
    const sortiert = sortHabits(await db.habits.toArray())
    const i = sortiert.findIndex((h) => h.id === id)
    const j = i + richtung
    if (i === -1 || j < 0 || j >= sortiert.length) return
    const t = nowIso()
    // Beide Nachbarn neu nummerieren, damit die Reihenfolge lückenlos bleibt
    await db.habits.update(sortiert[i]!.id, { sort_order: j, updated_at: t })
    await db.habits.update(sortiert[j]!.id, { sort_order: i, updated_at: t })
    await enqueue('habits', 'upsert', sortiert[i]!.id)
    await enqueue('habits', 'upsert', sortiert[j]!.id)
  })
}

/** Deckname setzen (macht den Habit privat) oder mit null wieder aufdecken. */
export async function setHabitAlias(id: string, alias: string | null): Promise<void> {
  const sauber = alias?.trim()
  await db.transaction('rw', db.habits, db.outbox, async () => {
    await db.habits.update(id, {
      private_alias: sauber === undefined || sauber === '' ? null : sauber,
      updated_at: nowIso(),
    })
    await enqueue('habits', 'upsert', id)
  })
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

// v5: logs.paused (verletzt/krank) + habits.target_per_week / prompt_deck
db.version(5)
  .stores({
    habits: 'id, updated_at',
    logs: 'id, [habit_id+date], habit_id, updated_at',
    tags: 'id, label, updated_at',
    outbox: '++seq, row_id',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    await tx
      .table('logs')
      .toCollection()
      .modify((l) => {
        if (l.paused === undefined) l.paused = false
      })
    await tx
      .table('habits')
      .toCollection()
      .modify((h) => {
        if (h.target_per_week === undefined) h.target_per_week = null
        if (h.prompt_deck === undefined) h.prompt_deck = null
      })
  })

// v6: habits.private_alias (Diskret-Modus) + habits.sort_order
db.version(6)
  .stores({
    habits: 'id, updated_at',
    logs: 'id, [habit_id+date], habit_id, updated_at',
    tags: 'id, label, updated_at',
    outbox: '++seq, row_id',
    meta: 'key',
  })
  .upgrade(async (tx) => {
    const habits = (await tx.table('habits').toArray()) as Habit[]
    const reihenfolge = [...habits].sort((a, b) => a.created_at.localeCompare(b.created_at))
    for (let i = 0; i < reihenfolge.length; i++) {
      await tx.table('habits').update(reihenfolge[i]!.id, {
        private_alias: reihenfolge[i]!.private_alias ?? null,
        sort_order: i,
      })
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

export async function addHabit(
  name: string,
  logSameDay = false,
  targetPerWeek: number | null = null,
  promptDeck: PromptDeck | null = null,
): Promise<string> {
  const id = crypto.randomUUID()
  const t = nowIso()
  await db.transaction('rw', db.habits, db.outbox, async () => {
    await db.habits.add({
      id,
      name: name.trim(),
      log_same_day: logSameDay,
      target_per_week: targetPerWeek,
      prompt_deck: promptDeck,
      private_alias: null,
      sort_order: await db.habits.count(),
      created_at: t,
      updated_at: t,
    })
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

/** Wochenziel setzen (`n`-mal pro Woche) oder mit null zurück auf täglich. */
export async function setHabitTarget(id: string, targetPerWeek: number | null): Promise<void> {
  await db.transaction('rw', db.habits, db.outbox, async () => {
    await db.habits.update(id, { target_per_week: targetPerWeek, updated_at: nowIso() })
    await enqueue('habits', 'upsert', id)
  })
}

/** Tagesimpuls an- oder abschalten. */
export async function setHabitPromptDeck(id: string, deck: PromptDeck | null): Promise<void> {
  await db.transaction('rw', db.habits, db.outbox, async () => {
    await db.habits.update(id, { prompt_deck: deck, updated_at: nowIso() })
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
      await db.logs.update(existing.id, {
        rated: true,
        on_track: onTrack,
        special: false,
        paused: false,
        updated_at: t,
      })
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
        paused: false,
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
      await db.logs.update(existing.id, {
        rated: true,
        on_track: true,
        special: true,
        paused: false,
        updated_at: t,
      })
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
        paused: false,
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
      paused: false,
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

/**
 * Markiert (Habit, Tag) als Pause — verletzt, krank, konnte schlicht nicht.
 * Erneutes Antippen nimmt die Markierung wieder weg und lässt den Tag leer.
 */
export async function toggleLogPaused(habitId: string, date: string): Promise<void> {
  await db.transaction('rw', db.logs, db.outbox, async () => {
    const existing = await db.logs.where('[habit_id+date]').equals([habitId, date]).first()
    const t = nowIso()
    if (existing?.paused) {
      // Zurücknehmen: Notiz und Trigger behalten, sonst ganz weg
      if (existing.trigger_tags.length > 0 || (existing.note ?? '') !== '') {
        await db.logs.update(existing.id, { paused: false, rated: false, updated_at: t })
        await enqueue('logs', 'upsert', existing.id)
      } else {
        await db.logs.delete(existing.id)
        await enqueue('logs', 'delete', existing.id)
      }
      return
    }
    if (existing) {
      await db.logs.update(existing.id, {
        rated: true,
        paused: true,
        on_track: false,
        special: false,
        updated_at: t,
      })
      await enqueue('logs', 'upsert', existing.id)
    } else {
      const id = crypto.randomUUID()
      await db.logs.add({
        id,
        habit_id: habitId,
        date,
        rated: true,
        on_track: false,
        special: false,
        paused: true,
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
 * Pausiert einen ganzen Zeitraum am Stück — sechs Wochen verletzt soll man
 * einmal eintragen und dann Ruhe haben, nicht jeden Morgen erneut antippen.
 * Trägt auch in die Zukunft ein; die Metriken rechnen ohnehin nur bis heute.
 * Vorhandene Bewertungen in dem Zeitraum bleiben unangetastet.
 */
export async function pauseRange(habitId: string, from: string, to: string): Promise<void> {
  await db.transaction('rw', db.logs, db.outbox, async () => {
    const t = nowIso()
    for (let d = from; d <= to; d = shiftKey(d, 1)) {
      const existing = await db.logs.where('[habit_id+date]').equals([habitId, d]).first()
      if (existing?.rated && !existing.paused) continue // bereits bewertet: nicht überschreiben
      if (existing) {
        await db.logs.update(existing.id, {
          rated: true,
          paused: true,
          on_track: false,
          special: false,
          updated_at: t,
        })
        await enqueue('logs', 'upsert', existing.id)
      } else {
        const id = crypto.randomUUID()
        await db.logs.add({
          id,
          habit_id: habitId,
          date: d,
          rated: true,
          on_track: false,
          special: false,
          paused: true,
          severity: null,
          trigger_tags: [],
          note: null,
          created_at: t,
          updated_at: t,
        })
        await enqueue('logs', 'upsert', id)
      }
    }
  })
}

/**
 * Beendet eine laufende Pause ab `from`: löscht die Pausentage von dort an,
 * behält die davor. Wer früher wieder fit ist, soll nicht 40 Tage einzeln
 * aufräumen müssen — die dokumentierte Vergangenheit bleibt aber stehen.
 */
export async function endPause(habitId: string, from: string): Promise<void> {
  await db.transaction('rw', db.logs, db.outbox, async () => {
    const alle = await db.logs.where('habit_id').equals(habitId).toArray()
    for (const log of alle) {
      if (!log.paused || log.date < from) continue
      if (log.trigger_tags.length > 0 || (log.note ?? '') !== '') {
        // Notiz behalten, nur die Pausen-Markierung nehmen
        await db.logs.update(log.id, { paused: false, rated: false, updated_at: nowIso() })
        await enqueue('logs', 'upsert', log.id)
      } else {
        await db.logs.delete(log.id)
        await enqueue('logs', 'delete', log.id)
      }
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
