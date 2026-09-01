/**
 * Momentum zieht sich jeden geloggten Tag ein Stück in Richtung dieses Tages:
 * ein On-track-Tag nach oben, ein Ausrutscher nach unten. Dadurch pendelt sich
 * der Wert von selbst dort ein, wo die Quote der letzten Wochen liegt —
 * ~83 bei 80 % on track, ~92 bei 90 %.
 *
 * Die frühere Variante addierte feste Beträge (+2 / −8). Das hatte einen
 * Kipppunkt bei 80 % Quote: Wer knapp darunter lag, rutschte unaufhaltsam auf
 * 0 — auch bei objektiv guten 80 %. Genau das soll die App nicht tun.
 *
 * Die Asymmetrie entsteht jetzt von allein: Weit unten bringt ein guter Tag
 * viel und ein Ausrutscher kostet fast nichts, weit oben ist es umgekehrt.
 * Erholung aus dem Tief geht schnell, oben halten wird zäh.
 */
export const MOMENTUM = {
  start: 50,
  /** Wie weit sich der Wert pro geloggtem Tag dem Tageswert nähert (0–1). */
  rate: 0.1,
  /** Wohin ein On-track-Tag zieht (auch Special Days). */
  onTarget: 100,
  /**
   * Wohin ein Ausrutscher zieht, je nach Stärke: 1 = leicht, 2 = mittel
   * (Default), 3 = deutlich. Bei 80 % Quote ergibt das ~87 / ~83 / ~80 —
   * die Stärke spreizt spürbar, ohne den Wert abstürzen zu lassen.
   */
  offTarget: { 1: 35, 2: 15, 3: 0 } as Record<1 | 2 | 3, number>,
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
  'Frustriert',
  'Traurig',
  'Angespannt',
  'Nach Streit',
  'Alkohol',
  'Unterwegs',
  'Lange am Handy',
  'Abends allein',
  'Sonstiges',
]

/**
 * Start-Trigger, die sich als zu speziell erwiesen haben — werden beim
 * Datenbank-Upgrade entfernt, sofern sie in keinem Eintrag benutzt werden.
 */
export const RETIRED_DEFAULT_TAGS: readonly string[] = ['Vor Besuch']

/**
 * Web-Push: öffentlicher VAPID-Schlüssel (darf im Code stehen).
 * Der private Gegenpart liegt NUR als Secret in der Supabase Edge Function.
 */
export const VAPID_PUBLIC_KEY =
  'BFGPFRZbUxTdmpZ5lUZK-x-X8ZzIWnLfmB2nHm0WdIOuyyI9A5tlOH8R0KJrqZ5JBnhAV-POjnIrYJCcuvIPmO4'

export const APP_VERSION = '0.1.0'
