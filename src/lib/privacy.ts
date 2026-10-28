import { useSyncExternalStore } from 'react'
import type { Habit } from './types'

/**
 * Diskret-Modus: Habits mit Deckname zeigen standardmäßig diesen statt ihres
 * echten Namens, Notizen und Trigger bleiben verborgen. Ein Tipp auf das Auge
 * in der Kopfzeile deckt für diese Sitzung auf.
 *
 * Bewusst **nicht** gespeichert: Beim nächsten Öffnen ist wieder alles
 * verdeckt. Andersherum würde man es garantiert irgendwann vergessen, und
 * genau dann schaut jemand mit.
 */
let revealed = false
const listeners = new Set<() => void>()

export function useRevealed(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => revealed,
  )
}

export function toggleRevealed(): void {
  revealed = !revealed
  listeners.forEach((l) => l())
}

/** Ist der Habit privat (hat also einen Decknamen)? */
export const isPrivate = (habit: Habit): boolean =>
  habit.private_alias !== null && habit.private_alias !== ''

/** Der Name, der gerade angezeigt werden darf. */
export function displayName(habit: Habit, revealedNow: boolean): string {
  return isPrivate(habit) && !revealedNow ? habit.private_alias! : habit.name
}

/** Dürfen Notiz und Trigger dieses Habits gerade gezeigt werden? */
export const mayShowDetails = (habit: Habit, revealedNow: boolean): boolean =>
  !isPrivate(habit) || revealedNow
