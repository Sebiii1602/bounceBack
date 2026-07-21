import { eachDayOfInterval, endOfMonth, endOfWeek, isSameMonth, startOfMonth, startOfWeek } from 'date-fns'
import { dateKey, todayKey } from '../lib/dates'
import { WEEKDAYS_DE } from '../lib/metrics'

export interface DayInfo {
  /** `open` = nur notiert, noch nicht bewertet */
  state: 'on' | 'off' | 'special' | 'open'
  hasNote: boolean
  /** Stärke bei „nicht on track“ — färbt den Sand etwas heller/kräftiger */
  severity?: 1 | 2 | 3
}

/**
 * Monatsraster in gedeckten Farben — Muster sichtbar machen,
 * ohne Ampel-Logik. Tippen öffnet den Tag zum Nachtragen/Ändern.
 * Tage mit Notiz tragen ein kleines Bookmark in der Ecke.
 */
export function CalendarGrid({
  month,
  days,
  onPick,
}: {
  month: Date
  days: Map<string, DayInfo>
  onPick: (dateKey: string) => void
}) {
  const cells = eachDayOfInterval({
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
      {cells.map((day) => {
        const key = dateKey(day)
        if (!isSameMonth(day, month)) return <div key={key} />
        const info = days.get(key)
        // Zukunft bleibt zu; heute lässt sich bei Folgetag-Habits zwar nicht
        // bewerten, aber öffnen — dort liegen die Notizen zum laufenden Tag.
        const locked = key > today
        const isToday = key === today

        let cls: string
        if (info?.state === 'on') cls = 'bg-track-soft font-medium text-track-deep'
        else if (info?.state === 'off') {
          const shade =
            info.severity === 1 ? 'bg-slip-soft/60' : info.severity === 3 ? 'bg-slip/40' : 'bg-slip-soft'
          cls = `${shade} font-medium text-slip-deep`
        } else if (info?.state === 'special') cls = 'bg-special-soft font-medium text-special-deep'
        else if (info?.state === 'open') cls = 'border border-dashed border-faint/70 text-soft'
        else if (locked) cls = 'text-faint/50'
        else cls = 'border border-line/70 text-soft'

        return (
          <button
            key={key}
            type="button"
            disabled={locked}
            onClick={() => onPick(key)}
            className={`relative flex aspect-square items-center justify-center rounded-lg text-sm transition active:scale-95 ${cls} ${
              isToday ? 'ring-1 ring-track' : ''
            }`}
          >
            {day.getDate()}
            {info?.hasNote && (
              <svg
                className="absolute right-1 top-1 h-2.5 w-2.5"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-label="Notiz vorhanden"
              >
                <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
              </svg>
            )}
          </button>
        )
      })}
    </div>
  )
}
