import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { addHabit, db } from '../lib/db'
import { copy } from '../lib/copy'
import { fmtDayLong, todayKey } from '../lib/dates'
import { Card, PageTitle } from '../components/ui'
import { HabitLogCard } from '../components/HabitLogCard'
import { LogModeChips } from '../components/LogModeChips'

function EmptyState() {
  const [name, setName] = useState('')
  const [sameDay, setSameDay] = useState(false)
  return (
    <Card>
      <h2 className="text-base font-semibold">{copy.today.emptyTitle}</h2>
      <p className="mt-1 text-sm text-soft">{copy.today.emptyHint}</p>
      <div className="mt-4 space-y-2">
        <LogModeChips value={sameDay} onChange={setSameDay} />
        <p className="text-xs text-faint">{copy.today.modeHint}</p>
      </div>
      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim() === '') return
          void addHabit(name, sameDay)
          setName('')
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={copy.today.habitNamePlaceholder}
          className="min-w-0 flex-1 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base outline-none focus:border-track"
        />
        <button
          type="submit"
          className="shrink-0 rounded-xl bg-track px-4 py-2.5 text-sm font-medium text-white"
        >
          {copy.today.start}
        </button>
      </form>
    </Card>
  )
}

export function Today() {
  const habits = useLiveQuery(
    async () => (await db.habits.toArray()).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [],
  )
  if (habits === undefined) return null

  return (
    <div>
      <PageTitle overline={fmtDayLong(todayKey())} title={copy.tabs.today} />
      {habits.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => (
            <HabitLogCard key={habit.id} habit={habit} />
          ))}
        </div>
      )}
    </div>
  )
}
