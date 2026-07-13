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
 * Labels der Start-Trigger — IDs werden pro Gerät frisch vergeben (wie überall
 * sonst). Konvergenz über mehrere Geräte desselben Accounts läuft über den
 * `(user_id, label)`-Unique-Key beim Sync, nicht über eine feste ID.
 */
export const DEFAULT_TAGS: readonly string[] = [
  'Gestresst',
  'Einsam',
  'Müde',
  'Gelangweilt',
  'Vor Besuch',
  'Sonstiges',
]

export const APP_VERSION = '0.1.0'
