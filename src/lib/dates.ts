import { addDays, addMonths, endOfMonth, format, parse, startOfMonth, startOfWeek } from 'date-fns'
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

/** Montag der Woche, in der `key` liegt — Ziel-Habits rechnen in Kalenderwochen. */
export const mondayOf = (key: string): string =>
  dateKey(startOfWeek(parseKey(key), { weekStartsOn: 1 }))

/** „Mo“, „Di“ … */
export const fmtWeekdayShort = (key: string): string =>
  format(parseKey(key), 'EEEEEE', { locale: de })

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

/** 'yyyy-MM' des Monats, in dem `key` liegt. */
export const monthOf = (key: string): string => key.slice(0, 7)

/** Der laufende Monat als 'yyyy-MM'. */
export const thisMonth = (): string => monthOf(todayKey())

/** Erster und letzter Tag eines Monats ('yyyy-MM'). */
export const monthBounds = (month: string): { from: string; to: string } => {
  const d = parseKey(`${month}-01`)
  return { from: dateKey(startOfMonth(d)), to: dateKey(endOfMonth(d)) }
}

/** Monat verschieben — `shiftMonth('2026-10', -1)` → '2026-09'. */
export const shiftMonth = (month: string, n: number): string =>
  format(addMonths(parseKey(`${month}-01`), n), 'yyyy-MM')

/** „Oktober 2026" aus 'yyyy-MM' */
export const fmtMonthKey = (month: string): string =>
  format(parseKey(`${month}-01`), 'MMMM yyyy', { locale: de })

/** „Oktober" — ohne Jahr, für Fließtext. */
export const fmtMonthName = (month: string): string =>
  format(parseKey(`${month}-01`), 'MMMM', { locale: de })

/** „14:03“ — Uhrzeit ohne Datum. */
export const fmtClock = (iso: string): string => format(new Date(iso), 'HH:mm')
