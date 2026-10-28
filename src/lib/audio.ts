/** Längste Aufnahme — danach stoppt die App von selbst. */
export const MAX_RECORDING_MS = 5 * 60 * 1000

/**
 * Opus bei 32 kbit/s: Für Gitarre völlig ausreichend und klein genug, dass
 * fünf Minuten rund 1,2 MB belegen. Ein Jahr täglich üben passt damit bequem
 * in den Browser-Speicher.
 */
const BITRATE = 32_000

const KANDIDATEN = [
  'audio/webm;codecs=opus',
  'audio/webm',
  // Safari kann kein WebM, liefert aber AAC in MP4
  'audio/mp4;codecs=mp4a.40.2',
  'audio/mp4',
]

/** Erstes Format, das dieser Browser aufnehmen kann — '' heißt „nimm deins". */
export function pickMimeType(): string {
  if (typeof MediaRecorder === 'undefined') return ''
  return KANDIDATEN.find((t) => MediaRecorder.isTypeSupported(t)) ?? ''
}

export function recordingSupported(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    navigator.mediaDevices !== undefined &&
    typeof navigator.mediaDevices.getUserMedia === 'function'
  )
}

export function recorderOptions(): MediaRecorderOptions {
  const mimeType = pickMimeType()
  return mimeType === '' ? { audioBitsPerSecond: BITRATE } : { mimeType, audioBitsPerSecond: BITRATE }
}

/** „4:07" — Dauer in Minuten und Sekunden. */
export function fmtDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

/** „1,2 MB" — Speicherbedarf in der Größenordnung, die gerade passt. */
export function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

/** „2:14 h" bzw. „37 min" — Gesamtlänge eines Archivs. */
export function fmtArchiveLength(ms: number): string {
  const minuten = Math.round(ms / 60000)
  if (minuten < 60) return `${minuten} min`
  return `${Math.floor(minuten / 60)}:${String(minuten % 60).padStart(2, '0')} h`
}
