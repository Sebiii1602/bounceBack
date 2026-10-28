import { useEffect, useState } from 'react'
import { copy } from '../lib/copy'
import { DECK_LANG, promptForDay } from '../lib/prompts'
import { speak, speechSupported, stopSpeaking } from '../lib/speech'
import type { PromptDeck } from '../lib/types'

/** Pro Gerät und Tag gemerkt — ein Lernschritt muss nicht synchronisiert werden. */
const readKey = (habitId: string, date: string): string => `prompt_read_${habitId}_${date}`

export function promptWasRead(habitId: string, date: string): boolean {
  try {
    return localStorage.getItem(readKey(habitId, date)) === '1'
  } catch {
    return false
  }
}

/**
 * Tagesimpuls: ein kurzer Text in der Lernsprache, vorlesbar, mit aufdeckbarer
 * Übersetzung. Das Aufdecken schaltet das Abhaken frei — ein Tap Aufwand, aber
 * man kann den Tag nicht abhaken, ohne den Text überhaupt gesehen zu haben.
 */
export function DailyPrompt({
  habitId,
  deck,
  date,
  onRead,
}: {
  habitId: string
  deck: PromptDeck
  date: string
  onRead: () => void
}) {
  const text = promptForDay(deck, date)
  // Zwei getrennte Dinge: einmal gelesen schaltet das Abhaken dauerhaft frei,
  // sichtbar ist die Übersetzung aber frei umschaltbar — zum Selbstabfragen.
  const [showing, setShowing] = useState(() => promptWasRead(habitId, date))

  useEffect(() => {
    setShowing(promptWasRead(habitId, date))
  }, [habitId, date])

  // Beim Verlassen nicht weiterreden
  useEffect(() => stopSpeaking, [])

  function toggle() {
    const next = !showing
    setShowing(next)
    if (!next) return
    try {
      localStorage.setItem(readKey(habitId, date), '1')
    } catch {
      // Privater Modus o. Ä. — dann gilt es eben nur für diese Sitzung
    }
    onRead()
  }

  return (
    <div className="rounded-xl bg-paper p-3.5">
      <p className="text-[15px] leading-relaxed">{text.it}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {speechSupported() && (
          <button
            type="button"
            onClick={() => speak(text.it, DECK_LANG[deck])}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-sm text-soft transition active:scale-[0.98]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M11 5 6 9H3v6h3l5 4V5Z" />
              <path d="M15.5 8.5a5 5 0 0 1 0 7" />
              <path d="M18.5 5.5a9 9 0 0 1 0 13" />
            </svg>
            {copy.today.promptListen}
          </button>
        )}
        <button
          type="button"
          onClick={toggle}
          className={`rounded-full px-3 py-1.5 text-sm font-medium transition active:scale-[0.98] ${
            showing ? 'border border-line bg-card text-soft' : 'bg-ink text-card'
          }`}
        >
          {showing ? copy.today.promptHide : copy.today.promptReveal}
        </button>
      </div>
      {showing && (
        <p className="mt-3 border-t border-line pt-3 text-sm leading-relaxed text-soft">
          {text.de}
        </p>
      )}
    </div>
  )
}
