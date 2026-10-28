import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, endPause, pauseRange, setLogState } from '../lib/db'
import { copy } from '../lib/copy'
import { fmtDayLong, fmtDayShort, shiftKey, todayKey, yesterdayKey } from '../lib/dates'
import {
  currentGoalMomentum,
  currentGoalPct,
  currentMomentum,
  currentRollingPct,
  currentStreak,
  goalPerfectWeeks,
  lastSevenDays,
  pausedUntil,
  perfectWeekCount,
  weekGoalProgress,
} from '../lib/metrics'
import type { Habit } from '../lib/types'
import { Card } from './ui'
import { LogButtons } from './LogButtons'
import { LogDetails } from './LogDetails'
import { JournalPanel } from './JournalPanel'
import { WeekProgress } from './WeekProgress'
import { DailyPrompt, promptWasRead } from './DailyPrompt'
import { displayName, mayShowDetails, useRevealed } from '../lib/privacy'

const MedKitIcon = (
  <>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    <path d="M12 11.5v4M10 13.5h4" />
  </>
)

/**
 * Wie lange pausiert? Sechs Wochen Verletzung soll man einmal eintragen —
 * nicht jeden Morgen erneut. „Bis Datum" nutzt den nativen Datumsdialog.
 */
function PausePicker({ onPick }: { onPick: (bis: string) => void }) {
  const today = todayKey()
  return (
    <div className="mt-2 rounded-xl bg-paper p-3">
      <p className="mb-2 text-xs text-faint">{copy.today.pauseFor}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onPick(today)}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-sm text-soft"
        >
          {copy.today.pauseToday}
        </button>
        {[1, 2, 4, 6].map((wochen) => (
          <button
            key={wochen}
            type="button"
            onClick={() => onPick(shiftKey(today, wochen * 7 - 1))}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-sm text-soft"
          >
            {copy.today.pauseWeeks(wochen)}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-faint">
        {copy.today.pauseUntilDate}
        <input
          type="date"
          min={today}
          onChange={(e) => {
            if (e.target.value) onPick(e.target.value)
          }}
          className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>
    </div>
  )
}

export function HabitLogCard({ habit }: { habit: Habit }) {
  const target = habit.target_per_week
  const isGoal = target !== null
  // Ziel-Habits trägt man ein, wenn es passiert ist — also immer am selben Tag
  const sameDay = habit.log_same_day || isGoal
  const day = sameDay ? todayKey() : yesterdayKey()
  const today = todayKey()
  const log = useLiveQuery(
    () => db.logs.where('[habit_id+date]').equals([habit.id, day]).first(),
    [habit.id, day],
  )
  const todayLog = useLiveQuery(
    () => (sameDay ? undefined : db.logs.where('[habit_id+date]').equals([habit.id, today]).first()),
    [habit.id, today, sameDay],
  )
  const logs = useLiveQuery(() => db.logs.where('habit_id').equals(habit.id).toArray(), [habit.id])
  const [editing, setEditing] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [tab, setTab] = useState<'rate' | 'journal'>('rate')
  const [promptRead, setPromptRead] = useState(() =>
    habit.prompt_deck ? promptWasRead(habit.id, day) : true,
  )
  const [pausePanel, setPausePanel] = useState(false)
  const revealed = useRevealed()
  const zeigeDetails = mayShowDetails(habit, revealed)

  const alle = logs ?? []
  const pct = isGoal
    ? currentGoalPct(alle, target, day)
    : logs
      ? currentRollingPct(alle, 30, day)
      : null
  const momentum = isGoal ? currentGoalMomentum(alle, target, day) : currentMomentum(alle, day)
  const week = lastSevenDays(alle, today)
  const perfect = isGoal ? goalPerfectWeeks(alle, target) : perfectWeekCount(alle)
  const wochenstand = isGoal ? weekGoalProgress(alle, target, today) : null
  const hasJournal = !!todayLog && (todayLog.trigger_tags.length > 0 || (todayLog.note ?? '') !== '')
  const carried =
    zeigeDetails && log && !log.rated && (log.trigger_tags.length > 0 || (log.note ?? '') !== '')
  const pauseBis = pausedUntil(alle, today)
  // Tagesimpuls nicht gelesen → erst lesen, dann abhaken
  const gesperrt = habit.prompt_deck !== null && !promptRead

  function choose(onTrack: boolean) {
    void setLogState(habit.id, day, onTrack)
    setEditing(false)
    setPanelOpen(!onTrack)
  }

  const headline = wochenstand
    ? wochenstand.done >= wochenstand.target
      ? copy.today.goalReached(wochenstand.target)
      : copy.today.goalProgress(wochenstand.done, wochenstand.target)
    : copy.today.streak(currentStreak(alle, today))

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{displayName(habit, revealed)}</h2>
        <span className="shrink-0 text-xs text-faint">
          {isGoal
            ? copy.today.goalStat(pct === null ? '–' : `${pct} %`, momentum)
            : copy.today.statLine(pct === null ? '–' : `${pct} %`, momentum)}
        </span>
      </div>
      {sameDay ? (
        <p className="mt-0.5 text-xs text-faint">{copy.today.targetToday(fmtDayLong(day))}</p>
      ) : (
        <div className="mt-3 flex gap-2">
          {(['rate', 'journal'] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`flex-1 rounded-full border px-3 py-1.5 text-sm transition ${
                tab === key ? 'border-ink bg-ink text-card' : 'border-line bg-card text-soft'
              }`}
            >
              {key === 'rate' ? copy.today.tabRate : copy.today.tabJournal}
              {key === 'journal' && hasJournal && (
                <span
                  className={`ml-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                    tab === key ? 'bg-card' : 'bg-track'
                  }`}
                />
              )}
            </button>
          ))}
        </div>
      )}
      <div className="mt-3">
        {tab === 'journal' && !sameDay ? (
          zeigeDetails ? (
            <JournalPanel habit={habit} date={today} />
          ) : (
            <p className="text-sm text-soft">{copy.today.hiddenDetails}</p>
          )
        ) : (
          <>
            {!sameDay && (
              <p className="mb-2 text-xs text-faint">{copy.today.targetYesterday(fmtDayLong(day))}</p>
            )}
            {habit.prompt_deck && zeigeDetails && (
              <div className="mb-3">
                <DailyPrompt
                  habitId={habit.id}
                  deck={habit.prompt_deck}
                  date={day}
                  onRead={() => setPromptRead(true)}
                />
              </div>
            )}
            {carried && (
              <p className="mb-2 rounded-xl bg-paper px-3 py-2 text-xs text-soft">
                {copy.today.carriedNote(
                  log.note && log.note !== '' ? log.note : log.trigger_tags.join(', '),
                )}
              </p>
            )}
            {pauseBis !== null && !editing ? (
              <div className="rounded-xl bg-rest-soft px-3.5 py-3">
                <p className="text-sm font-medium text-rest-deep">
                  {copy.today.pauseActive(fmtDayLong(pauseBis))}
                </p>
                <button
                  type="button"
                  onClick={() => void endPause(habit.id, today)}
                  className="mt-1 text-sm font-medium text-rest-deep underline underline-offset-2"
                >
                  {copy.today.pauseEnd}
                </button>
              </div>
            ) : log && log.rated && !editing ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-soft">
                  {log.paused
                    ? copy.today.loggedPaused(fmtDayShort(log.date))
                    : log.special
                      ? copy.today.loggedSpecial(fmtDayShort(log.date))
                      : copy.today.logged(fmtDayShort(log.date), log.on_track)}
                </p>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="text-sm font-medium text-track-deep"
                >
                  {copy.today.change}
                </button>
              </div>
            ) : (
              <div className={gesperrt ? 'pointer-events-none opacity-40' : undefined}>
                {isGoal ? (
                  <button
                    type="button"
                    onClick={() => choose(true)}
                    className="w-full rounded-xl border border-track/25 bg-track-soft py-3.5 text-[15px] font-medium text-track-deep transition active:scale-[0.98]"
                  >
                    {copy.today.goalDone}
                  </button>
                ) : (
                  <LogButtons
                    value={log?.rated && !log.special && !log.paused ? log.on_track : null}
                    onSelect={choose}
                    negativeLabel={sameDay ? copy.today.notToday : copy.today.notYesterday}
                  />
                )}
                {sameDay && (
                  <>
                    <button
                      type="button"
                      onClick={() => setPausePanel((v) => !v)}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-rest/25 bg-rest-soft py-3 text-[15px] font-medium text-rest-deep transition active:scale-[0.98]"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        {MedKitIcon}
                      </svg>
                      {copy.today.paused}
                    </button>
                    {pausePanel && (
                      <PausePicker
                        onPick={(bis) => {
                          void pauseRange(habit.id, today, bis)
                          setPausePanel(false)
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            )}
            {gesperrt && <p className="mt-2 text-xs text-faint">{copy.today.promptLocked}</p>}
            {log?.rated && !log.on_track && !log.paused && panelOpen && zeigeDetails && (
              <LogDetails log={log} onDone={() => setPanelOpen(false)} />
            )}
          </>
        )}
      </div>
      <WeekProgress
        days={week}
        headline={headline}
        perfectWeeks={perfect}
        goalLabel={isGoal ? copy.today.perfectWeekGoalTarget(target) : copy.today.perfectWeekGoal}
        className="mt-4 border-t border-line pt-3"
      />
    </Card>
  )
}
