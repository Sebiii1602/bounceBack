import { copy } from '../lib/copy'

/**
 * Wahl des Eintrag-Modus: „Gleicher Tag“ (Aktiv-Habit wie Gym) vs.
 * „Folgetag“ (Lass-Habit wie Rauchen — erst bewertbar, wenn der Tag rum ist).
 */
export function LogModeChips({
  value,
  onChange,
}: {
  /** true = gleicher Tag, false = Folgetag */
  value: boolean
  onChange: (sameDay: boolean) => void
}) {
  const options = [
    { sameDay: true, label: copy.more.logModeSame },
    { sameDay: false, label: copy.more.logModeNext },
  ]
  return (
    <div className="flex gap-2">
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.sameDay)}
          className={`rounded-full border px-3 py-1.5 text-sm transition ${
            value === opt.sameDay ? 'border-ink bg-ink text-card' : 'border-line bg-card text-soft'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
