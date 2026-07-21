import { useLiveQuery } from 'dexie-react-hooks'
import { db, dropEmptyUnratedLog, ensureLogRow, setLogNote, toggleLogTag } from '../lib/db'
import { copy } from '../lib/copy'
import { fmtDayLong } from '../lib/dates'
import { useAutosavedNote } from '../lib/useAutosavedNote'
import type { Habit } from '../lib/types'
import { AutoTextarea } from './AutoTextarea'
import { SectionLabel } from './ui'
import { TagPicker } from './TagPicker'

/**
 * Notizen und Trigger für einen Tag, der noch läuft — der Moment, in dem der
 * Druck da ist, lässt sich festhalten, ohne den Tag schon zu bewerten. Der
 * Eintrag entsteht erst beim ersten Tipper und verschwindet wieder, wenn nichts
 * drinsteht; bewertet wird später derselbe Eintrag, die Notiz bleibt dabei.
 */
export function JournalPanel({ habit, date }: { habit: Habit; date: string }) {
  const log = useLiveQuery(
    async () => (await db.logs.where('[habit_id+date]').equals([habit.id, date]).first()) ?? null,
    [habit.id, date],
  )

  const note = useAutosavedNote(
    log?.note ?? '',
    log !== undefined,
    `${habit.id}:${date}`,
    async (text) => {
      const id = await ensureLogRow(habit.id, date)
      await setLogNote(id, text)
      await dropEmptyUnratedLog(id)
    },
  )

  async function toggle(label: string): Promise<void> {
    const id = await ensureLogRow(habit.id, date)
    await toggleLogTag(id, label)
    await dropEmptyUnratedLog(id)
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-faint">{copy.today.journalTitle(fmtDayLong(date))}</p>
        <p className="mt-1 text-sm text-soft">{copy.today.journalHint}</p>
      </div>
      <div>
        <SectionLabel>{copy.today.journalTriggers}</SectionLabel>
        <TagPicker selected={log?.trigger_tags ?? []} onToggle={(label) => void toggle(label)} />
      </div>
      <AutoTextarea
        value={note.value}
        onChange={(e) => note.setValue(e.target.value)}
        onBlur={note.flush}
        placeholder={copy.today.journalNotePlaceholder}
      />
    </div>
  )
}
