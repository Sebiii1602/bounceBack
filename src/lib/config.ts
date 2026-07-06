/** Momentum: asymmetrisch aber begrenzt — nie ein Reset auf null. */
export const MOMENTUM = {
  start: 50,
  up: 2,
  down: -8,
  min: 0,
  max: 100,
} as const

/** Ab so vielen „Heute nicht“-Einträgen werden Muster angezeigt. */
export const MIN_RELAPSES_FOR_PATTERNS = 3

/**
 * Feste UUIDs: jedes Gerät seedet identische Zeilen, damit die Defaults
 * beim Sync zusammenfallen statt sich zu duplizieren.
 */
export const DEFAULT_TAGS: ReadonlyArray<{ id: string; label: string }> = [
  { id: '00000000-0000-4000-8000-000000000001', label: 'Gestresst' },
  { id: '00000000-0000-4000-8000-000000000002', label: 'Einsam' },
  { id: '00000000-0000-4000-8000-000000000003', label: 'Müde' },
  { id: '00000000-0000-4000-8000-000000000004', label: 'Gelangweilt' },
  { id: '00000000-0000-4000-8000-000000000005', label: 'Vor Besuch' },
  { id: '00000000-0000-4000-8000-000000000006', label: 'Sonstiges' },
]

export const APP_VERSION = '0.1.0'
