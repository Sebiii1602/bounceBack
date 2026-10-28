import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, sortHabits } from '../lib/db'
import { copy } from '../lib/copy'
import { shiftKey, todayKey, yesterdayKey } from '../lib/dates'
import { MIN_RELAPSES_FOR_PATTERNS } from '../lib/config'
import { mayShowDetails, useRevealed } from '../lib/privacy'
import {
  currentRollingPct,
  goalSeries,
  momentumAsRate,
  momentumChange,
  momentumSeriesFor,
  periodPct,
  previousPeriodPct,
  relapseLogs,
  rollingSeries,
  tagStats,
  weekdayStats,
} from '../lib/metrics'
import type { LogEntry } from '../lib/types'
import { Card, PageTitle, SectionLabel } from '../components/ui'
import { HabitSwitcher } from '../components/HabitSwitcher'
import { TrendChart } from '../components/TrendChart'
import { MomentumChart } from '../components/MomentumChart'
import { MomentumGauge } from '../components/MomentumGauge'
import { MonthReview } from '../components/MonthReview'

const SPANS = [30, 60, 90] as const
type Span = (typeof SPANS)[number]

function PatternsCard({ logs, showDetails }: { logs: LogEntry[]; showDetails: boolean }) {
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
          {/* Trigger-Namen verraten, worum es geht — bei verdecktem Habit bleiben sie zu */}
          {!showDetails ? (
            <p className="text-sm text-soft">{copy.today.hiddenDetails}</p>
          ) : (
            tags.length > 0 && (
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
            )
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

/** Veränderung gegenüber dem gleich langen Zeitraum davor. */
function DeltaChip({ delta, span }: { delta: number | null; span: Span }) {
  if (delta === null) {
    return <span className="text-xs text-faint">{copy.trend.deltaNone(span)}</span>
  }
  const text =
    delta > 0
      ? copy.trend.deltaUp(delta, span)
      : delta < 0
        ? copy.trend.deltaDown(delta, span)
        : copy.trend.deltaFlat(span)
  const ton =
    delta > 0
      ? 'bg-track-soft text-track-deep'
      : delta < 0
        ? 'bg-slip-soft text-slip-deep'
        : 'bg-paper text-soft'
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ton}`}>{text}</span>
}

export function Trends() {
  const habits = useLiveQuery(async () => sortHabits(await db.habits.toArray()), [])
  const [habitId, setHabitId] = useState<string | null>(null)
  const selected = habits?.find((h) => h.id === habitId) ?? habits?.[0]
  const logs = useLiveQuery(
    () =>
      selected
        ? db.logs.where('habit_id').equals(selected.id).toArray()
        : Promise.resolve<LogEntry[]>([]),
    [selected?.id],
  )
  const [span, setSpan] = useState<Span>(30)
  const [momentumInfoOpen, setMomentumInfoOpen] = useState(false)
  const revealed = useRevealed()

  const target = selected?.target_per_week ?? null
  const isGoal = target !== null
  const zeigeDetails = selected ? mayShowDetails(selected, revealed) : true
  // Kurve endet am letzten eintragbaren Tag: heute bei Aktiv-Habits, sonst gestern
  const anchor = selected?.log_same_day || isGoal ? todayKey() : yesterdayKey()

  // Das Fenster folgt dem gewählten Zeitraum: „90 Tage" heißt 90-Tage-Quote,
  // nicht 30-Tage-Quote in einem 90-Tage-Ausschnitt. Dadurch ist der letzte
  // Punkt der Kurve immer genau die grosse Zahl darüber.
  const series = useMemo(
    () =>
      isGoal
        ? goalSeries(logs ?? [], target, span, anchor)
        : rollingSeries(logs ?? [], span, span, anchor),
    [logs, span, anchor, isGoal, target],
  )
  const momentumAll = useMemo(
    () => momentumSeriesFor(logs ?? [], target, anchor),
    [logs, target, anchor],
  )
  const momentumData = useMemo(() => {
    const from = shiftKey(anchor, -(span - 1))
    return momentumAll.filter((p) => p.date >= from)
  }, [momentumAll, span, anchor])

  if (habits === undefined || logs === undefined) return null

  const pct = periodPct(logs, target, span, anchor)
  const vorher = previousPeriodPct(logs, target, span, anchor)
  const delta = pct === null || vorher === null ? null : pct - vorher
  const momentum = momentumAll.length > 0 ? momentumAll[momentumAll.length - 1]!.value : 50
  const momentumWoche = momentumChange(momentumAll, 7)
  const impliziert = momentumAsRate(momentum)
  // Momentum gegen den 30-Tage-Schnitt — bewusst fest, nicht am Umschalter
  // oben: Die Aussage „zieht gerade an" braucht einen stabilen Bezugspunkt.
  const schnitt30 = isGoal ? periodPct(logs, target, 30, anchor) : currentRollingPct(logs, 30, anchor)
  const lage =
    schnitt30 === null
      ? null
      : impliziert - schnitt30 >= 5
        ? copy.trend.momentumAhead
        : schnitt30 - impliziert >= 5
          ? copy.trend.momentumBehind
          : copy.trend.momentumEven

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
          <div className="mb-3 flex gap-1 rounded-full border border-line bg-card p-1">
            {SPANS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setSpan(n)}
                className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  span === n ? 'bg-ink text-card' : 'text-soft'
                }`}
              >
                {copy.trend.spanLabel(n)}
              </button>
            ))}
          </div>

          <Card>
            <div className="flex items-start justify-between">
              <SectionLabel>{copy.trend.momentum}</SectionLabel>
              <button
                type="button"
                aria-label={copy.trend.momentumInfoLabel}
                onClick={() => setMomentumInfoOpen((open) => !open)}
                className={`-mt-1.5 rounded-full p-1 transition ${
                  momentumInfoOpen ? 'text-track-deep' : 'text-faint hover:text-ink'
                }`}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 11v5" />
                  <circle cx="12" cy="7.5" r="0.6" fill="currentColor" stroke="none" />
                </svg>
              </button>
            </div>
            {momentumInfoOpen && (
              <p className="mb-3 rounded-xl bg-paper px-3.5 py-3 text-sm leading-relaxed text-soft">
                {copy.trend.momentumInfo}
              </p>
            )}
            <MomentumGauge value={momentum} change={momentumWoche} />
            <div className="mt-1 text-center">
              <span className="text-xs text-faint">
                {momentumWoche === null
                  ? ''
                  : momentumWoche > 0
                    ? copy.trend.momentumUp(momentumWoche)
                    : momentumWoche < 0
                      ? copy.trend.momentumDown(momentumWoche)
                      : copy.trend.momentumFlat}
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-soft">
              {copy.trend.momentumMeans(impliziert)}
              {lage !== null && <> {lage}</>}
            </p>
            {momentumData.length > 1 && (
              <div className="-ml-2 mt-3">
                <MomentumChart data={momentumData} />
              </div>
            )}
          </Card>

          <Card className="mt-3">
            <div className="text-4xl font-semibold tracking-tight">
              {pct === null ? '–' : `${pct} %`}
            </div>
            <div className="mt-1 text-sm text-soft">
              {isGoal ? copy.trend.headlineGoal(span) : copy.trend.headlinePct(span)}
            </div>
            <div className="mt-2">
              <DeltaChip delta={delta} span={span} />
            </div>
            <div className="-ml-2 mt-3">
              <TrendChart
                data={series}
                tooltipLabel={isGoal ? copy.trend.tooltipGoal : undefined}
                reference={isGoal ? null : vorher}
              />
            </div>
            <p className="mt-1 text-xs text-faint">
              {isGoal ? copy.trend.curveGoal : copy.trend.curveDaily(span)}
              {!isGoal && vorher !== null && <> {copy.trend.previousLine(vorher)}</>}
            </p>
          </Card>

          <MonthReview logs={logs} target={target} showDetails={zeigeDetails} />
          <PatternsCard logs={logs} showDetails={zeigeDetails} />
        </>
      )}
    </div>
  )
}
