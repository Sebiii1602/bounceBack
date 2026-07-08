import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { copy } from '../lib/copy'
import { todayKey, yesterdayKey } from '../lib/dates'
import { MIN_RELAPSES_FOR_PATTERNS } from '../lib/config'
import {
  currentMomentum,
  currentRollingPct,
  relapseLogs,
  rollingSeries,
  tagStats,
  weekdayStats,
} from '../lib/metrics'
import type { LogEntry } from '../lib/types'
import { Card, PageTitle, SectionLabel } from '../components/ui'
import { HabitSwitcher } from '../components/HabitSwitcher'
import { TrendChart } from '../components/TrendChart'

const SPANS = [30, 60, 90] as const

function PatternsCard({ logs }: { logs: LogEntry[] }) {
  const relapses = relapseLogs(logs)
  const tags = tagStats(logs)
  const weekdays = weekdayStats(logs)
  const maxWeekday = Math.max(...weekdays.map((w) => w.count), 1)

  return (
    <Card className="mt-3">
      <SectionLabel>{copy.trend.patterns}</SectionLabel>
      {relapses.length < MIN_RELAPSES_FOR_PATTERNS ? (
        <p className="text-sm text-soft">{copy.trend.patternsEmpty}</p>
      ) : (
        <div className="space-y-4">
          {tags.length > 0 && (
            <div>
              <p className="mb-2 text-xs text-faint">{copy.trend.patternTags}</p>
              <div className="space-y-2">
                {tags.slice(0, 6).map((t) => (
                  <div key={t.label} className="flex items-center gap-2 text-sm">
                    <span className="w-24 truncate text-soft">{t.label}</span>
                    <div className="h-2 flex-1 rounded-full bg-line/60">
                      <div
                        className="h-2 rounded-full bg-slip"
                        style={{ width: `${Math.round(t.share * 100)}%` }}
                      />
                    </div>
                    <span className="w-14 shrink-0 text-right text-xs text-faint">
                      {copy.trend.ofTotal(t.count, relapses.length)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <p className="mb-2 text-xs text-faint">{copy.trend.patternWeekdays}</p>
            <div className="flex items-end gap-1.5">
              {weekdays.map((w) => (
                <div key={w.weekday} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-12 w-full items-end">
                    <div
                      className="w-full rounded-md bg-slip"
                      style={{
                        height: `${Math.max((w.count / maxWeekday) * 100, w.count > 0 ? 10 : 4)}%`,
                        opacity: w.count > 0 ? 0.85 : 0.2,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-faint">{w.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  )
}

export function Trends() {
  const habits = useLiveQuery(
    async () => (await db.habits.toArray()).sort((a, b) => a.created_at.localeCompare(b.created_at)),
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
  const [span, setSpan] = useState<(typeof SPANS)[number]>(30)
  // Kurve endet am letzten eintragbaren Tag: heute bei Aktiv-Habits, sonst gestern
  const anchor = selected?.log_same_day ? todayKey() : yesterdayKey()
  const series = useMemo(() => rollingSeries(logs ?? [], span, 30, anchor), [logs, span, anchor])

  if (habits === undefined || logs === undefined) return null

  const pct = currentRollingPct(logs, 30, anchor)
  const momentum = currentMomentum(logs, anchor)

  return (
    <div>
      <PageTitle title={copy.tabs.trend} />
      <HabitSwitcher habits={habits} value={selected?.id} onChange={setHabitId} />
      {logs.length === 0 ? (
        <Card>
          <p className="text-sm text-soft">{copy.trend.noData}</p>
        </Card>
      ) : (
        <>
          <Card>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-4xl font-semibold tracking-tight">
                  {pct === null ? '–' : `${pct} %`}
                </div>
                <div className="mt-1 text-sm text-soft">{copy.trend.headlinePct}</div>
              </div>
              <div className="flex gap-0.5 rounded-full border border-line p-0.5">
                {SPANS.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setSpan(n)}
                    className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                      span === n ? 'bg-ink text-card' : 'text-soft'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="-ml-2 mt-4">
              <TrendChart data={series} />
            </div>
          </Card>
          <Card className="mt-3">
            <SectionLabel>{copy.trend.momentum}</SectionLabel>
            <div className="flex items-center gap-3">
              <span className="w-12 text-2xl font-semibold">{momentum}</span>
              <div className="h-2 flex-1 rounded-full bg-line/60">
                <div
                  className="h-2 rounded-full bg-track transition-all"
                  style={{ width: `${momentum}%` }}
                />
              </div>
            </div>
            <p className="mt-2 text-xs text-faint">{copy.trend.momentumHint}</p>
          </Card>
          <PatternsCard logs={logs} />
        </>
      )}
    </div>
  )
}
