import { MOMENTUM } from './config'
import { mondayOf, parseKey, shiftKey, todayKey } from './dates'
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

/** `paused` = konnte nicht (verletzt/krank) — zählt nirgends, bricht aber nichts ab. */
export type DayKind = 'on' | 'off' | 'paused'

interface DayValue {
  kind: DayKind
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
    m.set(l.date, {
      kind: l.paused ? 'paused' : l.on_track ? 'on' : 'off',
      severity: l.severity ?? 2,
    })
  }
  return m
}

/** Zählt der Tag in die Quote? Pausen stehen außer Konkurrenz. */
const zaehlt = (v: DayValue | undefined): v is DayValue =>
  v !== undefined && v.kind !== 'paused'

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
    if (zaehlt(v)) {
      logged++
      if (v.kind === 'on') onTrack++
    }
    const leaving = i - windowDays
    if (leaving >= 0) {
      const w = map.get(keys[leaving])
      if (zaehlt(w)) {
        logged--
        if (w.kind === 'on') onTrack--
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

/** Wohin ein Tag den Wert zieht. */
const dayTarget = (v: DayValue): number =>
  v.kind === 'on' ? MOMENTUM.onTarget : MOMENTUM.offTarget[v.severity]

/**
 * Momentum als Ausdauerbalken: Start bei 50, jeder geloggte Tag zieht den Wert
 * ein Stück (`rate`) in Richtung dieses Tages. Nicht geloggte Tage frieren ein.
 *
 * Dadurch pendelt sich der Wert von selbst dort ein, wo die Quote der letzten
 * Wochen liegt, statt an einem Kipppunkt nach oben oder unten wegzulaufen —
 * und jüngere Tage wiegen automatisch schwerer als alte. Genau das
 * unterscheidet Momentum von den 30-Tage-%: nicht der Schnitt, sondern wie es
 * gerade läuft.
 *
 * Intern wird ungerundet gerechnet, sonst würden kleine Schritte durch
 * wiederholtes Runden verschluckt.
 */
function momentumRaw(logs: LogEntry[], today = todayKey()): { date: string; value: number }[] {
  const map = logMap(logs)
  const gezaehlt = [...map.keys()].filter((d) => zaehlt(map.get(d))).sort()
  if (gezaehlt.length === 0) return []
  const first = gezaehlt[0]!

  const out: { date: string; value: number }[] = []
  let value: number = MOMENTUM.start
  for (let d = first; d <= today; d = shiftKey(d, 1)) {
    const v = map.get(d)
    if (zaehlt(v)) value += MOMENTUM.rate * (dayTarget(v) - value)
    out.push({ date: d, value })
  }
  return out
}

export function momentumSeries(logs: LogEntry[], today = todayKey()): MomentumPoint[] {
  return momentumRaw(logs, today).map((p) => ({
    date: p.date,
    value: clamp(Math.round(p.value), MOMENTUM.min, MOMENTUM.max),
  }))
}

/** Ungerundeter Stand von heute — Basis für Folgerechnungen wie `slipCost`. */
function currentMomentumRaw(logs: LogEntry[], today = todayKey()): number {
  const series = momentumRaw(logs, today)
  return series.length > 0 ? series[series.length - 1]!.value : MOMENTUM.start
}

export function currentMomentum(logs: LogEntry[], today = todayKey()): number {
  return clamp(Math.round(currentMomentumRaw(logs, today)), MOMENTUM.min, MOMENTUM.max)
}

/** Zustand eines Tages im 7-Tage-Streifen. */
export type WeekDayState = DayKind | 'none'

export interface DayState {
  date: string
  state: WeekDayState
}

/** Alle bewerteten Tage aufsteigend sortiert. */
function ratedDays(logs: LogEntry[]): string[] {
  return [...logMap(logs).keys()].sort()
}

/**
 * Wie viele perfekte Wochen sind zusammengekommen?
 *
 * Eine perfekte Woche sind sieben aufeinanderfolgende On-track-Tage — egal an
 * welchem Wochentag sie anfangen. Serien werden in Siebener-Blöcke geteilt und
 * abgerundet: 13 Tage am Stück sind eine perfekte Woche, 14 sind zwei.
 *
 * Ein reiner Sammelzähler: Er kann nur steigen — ein schlechter Tag danach
 * nimmt nichts weg, er beendet nur die laufende Serie. Genau das unterscheidet
 * ihn vom Streak, der bei einem einzigen Ausrutscher alles kassiert.
 *
 * Unterbrochen wird eine Serie von einem Ausrutscher genauso wie von einer
 * Lücke: Bei einem Tag ohne Eintrag ist schlicht nicht bekannt, wie er lief.
 * Nachtragen über den Kalender schließt die Lücke jederzeit wieder.
 */
export function perfectWeekCount(logs: LogEntry[]): number {
  const map = logMap(logs)
  let total = 0
  let run = 0
  let prev: string | null = null
  for (const date of ratedDays(logs)) {
    const lueckenlos = prev !== null && shiftKey(prev, 1) === date
    const kind = map.get(date)!.kind
    if (kind === 'paused') {
      // Überbrückt: eine Verletzung beendet die Serie nicht, sie hält sie an.
      // Nur eine echte Lücke davor bricht sie trotzdem ab.
      if (!lueckenlos && prev !== null) {
        total += Math.floor(run / 7)
        run = 0
      }
    } else if (kind === 'off') {
      total += Math.floor(run / 7)
      run = 0
    } else if (lueckenlos || run === 0) {
      run++
    } else {
      total += Math.floor(run / 7)
      run = 1
    }
    prev = date
  }
  return total + Math.floor(run / 7)
}

/**
 * Tage am Stück on track, rückwärts ab heute. Ist heute noch nicht bewertet
 * (Folgetag-Habits, oder einfach noch nicht eingetragen), zählt die Serie ab
 * gestern — sonst stünde sie den ganzen Tag über fälschlich auf null.
 */
export function currentStreak(logs: LogEntry[], today = todayKey()): number {
  const map = logMap(logs)
  let date = map.get(today) === undefined ? shiftKey(today, -1) : today
  let run = 0
  for (;;) {
    const v = map.get(date)
    if (v === undefined || v.kind === 'off') return run
    // Pausentage überspringen, ohne die Serie zu beenden
    if (v.kind === 'on') run++
    date = shiftKey(date, -1)
  }
}

/** Die letzten sieben Kalendertage bis heute, ältester zuerst. */
export function lastSevenDays(logs: LogEntry[], today = todayKey()): DayState[] {
  const map = logMap(logs)
  const out: DayState[] = []
  for (let i = 6; i >= 0; i--) {
    const date = shiftKey(today, -i)
    const v = map.get(date)
    out.push({ date, state: v === undefined ? 'none' : v.kind })
  }
  return out
}

// ──────────────────────────────────────────────────────────────────────────
// Ziel-Habits: „n-mal pro Woche reicht"
//
// Hier wird nur eingetragen, was stattgefunden hat — ein Tag ohne Eintrag ist
// kein Fehler, sondern einfach kein Trainingstag. Deshalb rechnet alles gegen
// ein Soll statt gegen eine Quote: Wer 2× pro Woche will und 2× da war, steht
// bei 100 %, nicht bei 29 %.
// ──────────────────────────────────────────────────────────────────────────

interface WindowCount {
  done: number
  paused: number
}

/** On-track- und Pausentage in den sieben Tagen bis einschließlich `day`. */
function countWindow(map: Map<string, DayValue>, day: string): WindowCount {
  let done = 0
  let paused = 0
  for (let i = 0; i < 7; i++) {
    const v = map.get(shiftKey(day, -i))
    if (v === undefined) continue
    if (v.kind === 'paused') paused++
    else if (v.kind === 'on') done++
  }
  return { done, paused }
}

/**
 * Soll, um Pausentage gekürzt: Wer die halbe Woche verletzt war, soll auch nur
 * das halbe Ziel schaffen müssen. Mindestens 1, solange überhaupt ein Tag
 * nutzbar war — sonst stünde das Ziel bei 0 und wäre trivial erfüllt.
 */
function effectiveTarget(target: number, paused: number): number {
  if (paused >= 7) return 0
  return Math.max(1, Math.ceil((target * (7 - paused)) / 7))
}

/** Zielerfüllung 0–1 über die sieben Tage bis `day`, gedeckelt bei 1. */
export function goalFulfillment(logs: LogEntry[], target: number, day = todayKey()): number {
  const { done, paused } = countWindow(logMap(logs), day)
  const soll = effectiveTarget(target, paused)
  return soll === 0 ? 1 : Math.min(1, done / soll)
}

/** Zielerfüllung in Prozent — das Gegenstück zu `currentRollingPct`. */
export function currentGoalPct(logs: LogEntry[], target: number, today = todayKey()): number | null {
  if (logMap(logs).size === 0) return null
  return Math.round(goalFulfillment(logs, target, today) * 100)
}

/** Verlauf der Zielerfüllung für die Kurve. */
export function goalSeries(
  logs: LogEntry[],
  target: number,
  spanDays: number,
  today = todayKey(),
): TrendPoint[] {
  const map = logMap(logs)
  const out: TrendPoint[] = []
  for (let i = spanDays - 1; i >= 0; i--) {
    const date = shiftKey(today, -i)
    const { done, paused } = countWindow(map, date)
    const soll = effectiveTarget(target, paused)
    out.push({ date, pct: soll === 0 ? 100 : Math.round(Math.min(1, done / soll) * 100) })
  }
  return out
}

/**
 * Momentum für Ziel-Habits: Es zieht täglich Richtung der Zielerfüllung des
 * rollierenden Sieben-Tage-Fensters. Wer sein Ziel dauerhaft hält, landet bei
 * 100; wer die Hälfte schafft, bei ~50.
 */
export function goalMomentumSeries(
  logs: LogEntry[],
  target: number,
  today = todayKey(),
): MomentumPoint[] {
  const map = logMap(logs)
  if (map.size === 0) return []
  const first = [...map.keys()].sort()[0]!

  const out: MomentumPoint[] = []
  let value: number = MOMENTUM.start
  for (let d = first; d <= today; d = shiftKey(d, 1)) {
    const { done, paused } = countWindow(map, d)
    const soll = effectiveTarget(target, paused)
    const ziel = soll === 0 ? value : Math.min(1, done / soll) * MOMENTUM.onTarget
    value += MOMENTUM.rate * (ziel - value)
    out.push({ date: d, value: clamp(Math.round(value), MOMENTUM.min, MOMENTUM.max) })
  }
  return out
}

export function currentGoalMomentum(
  logs: LogEntry[],
  target: number,
  today = todayKey(),
): number {
  const series = goalMomentumSeries(logs, target, today)
  return series.length > 0 ? series[series.length - 1]!.value : MOMENTUM.start
}

/** Stand der laufenden Kalenderwoche: wie viele von wie vielen. */
export function weekGoalProgress(
  logs: LogEntry[],
  target: number,
  today = todayKey(),
): { done: number; target: number } {
  const map = logMap(logs)
  const monday = mondayOf(today)
  let done = 0
  let paused = 0
  for (let i = 0; i < 7; i++) {
    const v = map.get(shiftKey(monday, i))
    if (v === undefined) continue
    if (v.kind === 'paused') paused++
    else if (v.kind === 'on') done++
  }
  return { done, target: effectiveTarget(target, paused) }
}

/**
 * Perfekte Wochen bei Ziel-Habits: Kalenderwochen (Mo–So), in denen das Ziel
 * erreicht wurde. Anders als bei täglichen Habits zählt hier die Woche als
 * Einheit — „3× die Woche" bezieht sich ja genau darauf.
 */
export function goalPerfectWeeks(logs: LogEntry[], target: number): number {
  const map = logMap(logs)
  const byWeek = new Map<string, WindowCount>()
  for (const [date, v] of map) {
    const monday = mondayOf(date)
    const w = byWeek.get(monday) ?? { done: 0, paused: 0 }
    if (v.kind === 'paused') w.paused++
    else if (v.kind === 'on') w.done++
    byWeek.set(monday, w)
  }
  let count = 0
  for (const { done, paused } of byWeek.values()) {
    const soll = effectiveTarget(target, paused)
    if (soll > 0 && done >= soll) count++
  }
  return count
}

/**
 * Was ein Ausrutscher gerade kosten würde — die Zahl, die im Moment der
 * Versuchung fehlt, wenn man sie nur schätzt. Ohne Bewertung gilt „mittel“.
 */
export function slipCost(
  logs: LogEntry[],
  today = todayKey(),
  severity: Severity = 2,
): { from: number; to: number } {
  const raw = currentMomentumRaw(logs, today)
  const nach = raw + MOMENTUM.rate * (MOMENTUM.offTarget[severity] - raw)
  return {
    from: clamp(Math.round(raw), MOMENTUM.min, MOMENTUM.max),
    to: clamp(Math.round(nach), MOMENTUM.min, MOMENTUM.max),
  }
}

export function relapseLogs(logs: LogEntry[]): LogEntry[] {
  return logs.filter((l) => isRated(l) && !l.paused && !l.on_track)
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
