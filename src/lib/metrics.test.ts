import { describe, expect, it } from 'vitest'
import { MOMENTUM } from './config'
import {
  currentMomentum,
  goalPeriodPct,
  momentumAsRate,
  momentumChange,
  momentumSeriesFor,
  monthReview,
  periodPct,
  previousPeriodPct,
  currentRollingPct,
  momentumSeries,
  rollingSeries,
  tagStats,
  currentGoalMomentum,
  currentGoalPct,
  currentStreak,
  goalPerfectWeeks,
  lastSevenDays,
  perfectWeekCount,
  slipCost,
  weekGoalProgress,
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
    paused: false,
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

/** Pausiert: verletzt oder krank — zählt nirgends, bricht aber nichts ab. */
const mkPause = (date: string): LogEntry => ({ ...mkLog(date, false), paused: true })

describe('pausierte Tage', () => {
  it('zählen nicht in die 30-Tage-%', () => {
    const logs = [mkLog('2026-07-04', true), mkLog('2026-07-05', true)]
    expect(currentRollingPct(logs, 30, TODAY)).toBe(100)
    expect(currentRollingPct([...logs, mkPause(TODAY)], 30, TODAY)).toBe(100)
  })

  it('lassen das Momentum unverändert', () => {
    const logs = [mkLog('2026-07-05', true)]
    const vorher = currentMomentum(logs, TODAY)
    expect(currentMomentum([...logs, mkPause(TODAY)], TODAY)).toBe(vorher)
  })

  it('tauchen nicht in den Trigger-Mustern auf', () => {
    const logs = [mkLog('2026-07-04', false, ['Einsam']), mkPause('2026-07-05')]
    expect(weekdayStats(logs).reduce((s, w) => s + w.count, 0)).toBe(1)
  })

  it('überbrücken eine Serie, statt sie zu beenden', () => {
    // 3 on track, Pause, 4 on track = 7 Tage → trotz Unterbrechung eine Woche
    const logs = [
      mkLog('2026-06-29', true),
      mkLog('2026-06-30', true),
      mkLog('2026-07-01', true),
      mkPause('2026-07-02'),
      mkLog('2026-07-03', true),
      mkLog('2026-07-04', true),
      mkLog('2026-07-05', true),
      mkLog('2026-07-06', true),
    ]
    expect(perfectWeekCount(logs)).toBe(1)
    expect(currentStreak(logs, TODAY)).toBe(7)
  })

  it('ein echter Ausrutscher unterbricht dagegen weiterhin', () => {
    const logs = [
      mkLog('2026-06-29', true),
      mkLog('2026-06-30', true),
      mkLog('2026-07-01', true),
      mkLog('2026-07-02', false),
      mkLog('2026-07-03', true),
      mkLog('2026-07-04', true),
      mkLog('2026-07-05', true),
      mkLog('2026-07-06', true),
    ]
    expect(perfectWeekCount(logs)).toBe(0)
    expect(currentStreak(logs, TODAY)).toBe(4)
  })

  it('erscheinen als eigener Zustand im 7-Tage-Streifen', () => {
    expect(lastSevenDays([mkPause(TODAY)], TODAY)[6]!.state).toBe('paused')
  })
})

describe('Ziel-Habits (n-mal pro Woche)', () => {
  /** Mo 06.07. ist TODAY — diese Woche hat also erst einen Tag. */
  const inDieserWoche = (tage: string[]) => tage.map((d) => mkLog(d, true))

  it('rechnet die Erfüllung gegen das Ziel, nicht gegen alle Tage', () => {
    // 2x pro Woche, 2x da → 100 %, nicht 29 %
    const logs = inDieserWoche(['2026-07-05', '2026-07-06'])
    expect(currentGoalPct(logs, 2, TODAY)).toBe(100)
  })

  it('deckelt bei 100 %, wer mehr macht als nötig', () => {
    const logs = inDieserWoche(['2026-07-02', '2026-07-03', '2026-07-05', '2026-07-06'])
    expect(currentGoalPct(logs, 2, TODAY)).toBe(100)
  })

  it('zeigt Teilerfüllung ehrlich an', () => {
    expect(currentGoalPct(inDieserWoche(['2026-07-06']), 4, TODAY)).toBe(25)
  })

  it('zählt eine erreichte Kalenderwoche als perfekte Woche', () => {
    // Mo 29.06. – So 05.07.: zweimal da bei Ziel 2
    const logs = inDieserWoche(['2026-06-30', '2026-07-02'])
    expect(goalPerfectWeeks(logs, 2)).toBe(1)
    expect(goalPerfectWeeks(logs, 3)).toBe(0)
  })

  it('kürzt das Ziel um Pausentage — verletzt heißt nicht gescheitert', () => {
    // Fünf Tage verletzt, einmal da: Soll sinkt von 3 auf 1
    const logs = [
      mkPause('2026-07-01'),
      mkPause('2026-07-02'),
      mkPause('2026-07-03'),
      mkPause('2026-07-04'),
      mkPause('2026-07-05'),
      mkLog('2026-07-06', true),
    ]
    expect(currentGoalPct(logs, 3, TODAY)).toBe(100)
  })

  it('meldet den Stand der laufenden Woche', () => {
    expect(weekGoalProgress(inDieserWoche(['2026-07-06']), 3, TODAY)).toEqual({
      done: 1,
      target: 3,
    })
  })

  it('Momentum steigt bei erfülltem Ziel und bleibt nicht im Keller', () => {
    // 12 Wochen lang zweimal pro Woche
    const logs: LogEntry[] = []
    for (let w = 0; w < 12; w++) {
      logs.push(mkLog(shiftKey(TODAY, -(w * 7)), true))
      logs.push(mkLog(shiftKey(TODAY, -(w * 7 + 3)), true))
    }
    expect(currentGoalMomentum(logs, 2, TODAY)).toBeGreaterThan(90)
  })
})

describe('periodPct', () => {
  it('folgt dem gewählten Zeitraum statt immer 30 Tage zu nehmen', () => {
    // 60 Tage: die ersten 30 alle on track, die letzten 30 alle daneben
    const logs = Array.from({ length: 60 }, (_, i) =>
      mkLog(shiftKey(TODAY, i - 59), i < 30),
    )
    expect(periodPct(logs, null, 30, TODAY)).toBe(0)
    expect(periodPct(logs, null, 60, TODAY)).toBe(50)
  })

  it('vergleicht mit dem gleich langen Zeitraum davor', () => {
    const logs = Array.from({ length: 60 }, (_, i) =>
      mkLog(shiftKey(TODAY, i - 59), i < 30),
    )
    expect(previousPeriodPct(logs, null, 30, TODAY)).toBe(100)
  })

  it('gibt null zurück, solange der Zeitraum leer ist', () => {
    expect(periodPct([], null, 30, TODAY)).toBe(null)
  })

  it('rechnet Ziel-Habits gegen das Soll, nicht gegen die Tage', () => {
    // 2x pro Woche, 28 Tage, genau 8 Termine → Soll ist 8 → 100 %
    const tage = [0, 3, 7, 10, 14, 17, 21, 24].map((i) => mkLog(shiftKey(TODAY, i - 27), true))
    expect(goalPeriodPct(tage, 2, 28, TODAY)).toBe(100)
    // Dieselben Termine bei Ziel 4 reichen nur für die Hälfte
    expect(goalPeriodPct(tage, 4, 28, TODAY)).toBe(50)
  })

  it('kürzt das Soll um Pausentage', () => {
    const logs = [
      ...[0, 3, 7, 10].map((i) => mkLog(shiftKey(TODAY, i - 27), true)),
      ...Array.from({ length: 14 }, (_, i) => mkPause(shiftKey(TODAY, i - 13))),
    ]
    // Halbe Zeit verletzt → halbes Soll (2x in 14 nutzbaren Tagen = 4) → erfüllt
    expect(goalPeriodPct(logs, 2, 28, TODAY)).toBe(100)
  })
})

describe('momentumChange / momentumAsRate', () => {
  it('nennt die Bewegung der letzten sieben Tage', () => {
    // 20 Tage on track: der Wert klettert noch, ist also nicht schon bei 100
    const series = momentumSeriesFor(mkQuote(20, 1), null, TODAY)
    const delta = momentumChange(series, 7)
    expect(delta).not.toBe(null)
    expect(delta!).toBeGreaterThan(0)
  })

  it('verschweigt die Bewegung, solange die Reihe zu kurz ist', () => {
    const series = momentumSeriesFor([mkLog(TODAY, true)], null, TODAY)
    expect(momentumChange(series, 7)).toBe(null)
  })

  it('übersetzt Momentum zurück in eine Quote', () => {
    // Gegenprobe zur Gleichgewichtsrechnung aus config.ts: 83 ⇄ 80 %
    expect(momentumAsRate(83)).toBe(80)
    expect(momentumAsRate(MOMENTUM.offTarget[2])).toBe(0)
  })

  it('liegt für eine simulierte 80-%-Quote in der richtigen Größenordnung', () => {
    // Nicht auf den Punkt: Wo die Ausrutscher im Zeitraum liegen, verschiebt
    // den Endwert — die Aussage „ungefähr 80 %" muss trotzdem stimmen.
    const bei80 = currentMomentum(mkQuote(150, 0.8), TODAY)
    expect(momentumAsRate(bei80)).toBeGreaterThanOrEqual(75)
    expect(momentumAsRate(bei80)).toBeLessThanOrEqual(88)
  })

  it('bleibt in 0–100', () => {
    expect(momentumAsRate(0)).toBe(0)
    expect(momentumAsRate(100)).toBe(100)
  })
})

describe('monthReview', () => {
  const JULI = '2026-07'
  // Juni voll: 20 on track, 10 daneben. Juli bis zum 6.: 6 on track.
  const juni = Array.from({ length: 30 }, (_, i) => mkLog(shiftKey('2026-06-01', i), i < 20))
  const juli = Array.from({ length: 6 }, (_, i) => mkLog(shiftKey('2026-07-01', i), true))

  it('zählt nur Tage des Monats', () => {
    const r = monthReview([...juni, ...juli], JULI, null, TODAY)
    expect(r.onTrack).toBe(6)
    expect(r.slips).toBe(0)
    expect(r.pct).toBe(100)
  })

  it('markiert den laufenden Monat als Zwischenstand', () => {
    expect(monthReview([...juni, ...juli], JULI, null, TODAY).laufend).toBe(true)
    expect(monthReview([...juni, ...juli], '2026-06', null, TODAY).laufend).toBe(false)
  })

  it('vergleicht mit dem Vormonat', () => {
    const r = monthReview([...juni, ...juli], JULI, null, TODAY)
    expect(r.prevPct).toBe(67) // 20 von 30
  })

  it('hat keinen Vergleich, wenn der Vormonat leer ist', () => {
    expect(monthReview(juli, JULI, null, TODAY).prevPct).toBe(null)
  })

  it('zählt eine perfekte Woche in dem Monat, in dem sie voll wird', () => {
    // 27.06. bis 03.07. durchgehend on track — voll am 3. Juli
    const logs = Array.from({ length: 7 }, (_, i) => mkLog(shiftKey('2026-06-27', i), true))
    expect(monthReview(logs, '2026-07', null, TODAY).perfectWeeks).toBe(1)
    expect(monthReview(logs, '2026-06', null, TODAY).perfectWeeks).toBe(0)
  })

  it('führt eine Serie über den Monatswechsel hinweg weiter', () => {
    const logs = Array.from({ length: 10 }, (_, i) => mkLog(shiftKey('2026-06-29', i), true))
    // 29.06.–06.07. = 8 Tage bis heute, alle on track
    expect(monthReview(logs, '2026-07', null, TODAY).bestStreak).toBe(8)
  })

  it('nennt den häufigsten Trigger des Monats', () => {
    const logs = [
      mkLog('2026-07-01', false, ['Müde']),
      mkLog('2026-07-02', false, ['Müde']),
      mkLog('2026-07-03', false, ['Gestresst']),
      mkLog('2026-06-15', false, ['Gestresst', 'Gestresst']),
    ]
    expect(monthReview(logs, JULI, null, TODAY).topTag).toEqual({ label: 'Müde', count: 2 })
  })

  it('lässt Pausentage aus der Quote heraus', () => {
    const logs = [
      mkLog('2026-07-01', true),
      mkLog('2026-07-02', true),
      mkPause('2026-07-03'),
      mkPause('2026-07-04'),
    ]
    const r = monthReview(logs, JULI, null, TODAY)
    expect(r.pct).toBe(100)
    expect(r.paused).toBe(2)
    expect(r.gezaehlt).toBe(2)
  })

  it('bleibt bei einem Monat ohne Einträge leer statt bei 0 %', () => {
    expect(monthReview(juni, '2026-05', null, TODAY).pct).toBe(null)
  })
})
