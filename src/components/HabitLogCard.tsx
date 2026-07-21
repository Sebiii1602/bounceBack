import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setLogState } from '../lib/db'
import { copy } from '../lib/copy'
import { fmtDayLong, fmtDayShort, todayKey, yesterdayKey } from '../lib/dates'
import { currentMomentum, currentRollingPct } from '../lib/metrics'
import type { Habit } from '../lib/types'
import { Card } from './ui'
import { LogButtons } from './LogButtons'
import { LogDetails } from './LogDetails'
import { JournalPanel } from './JournalPanel'

export function HabitLogCard({ habit }: { habit: Habit }) {
  // Aktiv-Habits (Gym) sind heute eintragbar, Lass-Habits (Rauchen) erst am Folgetag
  const sameDay = habit.log_same_day
  const day = sameDay ? todayKey() : yesterdayKey()
  const today = todayKey()
  const log = useLiveQuery(
    () => db.logs.where('[habit_id+date]').equals([habit.id, day]).first(),
    [habit.id, day],
  )
  // Bei Folgetag-Habits läuft „heute“ noch — hier landen Notizen vor der Bewertung
  const todayLog = useLiveQuery(
    () =>
      sameDay ? undefined : db.logs.where('[habit_id+date]').equals([habit.id, today]).first(),
    [habit.id, today, sameDay],
  )
  const logs = useLiveQuery(() => db.logs.where('habit_id').equals(habit.id).toArray(), [habit.id])
  const [editing, setEditing] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [tab, setTab] = useState<'rate' | 'journal'>('rate')

  const pct = logs ? currentRollingPct(logs, 30, day) : null
  const momentum = currentMomentum(logs ?? [], day)
  const hasJournal = !!todayLog && (todayLog.trigger_tags.length > 0 || (todayLog.note ?? '') !== '')
  // Am zu bewertenden Tag lag schon eine Notiz? Dann daran erinnern, bevor bewertet wird.
  const carried = log && !log.rated && (log.trigger_tags.length > 0 || (log.note ?? '') !== '')

  function choose(onTrack: boolean) {
    void setLogState(habit.id, day, onTrack)
    setEditing(false)
    // Bei „nicht on track“ direkt die optionalen Trigger anbieten (1 Tap entfernt)
    setPanelOpen(!onTrack)
  }

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold">{habit.name}</h2>
        <span className="shrink-0 text-xs text-faint">
          {copy.today.statLine(pct === null ? '–' : `${pct} %`, momentum)}
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
          <JournalPanel habit={habit} date={today} />
        ) : (
          <>
            {!sameDay && (
              <p className="mb-2 text-xs text-faint">{copy.today.targetYesterday(fmtDayLong(day))}</p>
            )}
            {carried && (
              <p className="mb-2 rounded-xl bg-paper px-3 py-2 text-xs text-soft">
                {copy.today.carriedNote(
                  log.note && log.note !== '' ? log.note : log.trigger_tags.join(', '),
                )}
              </p>
            )}
            {log && log.rated && !editing ? (
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm text-soft">
                  {log.special
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
              <LogButtons
                value={log?.rated && !log.special ? log.on_track : null}
                onSelect={choose}
                negativeLabel={sameDay ? copy.today.notToday : copy.today.notYesterday}
              />
            )}
            {log?.rated && !log.on_track && panelOpen && (
              <LogDetails log={log} onDone={() => setPanelOpen(false)} />
            )}
          </>
        )}
      </div>
    </Card>
  )
}
