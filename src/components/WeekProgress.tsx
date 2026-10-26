import { copy } from '../lib/copy'
import { fmtWeekdayShort, todayKey } from '../lib/dates'
import type { DayState, WeekDayState } from '../lib/metrics'

/** Farben wie im Kalender — derselbe Tag soll überall gleich aussehen. */
const CELL: Record<WeekDayState, string> = {
  on: 'bg-track-soft text-track-deep',
  off: 'bg-slip-soft text-slip-deep',
  paused: 'bg-rest-soft text-rest-deep',
  none: 'border border-line/70 text-faint',
}

/**
 * Die letzten sieben Tage als Kacheln, dazu die laufende Serie und der
 * Lebenszeit-Zähler perfekter Wochen.
 *
 * Bewusst ein Sammelstand, kein Streak: Der Zähler kann nur steigen, ein
 * schlechter Tag beendet nur die laufende Serie — es gibt nichts zu verlieren,
 * nur etwas zu holen.
 */
export function WeekProgress({
  days,
  headline,
  perfectWeeks,
  goalLabel,
  className = '',
}: {
  days: DayState[]
  /** Rechts oben: laufende Serie oder Wochenstand bei Ziel-Habits */
  headline: string
  perfectWeeks: number
  /** Erklärt bei null perfekten Wochen, was eine ausmacht */
  goalLabel: string
  className?: string
}) {
  const today = todayKey()

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-faint">
          {copy.today.weekTitle}
        </span>
        <span className="text-sm font-medium text-soft">{headline}</span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map(({ date, state }) => (
          <div
            key={date}
            className={`flex aspect-square items-center justify-center rounded-lg text-xs font-medium ${
              CELL[state]
            } ${date === today ? 'ring-1 ring-track' : ''}`}
          >
            {fmtWeekdayShort(date)}
          </div>
        ))}
      </div>
      <div className="mt-3">
        {perfectWeeks > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-track-soft px-3 py-1.5 text-sm font-medium text-track-deep">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m5 12.5 4.5 4.5L19 7" />
            </svg>
            {copy.today.perfectWeeks(perfectWeeks)}
          </span>
        ) : (
          <p className="text-xs text-faint">{goalLabel}</p>
        )}
      </div>
    </div>
  )
}
