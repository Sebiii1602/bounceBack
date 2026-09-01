import { describe, expect, it } from 'vitest'
import { MOMENTUM } from './config'
import {
  currentMomentum,
  currentRollingPct,
  momentumSeries,
  rollingSeries,
  tagStats,
  currentStreak,
  lastSevenDays,
  perfectWeekCount,
  slipCost,
  weekdayStats,
} from './metrics'
import { shiftKey } from './dates'
import type { LogEntry } from './types'

const TODAY = '2026-07-06' // ein Montag

/** Nur notiert, noch nicht bewertet — hält Notiz/Trigger fest, zählt aber nirgends mit. */
const mkUnrated = (date: string, tags: string[] = []): LogEntry => ({
  ...mkLog(date, false, tags),
  rated: false,
})

function mkLog(
  date: string,
  onTrack: boolean,
  tags: string[] = [],
  special = false,
  severity: LogEntry['severity'] = null,
): LogEntry {
  return {
    id: `log-${date}`,
    habit_id: 'h1',
    date,
    rated: true,
    on_track: onTrack,
    special,
    severity,
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

/** `days` Tage mit gleichmäßig verteilter On-track-Quote, endend an TODAY. */
function mkQuote(days: number, quote: number, severity: LogEntry['severity'] = null): LogEntry[] {
  return Array.from({ length: days }, (_, i) => {
    const on = Math.floor((i + 1) * quote) > Math.floor(i * quote)
    return mkLog(shiftKey(TODAY, i - days + 1), on, [], false, on ? null : severity)
  })
}

describe('momentum', () => {
  it('startet bei 50 ohne Logs', () => {
    expect(currentMomentum([], TODAY)).toBe(MOMENTUM.start)
  })

  it('zieht pro Tag ein Zehntel Richtung Tageswert', () => {
    // 50 → 55 → 59,5 → 55,05
    const logs = [
      mkLog('2026-07-04', true),
      mkLog('2026-07-05', true),
      mkLog('2026-07-06', false),
    ]
    expect(currentMomentum(logs, TODAY)).toBe(55)
  })

  it('friert an nicht geloggten Tagen ein', () => {
    const logs = [mkLog('2026-07-01', true), mkLog('2026-07-06', true)]
    const series = momentumSeries(logs, TODAY)
    expect(series).toHaveLength(6)
    expect(series.map((p) => p.value)).toEqual([55, 55, 55, 55, 55, 60])
  })

  it('gewichtet Ausrutscher nach Stärke — leicht zieht weniger tief als deutlich', () => {
    const stand = (severity: LogEntry['severity']) =>
      currentMomentum([mkLog(TODAY, false, [], false, severity)], TODAY)
    expect(stand(1)).toBeGreaterThan(stand(2))
    expect(stand(2)).toBeGreaterThan(stand(3))
    expect(stand(null)).toBe(stand(2)) // unbewertet zählt wie mittel
  })

  it('Stärke ändert nichts an der 30-Tage-% — die bleibt binär', () => {
    const logs = [mkLog('2026-07-05', true), mkLog('2026-07-06', false, [], false, 3)]
    expect(currentRollingPct(logs, 30, TODAY)).toBe(50)
  })

  it('bleibt immer zwischen 0 und 100', () => {
    for (const logs of [mkQuote(200, 1), mkQuote(200, 0, 3), mkQuote(200, 0.5)]) {
      for (const p of momentumSeries(logs, TODAY)) {
        expect(p.value).toBeGreaterThanOrEqual(MOMENTUM.min)
        expect(p.value).toBeLessThanOrEqual(MOMENTUM.max)
      }
    }
  })

  it('pendelt sich dort ein, wo die Quote liegt — kein Absturz bei guten 80 %', () => {
    // Der eigentliche Grund für die Umstellung: die alte Formel hatte einen
    // Kipppunkt bei 83 % und schickte 80 % unaufhaltsam auf 0.
    const bei80 = currentMomentum(mkQuote(150, 0.8), TODAY)
    expect(bei80).toBeGreaterThan(75)
    expect(bei80).toBeLessThan(90)
  })

  it('ordnet bessere Quoten höher ein', () => {
    const bei = (q: number) => currentMomentum(mkQuote(150, q), TODAY)
    expect(bei(0.9)).toBeGreaterThan(bei(0.8))
    expect(bei(0.8)).toBeGreaterThan(bei(0.6))
    expect(bei(0.6)).toBeGreaterThan(bei(0.4))
  })

  it('erholt sich aus dem Tief schneller als es oben weiter steigt', () => {
    const zuwachs = (start: LogEntry[]) => {
      const vorher = currentMomentum(start, shiftKey(TODAY, -1))
      return currentMomentum([...start, mkLog(TODAY, true)], TODAY) - vorher
    }
    const tief = zuwachs(mkQuote(60, 0, 3).slice(0, -1))
    const hoch = zuwachs(mkQuote(60, 1).slice(0, -1))
    expect(tief).toBeGreaterThan(hoch)
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
    expect(currentMomentum(logs, TODAY)).toBe(55)
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

describe('unbewertete Notiz-Einträge', () => {
  it('zählen nicht in die 30-Tage-%', () => {
    const rated = [mkLog('2026-07-04', true), mkLog('2026-07-05', true)]
    expect(currentRollingPct(rated, 30, TODAY)).toBe(100)
    // Die Notiz zum laufenden Tag darf die Quote nicht auf 67 % drücken
    expect(currentRollingPct([...rated, mkUnrated(TODAY, ['Gestresst'])], 30, TODAY)).toBe(100)
  })

  it('lassen das Momentum unverändert', () => {
    const rated = [mkLog('2026-07-05', true)]
    const before = currentMomentum(rated, TODAY)
    expect(currentMomentum([...rated, mkUnrated(TODAY)], TODAY)).toBe(before)
  })

  it('starten die Momentum-Kurve nicht früher', () => {
    const logs = [mkUnrated('2026-06-01'), mkLog('2026-07-05', true)]
    expect(momentumSeries(logs, TODAY)[0]!.date).toBe('2026-07-05')
  })

  it('tauchen nicht in den Trigger-Mustern auf', () => {
    const logs = [mkLog('2026-07-04', false, ['Einsam']), mkUnrated('2026-07-05', ['Alkohol'])]
    expect(tagStats(logs)).toEqual([{ label: 'Einsam', count: 1, share: 1 }])
    expect(weekdayStats(logs).reduce((s, w) => s + w.count, 0)).toBe(1)
  })

  it('werden beim Bewerten zum normalen Eintrag (Notiz bleibt)', () => {
    const journal = mkUnrated('2026-07-05', ['Gestresst'])
    const nachBewertung: LogEntry = { ...journal, rated: true, on_track: false }
    expect(tagStats([nachBewertung])).toEqual([{ label: 'Gestresst', count: 1, share: 1 }])
  })
})

describe('perfekte Wochen', () => {
  /** `n` Tage am Stück on track, endend am 05.07. (Sonntag) */
  const serie = (n: number, on = true): LogEntry[] =>
    Array.from({ length: n }, (_, i) => mkLog(shiftKey('2026-07-05', i - n + 1), on))

  it('zählt sieben Tage am Stück — egal an welchem Wochentag sie starten', () => {
    // Di 30.06. bis Mo 06.07., quer über das Wochenende
    const quer = Array.from({ length: 7 }, (_, i) => mkLog(shiftKey('2026-06-30', i), true))
    expect(perfectWeekCount(quer)).toBe(1)
  })

  it('zählt sechs Tage noch nicht', () => {
    expect(perfectWeekCount(serie(6))).toBe(0)
  })

  it('rundet ab: 13 Tage sind eine Woche, 14 sind zwei', () => {
    expect(perfectWeekCount(serie(13))).toBe(1)
    expect(perfectWeekCount(serie(14))).toBe(2)
  })

  it('ein Ausrutscher mittendrin unterbricht die Serie', () => {
    const logs = serie(8)
    logs[3] = { ...logs[3]!, on_track: false }
    expect(perfectWeekCount(logs)).toBe(0)
  })

  it('eine Lücke unterbricht genauso — der Tag ist schlicht unbekannt', () => {
    const logs = serie(8).filter((l) => l.date !== '2026-07-01')
    expect(perfectWeekCount(logs)).toBe(0)
  })

  it('zählt nur bewertete Tage — eine reine Notiz reicht nicht', () => {
    const logs = serie(7)
    logs[2] = { ...logs[2]!, rated: false }
    expect(perfectWeekCount(logs)).toBe(0)
  })

  it('geht nie runter: schlechte Tage danach nehmen nichts weg', () => {
    const danach = [mkLog('2026-07-06', false), mkLog('2026-07-07', false)]
    expect(perfectWeekCount([...serie(7), ...danach])).toBe(1)
  })

  it('summiert getrennte Serien', () => {
    const frueh = Array.from({ length: 7 }, (_, i) => mkLog(shiftKey('2026-06-01', i), true))
    expect(perfectWeekCount([...frueh, ...serie(7)])).toBe(2)
  })
})

describe('currentStreak', () => {
  it('zählt die Tage am Stück bis heute', () => {
    const logs = [mkLog('2026-07-04', true), mkLog('2026-07-05', true), mkLog('2026-07-06', true)]
    expect(currentStreak(logs, TODAY)).toBe(3)
  })

  it('zählt ab gestern weiter, wenn heute noch nicht bewertet ist', () => {
    const logs = [mkLog('2026-07-04', true), mkLog('2026-07-05', true)]
    expect(currentStreak(logs, TODAY)).toBe(2)
    // Eine reine Notiz für heute ändert daran nichts
    expect(currentStreak([...logs, mkUnrated(TODAY)], TODAY)).toBe(2)
  })

  it('endet an einem Ausrutscher', () => {
    const logs = [mkLog('2026-07-04', false), mkLog('2026-07-05', true), mkLog('2026-07-06', true)]
    expect(currentStreak(logs, TODAY)).toBe(2)
  })

  it('endet an einer Lücke', () => {
    const logs = [mkLog('2026-07-03', true), mkLog('2026-07-06', true)]
    expect(currentStreak(logs, TODAY)).toBe(1)
  })

  it('ist 0, wenn der letzte bewertete Tag ein Ausrutscher war', () => {
    expect(currentStreak([mkLog('2026-07-06', false)], TODAY)).toBe(0)
  })
})

describe('lastSevenDays', () => {
  it('liefert sieben Tage, heute zuletzt', () => {
    const days = lastSevenDays([], TODAY)
    expect(days).toHaveLength(7)
    expect(days[0]!.date).toBe('2026-06-30')
    expect(days[6]!.date).toBe(TODAY)
    expect(days.every((d) => d.state === 'none')).toBe(true)
  })

  it('unterscheidet on / off / kein Eintrag', () => {
    const logs = [mkLog('2026-07-05', true), mkLog('2026-07-06', false)]
    const states = lastSevenDays(logs, TODAY).map((d) => d.state)
    expect(states.slice(5)).toEqual(['on', 'off'])
    expect(states.slice(0, 5).every((s) => s === 'none')).toBe(true)
  })
})

describe('slipCost', () => {
  it('zeigt den echten Abzug statt einer Schätzung', () => {
    const logs = [mkLog('2026-07-05', true)] // Momentum 55
    expect(slipCost(logs, TODAY)).toEqual({ from: 55, to: 51 })
  })

  it('ein deutlicher Ausrutscher kostet mehr als ein leichter', () => {
    const logs = [mkLog('2026-07-05', true)]
    expect(slipCost(logs, TODAY, 3).to).toBeLessThan(slipCost(logs, TODAY, 2).to)
    expect(slipCost(logs, TODAY, 2).to).toBeLessThan(slipCost(logs, TODAY, 1).to)
  })

  it('kostet oben mehr als unten — unten gibt es kaum noch etwas zu verlieren', () => {
    const oben = slipCost(mkQuote(150, 1), TODAY)
    const unten = slipCost(mkQuote(150, 0, 3), TODAY)
    expect(oben.from - oben.to).toBeGreaterThan(unten.from - unten.to)
  })

  it('bleibt in den Grenzen 0–100', () => {
    const { from, to } = slipCost(mkQuote(150, 0, 3), TODAY, 3)
    expect(to).toBeGreaterThanOrEqual(0)
    expect(from).toBeLessThanOrEqual(100)
  })
})
