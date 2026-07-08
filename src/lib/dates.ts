import { addDays, format, parse } from 'date-fns'
import { de } from 'date-fns/locale'

/** Lokales Kalenderdatum als stabiler Schlüssel ('yyyy-MM-dd'). */
export const dateKey = (d: Date): string => format(d, 'yyyy-MM-dd')

export const todayKey = (): string => dateKey(new Date())

export const parseKey = (key: string): Date => parse(key, 'yyyy-MM-dd', new Date())

export const shiftKey = (key: string, days: number): string => dateKey(addDays(parseKey(key), days))

/**
 * Der letzte abgeschlossene Tag — der einzige, der neu eingetragen werden darf.
 * Heute ist bewusst gesperrt: ob der Tag „on track“ war, weiß man erst, wenn er vorbei ist.
 */
export const yesterdayKey = (): string => shiftKey(todayKey(), -1)

/** „Sonntag, 6. Juli“ */
export const fmtDayLong = (key: string): string => format(parseKey(key), 'EEEE, d. MMMM', { locale: de })

/** „6. Juli“ */
export const fmtDayShort = (key: string): string => format(parseKey(key), 'd. MMMM', { locale: de })

/** „6.7.“ — Achsen-Ticks */
export const fmtTick = (key: string): string => format(parseKey(key), 'd.M.')

/** „Juli 2026“ */
export const fmtMonth = (d: Date): string => format(d, 'MMMM yyyy', { locale: de })

/** „6. Jul., 14:03“ */
export const fmtTime = (iso: string): string => format(new Date(iso), 'd. MMM, HH:mm', { locale: de })

export const nowIso = (): string => new Date().toISOString()
