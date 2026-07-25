import { copy } from '../lib/copy'
import { mondayOf, shiftKey, todayKey } from '../lib/dates'
import { WEEKDAYS_DE, type WeekDayState } from '../lib/metrics'

/** Farben wie im Kalender — dieselbe Woche soll überall gleich aussehen. */
const CELL: Record<WeekDayState, string> = {
  on: 'bg-track-soft text-track-deep',
  off: 'bg-slip-soft text-slip-deep',
  none: 'border border-line/70 text-faint',
}

/**
 * Die laufende Woche als sieben Kacheln plus der Lebenszeit-Zähler perfekter
 * Wochen. Bewusst ein Sammelstand, kein Streak: Der Zähler kann nur steigen,
 * die Woche startet jeden Montag neu — es gibt nichts zu verlieren, nur etwas
 * zu holen. Ist die Woche schon geplatzt, zeigt sie nach vorn statt zurück.
 */
export function WeekProgress({
  days,
  perfectWeeks,
  className = '',
}: {
  days: WeekDayState[]
  perfectWeeks: number
  className?: string
}) {
  const today = todayKey()
  const monday = mondayOf(today)
  const done = days.filter((d) => d === 'on').length
  const broken = days.includes('off')

  return (
    <div className={className}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium uppercase tracking-wider text-faint">
          {copy.today.weekTitle}
        </span>
        <span className="text-sm font-medium text-soft">
          {broken ? copy.today.weekNext : copy.today.weekProgress(done)}
        </span>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((state, i) => {
          const day = shiftKey(monday, i)
          return (
            <div
              key={day}
              className={`flex aspect-square items-center justify-center rounded-lg text-xs font-medium ${
                CELL[state]
              } ${day === today ? 'ring-1 ring-track' : ''}`}
            >
              {WEEKDAYS_DE[i]}
            </div>
          )
        })}
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
          <p className="text-xs text-faint">{copy.today.perfectWeekGoal}</p>
        )}
      </div>
    </div>
  )
}
