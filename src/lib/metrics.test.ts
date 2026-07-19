import { describe, expect, it } from 'vitest'
import { MOMENTUM } from './config'
import {
  currentMomentum,
  currentRollingPct,
  momentumSeries,
  rollingSeries,
  tagStats,
  weekdayStats,
} from './metrics'
import type { LogEntry } from './types'

const TODAY = '2026-07-06' // ein Montag

function mkLog(date: string, onTrack: boolean, tags: string[] = [], special = false): LogEntry {
  return {
    id: `log-${date}`,
    habit_id: 'h1',
    date,
    on_track: onTrack,
    special,
    trigger_tags: tags,
    note: null,
    created_at: `${date}T12:00:00.000Z`,
    updated_at: `${date}T12:00:00.000Z`,
  }
}

describe('rollingSeries', () => {
  it('liefert null für Tage ohne geloggte Fenster', () => {
    const series = rollingSeries([], 30, 30, TODAY)
    expect(series).toHaveLength(30)
    expect(series.every((p) => p.pct === null)).toBe(true)
    expect(series[29]!.date).toBe(TODAY)
    expect(series[0]!.date).toBe('2026-06-07')
  })

  it('zählt nur geloggte Tage in den Nenner (3 on / 1 nicht = 75 %)', () => {
    const logs = [
      mkLog('2026-07-03', false),
      mkLog('2026-07-04', true),
      mkLog('2026-07-05', true),
      mkLog('2026-07-06', true),
    ]
    expect(currentRollingPct(logs, 30, TODAY)).toBe(75)
  })

  it('ignoriert Logs außerhalb des 30-Tage-Fensters', () => {
    // Fenster für 2026-07-06 umfasst 2026-06-07 bis 2026-07-06
    const logs = [
      mkLog('2026-06-06', false), // genau außerhalb
      mkLog('2026-06-07', true), // ältester Tag im Fenster
    ]
    expect(currentRollingPct(logs, 30, TODAY)).toBe(100)
  })

  it('bestraft Lücken nicht (2 geloggte Tage, 1 davon on track = 50 %)', () => {
    const logs = [mkLog('2026-06-20', true), mkLog('2026-07-01', false)]
    expect(currentRollingPct(logs, 30, TODAY)).toBe(50)
  })
})

describe('momentum', () => {
  it('startet bei 50 ohne Logs', () => {
    expect(currentMomentum([], TODAY)).toBe(MOMENTUM.start)
  })

  it('rechnet +2 pro on-track und −8 pro Ausrutscher', () => {
    const logs = [
      mkLog('2026-07-04', true),
      mkLog('2026-07-05', true),
      mkLog('2026-07-06', false),
    ]
    expect(currentMomentum(logs, TODAY)).toBe(50 + 2 + 2 - 8)
  })

  it('friert an nicht geloggten Tagen ein', () => {
    const logs = [mkLog('2026-07-01', true), mkLog('2026-07-06', true)]
    const series = momentumSeries(logs, TODAY)
    expect(series).toHaveLength(6)
    expect(series.map((p) => p.value)).toEqual([52, 52, 52, 52, 52, 54])
  })

  it('bleibt in den Grenzen 0–100 — nie ein Reset', () => {
    const manyBad: LogEntry[] = []
    for (let i = 0; i < 20; i++) {
      manyBad.push(mkLog(`2026-06-${String(10 + i).padStart(2, '0')}`, false))
    }
    expect(currentMomentum(manyBad, TODAY)).toBe(0)

    const manyGood: LogEntry[] = []
    for (let i = 1; i <= 30; i++) {
      manyGood.push(mkLog(`2026-06-${String(i).padStart(2, '0')}`, true))
    }
    expect(currentMomentum(manyGood, TODAY)).toBe(100)
  })
})

describe('special days', () => {
  it('zählen ganz normal als on track in Prozent und Momentum', () => {
    const logs = [
      mkLog('2026-07-04', true),
      mkLog('2026-07-05', true, [], true), // Special Day — Highlight, aber on track
      mkLog('2026-07-06', false),
    ]
    // 04. + 05. on, 06. nicht → 2 von 3 ≈ 67 %
    expect(currentRollingPct(logs, 30, TODAY)).toBe(67)
    expect(currentMomentum(logs, TODAY)).toBe(50 + 2 + 2 - 8)
  })

  it('tauchen nicht in den Trigger-Mustern auf (sie sind on track)', () => {
    const logs = [
      mkLog('2026-07-01', false, ['Einsam']),
      mkLog('2026-07-02', true, ['Freundin'], true), // Special — Tags nur fürs Erinnern
    ]
    const stats = tagStats(logs)
    expect(stats).toEqual([{ label: 'Einsam', count: 1, share: 1 }])
  })
})

describe('patterns', () => {
  it('zählt Trigger nur auf „Heute nicht“-Tagen', () => {
    const logs = [
      mkLog('2026-07-01', false, ['Einsam', 'Müde']),
      mkLog('2026-07-02', false, ['Einsam']),
      mkLog('2026-07-03', true, ['Gestresst']), // on track → zählt nicht
      mkLog('2026-07-04', false, []),
    ]
    const stats = tagStats(logs)
    expect(stats[0]).toEqual({ label: 'Einsam', count: 2, share: 2 / 3 })
    expect(stats[1]).toEqual({ label: 'Müde', count: 1, share: 1 / 3 })
    expect(stats.find((s) => s.label === 'Gestresst')).toBeUndefined()
  })

  it('ordnet Wochentage korrekt zu (Mo-basiert)', () => {
    const logs = [
      mkLog('2026-07-05', false), // Sonntag
      mkLog('2026-07-06', false), // Montag
      mkLog('2026-06-28', false), // Sonntag
    ]
    const stats = weekdayStats(logs)
    expect(stats[6]).toEqual({ weekday: 6, label: 'So', count: 2 })
    expect(stats[0]).toEqual({ weekday: 0, label: 'Mo', count: 1 })
    expect(stats.reduce((s, w) => s + w.count, 0)).toBe(3)
  })
})
