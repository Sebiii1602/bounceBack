import { useMemo, useState } from 'react'
import { copy } from '../lib/copy'
import { fmtMonthKey, fmtMonthName, monthOf, shiftMonth, thisMonth, todayKey } from '../lib/dates'
import { monthReview, type MonthReview as Review } from '../lib/metrics'
import type { LogEntry } from '../lib/types'
import { Card } from './ui'

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl bg-paper px-3 py-2.5">
      <div className="text-lg font-semibold leading-tight">{value}</div>
      <div className="mt-0.5 text-[11px] leading-tight text-faint">{label}</div>
    </div>
  )
}

/** Ein Satz dazu, wie der Monat im Vergleich zum Vormonat dasteht. */
function urteil(r: Review): string {
  if (r.pct === null) return copy.month.empty(fmtMonthName(r.month))
  if (r.prevPct === null) return copy.month.firstMonth
  const vor = fmtMonthName(shiftMonth(r.month, -1))
  const d = r.pct - r.prevPct
  if (d >= 5) return copy.month.betterMuch(d, vor)
  if (d >= 1) return copy.month.betterBit(d, vor)
  if (d <= -5) return copy.month.worse(Math.abs(d), vor)
  return copy.month.even(vor)
}

function Pfeil({ nach }: { nach: 'links' | 'rechts' }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={nach === 'links' ? 'M14.5 6 9 12l5.5 6' : 'm9.5 6 5.5 6-5.5 6'} />
    </svg>
  )
}

/**
 * Der Monatsrückblick. Alles andere in der App zeigt das Jetzt: rollierende
 * Fenster, die letzten sieben Tage. Ein Monat ist der einzige Zeitraum, der
 * sich überschneidungsfrei mit dem davor vergleichen lässt — erst dadurch
 * sieht man, ob es über die Zeit besser wird, und nicht nur, wie es heute steht.
 */
export function MonthReview({
  logs,
  target,
  showDetails,
}: {
  logs: LogEntry[]
  target: number | null
  showDetails: boolean
}) {
  const [month, setMonth] = useState(thisMonth)
  const erster = useMemo(() => {
    const daten = logs.map((l) => l.date).sort()
    return daten.length > 0 ? monthOf(daten[0]!) : thisMonth()
  }, [logs])
  const r = useMemo(() => monthReview(logs, month, target, todayKey()), [logs, month, target])

  const kannZurueck = month > erster
  const kannVor = month < thisMonth()

  return (
    <Card className="mt-3">
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          disabled={!kannZurueck}
          onClick={() => setMonth((m) => shiftMonth(m, -1))}
          aria-label={copy.month.prev}
          className="rounded-md p-1.5 text-soft transition hover:bg-paper disabled:opacity-25"
        >
          <Pfeil nach="links" />
        </button>
        <div className="text-center">
          <div className="text-sm font-medium">{fmtMonthKey(month)}</div>
          {r.laufend && <div className="text-[11px] text-faint">{copy.month.running}</div>}
        </div>
        <button
          type="button"
          disabled={!kannVor}
          onClick={() => setMonth((m) => shiftMonth(m, 1))}
          aria-label={copy.month.next}
          className="rounded-md p-1.5 text-soft transition hover:bg-paper disabled:opacity-25"
        >
          <Pfeil nach="rechts" />
        </button>
      </div>

      {r.pct === null ? (
        <p className="text-sm text-soft">{copy.month.empty(fmtMonthName(month))}</p>
      ) : (
        <>
          <div className="flex items-end gap-3">
            <div className="text-4xl font-semibold leading-none tracking-tight">{r.pct} %</div>
            <p className="pb-0.5 text-sm leading-snug text-soft">{urteil(r)}</p>
          </div>
          {r.laufend && <p className="mt-1 text-xs text-faint">{copy.month.runningHint(r.tage)}</p>}

          {/* Ziel-Habits kennen weder „nicht on track" (man trägt nur ein, was
              war) noch eine Tagesserie — 3× pro Woche heißt ja gerade, dass
              Lücken dazugehören. Für sie zählen Termine statt Tage. */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {target === null ? (
              <>
                <Stat value={String(r.onTrack)} label={copy.month.statOnTrack} />
                <Stat value={String(r.slips)} label={copy.month.statSlips} />
                <Stat value={copy.month.streakDays(r.bestStreak)} label={copy.month.statStreak} />
              </>
            ) : (
              <Stat value={String(r.onTrack)} label={copy.month.statSessions} />
            )}
            <Stat
              value={String(r.perfectWeeks)}
              label={target === null ? copy.month.statPerfect : copy.month.statGoalWeeks}
            />
            <Stat value={String(r.special)} label={copy.month.statSpecial} />
            <Stat value={String(r.paused)} label={copy.month.statPaused} />
          </div>

          <div className="mt-3 space-y-1 text-xs text-faint">
            {r.momentumStart !== null && r.momentumEnd !== null && (
              <p>{copy.month.momentumMove(r.momentumStart, r.momentumEnd)}</p>
            )}
            {showDetails && (
              <p>{r.topTag ? copy.month.topTag(r.topTag.label, r.topTag.count) : copy.month.noTag}</p>
            )}
          </div>
        </>
      )}
    </Card>
  )
}
