import { copy } from '../lib/copy'
import { fmtDayLong } from '../lib/dates'
import type { LogEntry } from '../lib/types'
import { Card } from './ui'

/** Farbe des Punkts links — dieselbe Sprache wie Kalender und Wochenstreifen. */
function dotClass(log: LogEntry): string {
  if (!log.rated) return 'bg-card border border-dashed border-faint'
  if (log.paused) return 'bg-rest-soft border border-rest/30'
  if (log.special) return 'bg-special-soft border border-special/30'
  return log.on_track ? 'bg-track-soft border border-track/30' : 'bg-slip-soft border border-slip/30'
}

/**
 * Alle Einträge mit Notiz oder Triggern, neueste zuerst. Bisher kam man an die
 * Notizen nur über den Kalender heran — Tag für Tag. Hier liest man sie als
 * das, was sie eigentlich sind: ein Tagebuch.
 */
export function JournalFeed({ logs }: { logs: LogEntry[] }) {
  const eintraege = logs
    .filter((l) => (l.note ?? '') !== '' || l.trigger_tags.length > 0)
    .sort((a, b) => b.date.localeCompare(a.date))

  if (eintraege.length === 0) {
    return (
      <Card>
        <p className="text-sm text-soft">{copy.history.journalEmpty}</p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {eintraege.map((log) => (
        <Card key={log.id}>
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass(log)}`} />
            <span className="text-xs text-faint">{fmtDayLong(log.date)}</span>
          </div>
          {log.note && <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{log.note}</p>}
          {log.trigger_tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {log.trigger_tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-line px-2 py-0.5 text-xs text-soft"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  )
}
