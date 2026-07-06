import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setLogState } from '../lib/db'
import { copy } from '../lib/copy'
import { fmtDayShort, todayKey } from '../lib/dates'
import { currentMomentum, currentRollingPct } from '../lib/metrics'
import type { Habit } from '../lib/types'
import { Card } from './ui'
import { LogButtons } from './LogButtons'
import { LogDetails } from './LogDetails'

export function HabitLogCard({ habit }: { habit: Habit }) {
  const today = todayKey()
  const log = useLiveQuery(
    () => db.logs.where('[habit_id+date]').equals([habit.id, today]).first(),
    [habit.id, today],
  )
  const logs = useLiveQuery(() => db.logs.where('habit_id').equals(habit.id).toArray(), [habit.id])
  const [editing, setEditing] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)

  const pct = logs ? currentRollingPct(logs) : null
  const momentum = currentMomentum(logs ?? [])

  function choose(onTrack: boolean) {
    void setLogState(habit.id, today, onTrack)
    setEditing(false)
    // Bei „Heute nicht“ direkt die optionalen Trigger anbieten (1 Tap entfernt)
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
      <div className="mt-3">
        {log && !editing ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-soft">{copy.today.logged(fmtDayShort(log.date), log.on_track)}</p>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-track-deep"
            >
              {copy.today.change}
            </button>
          </div>
        ) : (
          <LogButtons value={log ? log.on_track : null} onSelect={choose} />
        )}
        {log && !log.on_track && panelOpen && (
          <LogDetails log={log} onDone={() => setPanelOpen(false)} />
        )}
      </div>
    </Card>
  )
}
