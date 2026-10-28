import { useMemo, useState } from 'react'
import { addMonths } from 'date-fns'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, sortHabits } from '../lib/db'
import { copy } from '../lib/copy'
import { fmtMonth } from '../lib/dates'
import type { LogEntry } from '../lib/types'
import { Card, PageTitle } from '../components/ui'
import { HabitSwitcher } from '../components/HabitSwitcher'
import { CalendarGrid, type DayInfo } from '../components/CalendarGrid'
import { DaySheet } from '../components/DaySheet'
import { WeekProgress } from '../components/WeekProgress'
import { JournalFeed } from '../components/JournalFeed'
import {
  currentStreak,
  goalPerfectWeeks,
  lastSevenDays,
  perfectWeekCount,
  weekGoalProgress,
} from '../lib/metrics'

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${className}`} />
      {label}
    </span>
  )
}

export function History() {
  const habits = useLiveQuery(
    async () => sortHabits(await db.habits.toArray()),
    [],
  )
  const [habitId, setHabitId] = useState<string | null>(null)
  const selected = habits?.find((h) => h.id === habitId) ?? habits?.[0]
  const logs = useLiveQuery(
    () =>
      selected
        ? db.logs.where('habit_id').equals(selected.id).toArray()
        : Promise.resolve<LogEntry[]>([]),
    [selected?.id],
  )
  const [month, setMonth] = useState(() => new Date())
  const [sheetDate, setSheetDate] = useState<string | null>(null)
  const [view, setView] = useState<'kalender' | 'notizen'>('kalender')
  const ziel = selected?.target_per_week ?? null

  const dayInfo = useMemo(() => {
    const m = new Map<string, DayInfo>()
    for (const l of logs ?? []) {
      m.set(l.date, {
        state: !l.rated
          ? 'open'
          : l.paused
            ? 'paused'
            : l.special
              ? 'special'
              : l.on_track
                ? 'on'
                : 'off',
        hasNote: l.note !== null && l.note !== '',
        severity: l.severity ?? undefined,
      })
    }
    return m
  }, [logs])

  if (habits === undefined) return null

  return (
    <div>
      <PageTitle title={copy.tabs.history} />
      <HabitSwitcher habits={habits} value={selected?.id} onChange={setHabitId} />
      <div className="mb-3 flex gap-2">
        {(['kalender', 'notizen'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            className={`flex-1 rounded-full border px-3 py-1.5 text-sm transition ${
              view === key ? 'border-ink bg-ink text-card' : 'border-line bg-card text-soft'
            }`}
          >
            {key === 'kalender' ? copy.history.viewCalendar : copy.history.viewJournal}
          </button>
        ))}
      </div>
      {view === 'notizen' ? (
        <JournalFeed logs={logs ?? []} habit={selected} />
      ) : (
        <>
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="rounded-md p-1.5 text-soft hover:bg-paper"
            aria-label="Voriger Monat"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 6 9 12l5.5 6" />
            </svg>
          </button>
          <span className="text-sm font-medium">{fmtMonth(month)}</span>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="rounded-md p-1.5 text-soft hover:bg-paper"
            aria-label="Nächster Monat"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m9.5 6 5.5 6-5.5 6" />
            </svg>
          </button>
        </div>
        <CalendarGrid month={month} days={dayInfo} onPick={setSheetDate} />
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-soft">
          <LegendDot className="border border-track/30 bg-track-soft" label={copy.history.legendOnTrack} />
          <LegendDot className="border border-slip/30 bg-slip-soft" label={copy.history.legendNot} />
          <LegendDot className="border border-special/30 bg-special-soft" label={copy.history.legendSpecial} />
          <LegendDot className="border border-line bg-card" label={copy.history.legendNone} />
          <LegendDot className="border border-dashed border-faint bg-card" label={copy.history.legendOpen} />
          <LegendDot className="border border-rest/30 bg-rest-soft" label={copy.history.legendPaused} />
          <span className="inline-flex items-center gap-1.5">
            <svg className="h-2.5 w-2.5 text-faint" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z" />
            </svg>
            {copy.history.legendNote}
          </span>
        </div>
      </Card>
      <Card className="mt-3">
        <WeekProgress
          days={lastSevenDays(logs ?? [])}
          headline={
            ziel === null
              ? copy.today.streak(currentStreak(logs ?? []))
              : copy.today.goalProgress(
                  weekGoalProgress(logs ?? [], ziel).done,
                  weekGoalProgress(logs ?? [], ziel).target,
                )
          }
          perfectWeeks={
            ziel === null ? perfectWeekCount(logs ?? []) : goalPerfectWeeks(logs ?? [], ziel)
          }
          goalLabel={
            ziel === null ? copy.today.perfectWeekGoal : copy.today.perfectWeekGoalTarget(ziel)
          }
        />
      </Card>
        </>
      )}
      {sheetDate && selected && (
        <DaySheet habit={selected} date={sheetDate} onClose={() => setSheetDate(null)} />
      )}
    </div>
  )
}
