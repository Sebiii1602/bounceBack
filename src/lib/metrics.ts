import { MOMENTUM } from './config'
import { parseKey, shiftKey, todayKey } from './dates'
import type { LogEntry, Severity } from './types'

export interface TrendPoint {
  date: string
  /** Prozent 0–100 oder null, wenn im Fenster nichts geloggt wurde. */
  pct: number | null
}

export interface MomentumPoint {
  date: string
  value: number
}

export interface TagStat {
  label: string
  count: number
  /** Anteil an allen „Heute nicht“-Tagen (0–1). */
  share: number
}

export interface WeekdayStat {
  /** 0 = Montag … 6 = Sonntag */
  weekday: number
  label: string
  count: number
}

export const WEEKDAYS_DE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const

const clamp = (v: number, min: number, max: number): number => Math.min(max, Math.max(min, v))

interface DayValue {
  on: boolean
  /** null (nicht bewertet) zählt wie „mittel“ */
  severity: Severity
}

/**
 * Nur bewertete Tage zählen. Reine Notiz-Einträge (Urge am laufenden Tag)
 * halten Text und Trigger fest, haben aber noch kein Urteil — sie dürfen
 * weder als Ausrutscher noch als on-track-Tag durchgehen.
 */
export const isRated = (l: LogEntry): boolean => l.rated !== false

function logMap(logs: LogEntry[]): Map<string, DayValue> {
  const m = new Map<string, DayValue>()
  // Special Days zählen ganz normal (sie sind on track — nur mit Krone)
  for (const l of logs) {
    if (!isRated(l)) continue
    m.set(l.date, { on: l.on_track, severity: l.severity ?? 2 })
  }
  return m
}

/**
 * Rollierender Anteil „on track“ pro Tag über `spanDays`, Fenster `windowDays`.
 * Nicht geloggte Tage zählen nicht in den Nenner — Vergessen wird nicht bestraft.
 */
export function rollingSeries(
  logs: LogEntry[],
  spanDays: number,
  windowDays = 30,
  today = todayKey(),
): TrendPoint[] {
  const map = logMap(logs)
  const total = spanDays + windowDays - 1
  const keys: string[] = new Array(total)
  keys[total - 1] = today
  for (let i = total - 2; i >= 0; i--) keys[i] = shiftKey(keys[i + 1], -1)

  const out: TrendPoint[] = []
  let logged = 0
  let onTrack = 0
  for (let i = 0; i < total; i++) {
    const v = map.get(keys[i])
    if (v !== undefined) {
      logged++
      if (v.on) onTrack++
    }
    const leaving = i - windowDays
    if (leaving >= 0) {
      const w = map.get(keys[leaving])
      if (w !== undefined) {
        logged--
        if (w.on) onTrack--
      }
    }
    if (i >= total - spanDays) {
      out.push({ date: keys[i], pct: logged === 0 ? null : Math.round((onTrack / logged) * 100) })
    }
  }
  return out
}

export function currentRollingPct(logs: LogEntry[], windowDays = 30, today = todayKey()): number | null {
  return rollingSeries(logs, 1, windowDays, today)[0]!.pct
}

/**
 * Momentum als Ausdauerbalken: Start bei 50, geloggte Tage verschieben ihn
 * asymmetrisch (+2 pro on-track-Tag, −4/−8/−12 je nach Stärke des
 * Ausrutschers), begrenzt auf 0–100. Nicht geloggte Tage frieren ein.
 */
export function momentumSeries(logs: LogEntry[], today = todayKey()): MomentumPoint[] {
  const map = logMap(logs)
  if (map.size === 0) return []
  const first = [...map.keys()].sort()[0]!

  const out: MomentumPoint[] = []
  let value: number = MOMENTUM.start
  for (let d = first; d <= today; d = shiftKey(d, 1)) {
    const v = map.get(d)
    if (v !== undefined) {
      value = clamp(value + (v.on ? MOMENTUM.up : MOMENTUM.down[v.severity]), MOMENTUM.min, MOMENTUM.max)
    }
    out.push({ date: d, value })
  }
  return out
}

export function currentMomentum(logs: LogEntry[], today = todayKey()): number {
  const series = momentumSeries(logs, today)
  return series.length > 0 ? series[series.length - 1]!.value : MOMENTUM.start
}

export function relapseLogs(logs: LogEntry[]): LogEntry[] {
  return logs.filter((l) => isRated(l) && !l.on_track)
}

/** Trigger-Häufigkeit über alle „Heute nicht“-Tage, absteigend sortiert. */
export function tagStats(logs: LogEntry[]): TagStat[] {
  const relapses = relapseLogs(logs)
  if (relapses.length === 0) return []
  const counts = new Map<string, number>()
  for (const l of relapses) {
    for (const tag of l.trigger_tags) counts.set(tag, (counts.get(tag) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count, share: count / relapses.length }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
}

/** Wochentagsverteilung der „Heute nicht“-Tage (Mo–So). */
export function weekdayStats(logs: LogEntry[]): WeekdayStat[] {
  const counts = new Array<number>(7).fill(0)
  for (const l of relapseLogs(logs)) {
    const jsDay = parseKey(l.date).getDay() // 0 = Sonntag
    const idx = (jsDay + 6) % 7 // 0 = Montag
    counts[idx] = (counts[idx] ?? 0) + 1
  }
  return counts.map((count, weekday) => ({ weekday, label: WEEKDAYS_DE[weekday]!, count }))
}
