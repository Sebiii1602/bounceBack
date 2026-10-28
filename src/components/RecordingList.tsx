import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, deleteRecording, renameRecording } from '../lib/db'
import { copy } from '../lib/copy'
import { fmtClock, fmtDayShort } from '../lib/dates'
import { fmtArchiveLength, fmtBytes, fmtDuration } from '../lib/audio'
import type { Recording } from '../lib/types'

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="rounded-md p-1.5 text-faint transition hover:bg-paper hover:text-ink"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}

function Eintrag({
  r,
  url,
  zeigeDatum,
}: {
  r: Recording
  url: string
  zeigeDatum: boolean
}) {
  const [edit, setEdit] = useState<string | null>(null)

  return (
    <li className="rounded-xl bg-paper px-3 py-2.5">
      <div className="flex items-center gap-2">
        {edit === null ? (
          <>
            <span className="min-w-0 flex-1 truncate text-sm">
              {r.label ?? copy.audio.untitled(fmtClock(r.created_at))}
            </span>
            <span className="shrink-0 text-xs text-faint">
              {zeigeDatum && `${fmtDayShort(r.date)} · `}
              {fmtDuration(r.duration_ms)}
            </span>
            <IconButton label={copy.audio.rename} onClick={() => setEdit(r.label ?? '')}>
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </IconButton>
            <IconButton
              label={copy.common.delete}
              onClick={() => {
                if (window.confirm(copy.audio.deleteConfirm)) void deleteRecording(r.id)
              }}
            >
              <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
            </IconButton>
          </>
        ) : (
          <form
            className="flex flex-1 gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              void renameRecording(r.id, edit)
              setEdit(null)
            }}
          >
            <input
              autoFocus
              value={edit}
              onChange={(e) => setEdit(e.target.value)}
              placeholder={copy.audio.titlePlaceholder}
              className="min-w-0 flex-1 rounded-lg border border-line bg-card px-2 py-1 text-sm text-ink outline-none"
            />
            <button type="submit" className="text-sm font-medium text-track-deep">
              {copy.common.save}
            </button>
          </form>
        )}
      </div>
      {/* Native Steuerung: Spulen ist bei fünf Minuten Gitarre das Wichtigste */}
      <audio src={url} controls preload="none" className="mt-2 h-8 w-full" />
    </li>
  )
}

/**
 * Das hörbare Archiv. Es ist der eigentliche Grund, überhaupt aufzunehmen:
 * Fortschritt am Instrument merkt man nicht von Tag zu Tag, sondern wenn man
 * den ersten Versuch von vor drei Monaten nochmal hört.
 */
export function RecordingList({
  habitId,
  date,
  stats = false,
}: {
  habitId: string
  /** Nur die Aufnahmen dieses Tages — sonst das ganze Archiv. */
  date?: string
  stats?: boolean
}) {
  const recordings = useLiveQuery(
    async () => {
      const rows =
        date === undefined
          ? await db.recordings.where('habit_id').equals(habitId).toArray()
          : await db.recordings.where('[habit_id+date]').equals([habitId, date]).toArray()
      return rows.sort((a, b) => b.created_at.localeCompare(a.created_at))
    },
    [habitId, date],
  )

  // Object-URLs pro Aufnahme zwischenspeichern: Würden sie bei jeder Änderung
  // neu entstehen, risse ein Umbenennen die gerade laufende Wiedergabe ab.
  const cache = useRef(new Map<string, string>())
  useEffect(() => {
    const ids = new Set((recordings ?? []).map((r) => r.id))
    for (const [id, url] of cache.current) {
      if (ids.has(id)) continue
      URL.revokeObjectURL(url)
      cache.current.delete(id)
    }
  }, [recordings])
  useEffect(() => {
    const m = cache.current
    return () => {
      for (const url of m.values()) URL.revokeObjectURL(url)
      m.clear()
    }
  }, [])

  function urlFor(r: Recording): string {
    let url = cache.current.get(r.id)
    if (url === undefined) {
      url = URL.createObjectURL(r.blob)
      cache.current.set(r.id, url)
    }
    return url
  }

  if (recordings === undefined) return null
  if (recordings.length === 0) {
    return (
      <p className="text-xs text-faint">{date === undefined ? copy.audio.none : copy.audio.noneDay}</p>
    )
  }

  const bytes = recordings.reduce((n, r) => n + r.blob.size, 0)
  const laenge = recordings.reduce((n, r) => n + r.duration_ms, 0)

  return (
    <div>
      {stats && (
        <p className="mb-2 text-xs text-faint">
          {copy.audio.archive(recordings.length, fmtArchiveLength(laenge), fmtBytes(bytes))}
        </p>
      )}
      <ul className="space-y-2">
        {recordings.map((r) => (
          <Eintrag key={r.id} r={r} url={urlFor(r)} zeigeDatum={date === undefined} />
        ))}
      </ul>
    </div>
  )
}
