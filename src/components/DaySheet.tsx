import { useEffect } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteLog, setLogSpecial, setLogState, toggleLogPaused } from '../lib/db'
import { copy } from '../lib/copy'
import { fmtDayLong, todayKey } from '../lib/dates'
import type { Habit } from '../lib/types'
import { LogButtons } from './LogButtons'
import { LogDetails } from './LogDetails'
import { JournalPanel } from './JournalPanel'
import { RecordingList } from './RecordingList'

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
  // Ein laufender Tag lässt sich noch nicht bewerten — nur notieren
  const rateable = date < todayKey() || habit.log_same_day || habit.target_per_week !== null
  // Pausieren ergibt nur bei Habits Sinn, die man aktiv tut
  const kannPausieren = habit.log_same_day || habit.target_per_week !== null

  // Hintergrund festhalten, solange das Sheet offen ist: sonst scrollt auf dem
  // iPhone die Seite dahinter mit und man erwischt den Inhalt kaum.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        className="flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl bg-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 px-5 pb-2 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{fmtDayLong(date)}</h2>
            <button type="button" onClick={onClose} className="p-1 text-faint" aria-label="Schließen">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-1"
          style={{ paddingBottom: 'calc(1.25rem + env(safe-area-inset-bottom))' }}
        >
          {rateable ? (
            <>
              {log && !log.rated && (log.trigger_tags.length > 0 || (log.note ?? '') !== '') && (
                <p className="mb-3 rounded-xl bg-paper px-3 py-2 text-xs text-soft">
                  {copy.today.carriedNote(
                    log.note && log.note !== '' ? log.note : log.trigger_tags.join(', '),
                  )}
                </p>
              )}
              <LogButtons
                value={log?.rated && !log.special && !log.paused ? log.on_track : null}
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
              {kannPausieren && (
                <button
                  type="button"
                  onClick={() => void toggleLogPaused(habit.id, date)}
                  className={`mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border py-3 text-[15px] font-medium transition active:scale-[0.98] ${
                    log?.paused
                      ? 'border-rest bg-rest text-white'
                      : 'border-rest/25 bg-rest-soft text-rest-deep'
                  }`}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <rect x="3" y="7" width="18" height="13" rx="2" />
                    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                    <path d="M12 11.5v4M10 13.5h4" />
                  </svg>
                  {copy.today.paused}
                </button>
              )}
              {log?.rated && !log.paused && <LogDetails log={log} onDone={onClose} />}
            </>
          ) : (
            <>
              <p className="mb-3 rounded-xl bg-paper px-3 py-2 text-xs text-soft">
                {copy.history.notRateableYet}
              </p>
              <JournalPanel habit={habit} date={date} />
            </>
          )}
          {habit.audio_notes && (
            <div className="mt-4 border-t border-line pt-3">
              <div className="mb-2 text-xs font-medium uppercase tracking-wider text-faint">
                {copy.audio.section}
              </div>
              <RecordingList habitId={habit.id} date={date} />
            </div>
          )}
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
    </div>
  )
}
