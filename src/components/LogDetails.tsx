import { setLogNote, setLogSeverity, toggleLogTag } from '../lib/db'
import { copy } from '../lib/copy'
import { useAutosavedNote } from '../lib/useAutosavedNote'
import type { LogEntry, Severity } from '../lib/types'
import { SectionLabel } from './ui'
import { AutoTextarea } from './AutoTextarea'
import { TagPicker } from './TagPicker'

const SEVERITIES: readonly Severity[] = [1, 2, 3]

/** Optionaler Teil des Log-Flows: Trigger-Chips + Notiz — jederzeit überspringbar. */
export function LogDetails({ log, onDone }: { log: LogEntry; onDone?: () => void }) {
  const note = useAutosavedNote(log.note ?? '', true, log.id, (text) => setLogNote(log.id, text))

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      {!log.on_track && !log.special && (
        <div>
          <SectionLabel>{copy.today.severityTitle}</SectionLabel>
          <div className="flex gap-2">
            {SEVERITIES.map((level) => {
              const active = (log.severity ?? 2) === level
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => void setLogSeverity(log.id, level)}
                  className={`flex-1 rounded-full border px-3 py-1.5 text-sm transition ${
                    active ? 'border-slip bg-slip text-white' : 'border-line bg-card text-soft'
                  }`}
                >
                  {copy.today.severity[level]}
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div>
        <SectionLabel>{copy.today.triggers}</SectionLabel>
        <TagPicker selected={log.trigger_tags} onToggle={(label) => void toggleLogTag(log.id, label)} />
      </div>
      <AutoTextarea
        value={note.value}
        onChange={(e) => note.setValue(e.target.value)}
        onBlur={note.flush}
        placeholder={copy.today.notePlaceholder}
      />
      {onDone && (
        <button
          type="button"
          onClick={() => {
            note.flush()
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
