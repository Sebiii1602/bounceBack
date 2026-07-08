import { copy } from '../lib/copy'

const base = 'rounded-xl border py-3.5 text-[15px] font-medium transition active:scale-[0.98]'

/**
 * Die zwei großen Log-Buttons — Kern des 2-Tap-Flows.
 * `negativeLabel`: „Gestern nicht“ im Tages-Flow, neutral „Nicht on track“ beim Nachtragen.
 */
export function LogButtons({
  value,
  onSelect,
  negativeLabel = copy.today.notOnTrack,
}: {
  value: boolean | null
  onSelect: (onTrack: boolean) => void
  negativeLabel?: string
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onSelect(true)}
        className={`${base} ${
          value === true
            ? 'border-track bg-track text-white'
            : 'border-track/25 bg-track-soft text-track-deep'
        }`}
      >
        {copy.today.onTrack}
      </button>
      <button
        type="button"
        onClick={() => onSelect(false)}
        className={`${base} ${
          value === false
            ? 'border-slip bg-slip text-white'
            : 'border-slip/25 bg-slip-soft text-slip-deep'
        }`}
      >
        {negativeLabel}
      </button>
    </div>
  )
}
