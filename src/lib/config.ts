/** Momentum: asymmetrisch aber begrenzt — nie ein Reset auf null. */
export const MOMENTUM = {
  start: 50,
  up: 2,
  /** Abzug nach Stärke des Ausrutschers: 1 = leicht, 2 = mittel (Default), 3 = deutlich */
  down: { 1: -4, 2: -8, 3: -12 } as Record<1 | 2 | 3, number>,
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
