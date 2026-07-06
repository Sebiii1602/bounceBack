import { eachDayOfInterval, endOfMonth, endOfWeek, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { dateKey, todayKey } from '../lib/dates'
import { WEEKDAYS_DE } from '../lib/metrics'

/**
 * Monatsraster in gedeckten Farben — Muster sichtbar machen,
 * ohne Ampel-Logik. Tippen öffnet den Tag zum Nachtragen/Ändern.
 */
export function CalendarGrid({
  month,
  logsByDate,
  onPick,
}: {
  month: Date
  logsByDate: Map<string, boolean>
  onPick: (dateKey: string) => void
}) {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })
  const today = todayKey()

  return (
    <div className="grid grid-cols-7 gap-1.5">
      {WEEKDAYS_DE.map((wd) => (
        <div key={wd} className="pb-1 text-center text-[11px] font-medium text-faint">
          {wd}
        </div>
      ))}
      {days.map((day) => {
        const key = dateKey(day)
        if (!isSameMonth(day, month)) return <div key={key} />
        const state = logsByDate.get(key)
        const future = key > today
        const isToday = key === today

        let cls: string
        if (state === true) cls = 'bg-track-soft font-medium text-track-deep'
        else if (state === false) cls = 'bg-slip-soft font-medium text-slip-deep'
        else if (future) cls = 'text-faint/50'
        else cls = 'border border-line/70 text-soft'

        return (
          <button
            key={key}
            type="button"
            disabled={future}
            onClick={() => onPick(key)}
            className={`flex aspect-square items-center justify-center rounded-lg text-sm transition active:scale-95 ${cls} ${
              isToday ? 'ring-1 ring-track' : ''
            }`}
          >
            {day.getDate()}
          </button>
        )
      })}
    </div>
  )
}
