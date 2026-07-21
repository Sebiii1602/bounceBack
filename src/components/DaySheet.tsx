import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteLog, setLogSpecial, setLogState } from '../lib/db'
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-5"
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
          value={log && !log.special ? log.on_track : null}
          onSelect={(onTrack) => {
            void setLogState(habit.id, date, onTrack)
            // „On track“ braucht keine Details mehr — Sheet direkt zu.
            // Bei „Nicht on track“ bleibt es für die optionalen Trigger offen.
            if (onTrack) onClose()
          }}
        />
        <button
          type="button"
          onClick={() => void setLogSpecial(habit.id, date)}
          className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-[15px] font-medium transition active:scale-[0.98] ${
            log?.special
              ? 'border-special bg-special text-white'
              : 'border-special/25 bg-special-soft text-special-deep'
          }`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" />
          </svg>
          {copy.today.specialDay}
        </button>
        {log && <LogDetails log={log} onDone={onClose} />}
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
