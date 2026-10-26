import { parseKey } from '../dates'
import type { PromptDeck } from '../types'
import { ITALIENISCH, type PromptText } from './italienisch'

const DECKS: Record<PromptDeck, readonly PromptText[]> = { italienisch: ITALIENISCH }

export const DECK_LABEL: Record<PromptDeck, string> = { italienisch: 'Italienisch' }

/** Sprachcode für die Vorlesefunktion. */
export const DECK_LANG: Record<PromptDeck, string> = { italienisch: 'it-IT' }

export const ALL_DECKS = Object.keys(DECKS) as PromptDeck[]

/**
 * Welcher Text heute dran ist. Leitet sich aus dem Datum ab statt aus einem
 * gespeicherten Zähler: So bleibt derselbe Text den ganzen Tag stehen, auch
 * nach einem Neuladen oder auf einem zweiten Gerät — ganz ohne Sync.
 */
export function promptForDay(deck: PromptDeck, date: string): PromptText {
  const texts = DECKS[deck]
  const tage = Math.floor(parseKey(date).getTime() / 86_400_000)
  return texts[((tage % texts.length) + texts.length) % texts.length]!
}

export type { PromptText }
