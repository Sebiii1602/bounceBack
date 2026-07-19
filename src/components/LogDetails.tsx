import { useEffect, useState } from 'react'
import { setLogNote, toggleLogTag } from '../lib/db'
import { copy } from '../lib/copy'
import type { LogEntry } from '../lib/types'
import { SectionLabel } from './ui'
import { TagPicker } from './TagPicker'

/** Optionaler Teil des Log-Flows: Trigger-Chips + Notiz — jederzeit überspringbar. */
export function LogDetails({ log, onDone }: { log: LogEntry; onDone?: () => void }) {
  const [note, setNote] = useState(log.note ?? '')

  useEffect(() => {
    setNote(log.note ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [log.id])

  function saveNote() {
    if ((log.note ?? '') !== note) void setLogNote(log.id, note)
  }

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <div>
        <SectionLabel>{copy.today.triggers}</SectionLabel>
        <TagPicker selected={log.trigger_tags} onToggle={(label) => void toggleLogTag(log.id, label)} />
      </div>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={saveNote}
        placeholder={copy.today.notePlaceholder}
        rows={3}
        className="w-full resize-none rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-track"
      />
      {onDone && (
        <button
          type="button"
          onClick={() => {
            saveNote()
            onDone()
          }}
          className="w-full rounded-xl bg-ink py-2.5 text-sm font-medium text-card"
        >
          {copy.today.done}
        </button>
      )}
    </div>
  )
}
