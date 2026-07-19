import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteLog, setLogState } from '../lib/db'
import { copy } from '../lib/copy'
import { fmtDayLong } from '../lib/dates'
import type { Habit } from '../lib/types'
import { LogButtons } from './LogButtons'
import { LogDetails } from './LogDetails'

/** Bottom-Sheet zum Nachtragen/Ändern eines beliebigen Tags im Kalender. */
export function DaySheet({
  habit,
  date,
  onClose,
}: {
  habit: Habit
  date: string
  onClose: () => void
}) {
  const log = useLiveQuery(
    () => db.logs.where('[habit_id+date]').equals([habit.id, date]).first(),
    [habit.id, date],
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/25" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-2xl bg-card p-5"
        style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">{fmtDayLong(date)}</h2>
          <button type="button" onClick={onClose} className="p-1 text-faint" aria-label="Schließen">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <LogButtons
          value={log ? log.on_track : null}
          onSelect={(onTrack) => {
            void setLogState(habit.id, date, onTrack)
            // „On track“ braucht keine Details mehr — Sheet direkt zu.
            // Bei „Nicht on track“ bleibt es für die optionalen Trigger offen.
            if (onTrack) onClose()
          }}
        />
        {log && !log.on_track && <LogDetails log={log} onDone={onClose} />}
        {log && (
          <button
            type="button"
            onClick={() => {
              void deleteLog(log.id)
              onClose()
            }}
            className="mt-4 w-full text-center text-sm text-faint underline underline-offset-2"
          >
            {copy.history.removeEntry}
          </button>
        )}
      </div>
    </div>
  )
}
