import { useState } from 'react'
import { copy } from '../lib/copy'
import { fmtDayLong, shiftKey, todayKey } from '../lib/dates'

/**
 * Zeitraum einer Pause: ab wann und wie lange. Sechs Wochen Verletzung soll
 * man einmal eintragen und dann Ruhe haben, nicht jeden Morgen erneut.
 *
 * Der Start darf in der Vergangenheit liegen — wer seit dem 1. Oktober
 * verletzt ist, merkt das meist erst Wochen später beim Blick auf die Quote.
 * Die Dauer-Chips zählen trotzdem ab heute: „noch zwei Wochen“ ist die Frage,
 * die man sich dann stellt, nicht „zwei Wochen ab einem Tag, der längst vorbei
 * ist“.
 */
export function PausePicker({
  from = todayKey(),
  onPick,
}: {
  /** Vorbelegter Beginn — heute auf der Heute-Karte, sonst der getippte Tag. */
  from?: string
  onPick: (von: string, bis: string) => void
}) {
  const today = todayKey()
  const [von, setVon] = useState(from)
  const rueckwirkend = von < today
  // Dauer zählt ab heute, außer die Pause beginnt erst in der Zukunft
  const anker = von > today ? von : today

  return (
    <div className="mt-2 rounded-xl bg-paper p-3">
      <label className="flex items-center justify-between gap-2 text-xs text-faint">
        {copy.today.pauseFrom}
        <input
          type="date"
          value={von}
          onChange={(e) => {
            if (e.target.value) setVon(e.target.value)
          }}
          className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>
      {rueckwirkend && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
          {copy.today.pauseBackdated(fmtDayLong(von))}
        </p>
      )}
      <p className="mb-2 mt-3 text-xs text-faint">{copy.today.pauseFor}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onPick(von, anker)}
          className="rounded-full border border-line bg-card px-3 py-1.5 text-sm text-soft"
        >
          {rueckwirkend
            ? copy.today.pauseUntilToday
            : von > today
              ? copy.today.pauseSingleDay
              : copy.today.pauseToday}
        </button>
        {[1, 2, 4, 6].map((wochen) => (
          <button
            key={wochen}
            type="button"
            onClick={() => onPick(von, shiftKey(anker, wochen * 7 - 1))}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-sm text-soft"
          >
            {rueckwirkend ? copy.today.pauseWeeksMore(wochen) : copy.today.pauseWeeks(wochen)}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2 text-xs text-faint">
        {copy.today.pauseUntilDate}
        <input
          type="date"
          min={von}
          onChange={(e) => {
            if (e.target.value) onPick(von, e.target.value)
          }}
          className="rounded-lg border border-line bg-card px-2 py-1.5 text-sm text-ink outline-none"
        />
      </label>
    </div>
  )
}
