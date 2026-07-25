import { copy } from '../lib/copy'
import { mondayOf, shiftKey, todayKey } from '../lib/dates'
import { WEEKDAYS_DE, type WeekDayState } from '../lib/metrics'

const DOT: Record<WeekDayState, string> = {
  on: 'bg-track',
  off: 'bg-slip/50',
  none: 'border border-line',
}

/**
 * Die laufende Woche als sieben Punkte plus der Lebenszeit-Zähler perfekter
 * Wochen. Bewusst ein Sammelstand, kein Streak: Der Zähler kann nur steigen,
 * die Punkte starten jeden Montag neu — es gibt nichts zu verlieren, nur
 * etwas zu holen.
 */
export function WeekStrip({ days, perfectWeeks }: { days: WeekDayState[]; perfectWeeks: number }) {
  const today = todayKey()
  const monday = mondayOf(today)

  return (
    <div className="mt-2 flex items-center justify-between gap-3">
      <div className="flex gap-1.5" aria-label={copy.today.weekAria}>
        {days.map((state, i) => {
          const day = shiftKey(monday, i)
          return (
            <span
              key={day}
              title={WEEKDAYS_DE[i]}
              className={`h-2.5 w-2.5 rounded-full ${DOT[state]} ${
                day === today ? 'ring-1 ring-faint ring-offset-1 ring-offset-card' : ''
              }`}
            />
          )
        })}
      </div>
      <span className="shrink-0 text-xs text-faint">
        {perfectWeeks > 0 ? copy.today.perfectWeeks(perfectWeeks) : copy.today.perfectWeekGoal}
      </span>
    </div>
  )
}
