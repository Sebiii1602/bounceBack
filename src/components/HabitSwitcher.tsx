import type { Habit } from '../lib/types'

/** Chips zum Umschalten zwischen Habits — erscheint erst ab zwei Habits. */
export function HabitSwitcher({
  habits,
  value,
  onChange,
}: {
  habits: Habit[]
  value: string | undefined
  onChange: (id: string) => void
}) {
  if (habits.length <= 1) return null
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {habits.map((habit) => (
        <button
          key={habit.id}
          type="button"
          onClick={() => onChange(habit.id)}
          className={`rounded-full border px-3 py-1.5 text-sm transition ${
            habit.id === value ? 'border-ink bg-ink text-card' : 'border-line bg-card text-soft'
          }`}
        >
          {habit.name}
        </button>
      ))}
    </div>
  )
}
