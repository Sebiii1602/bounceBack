import { useEffect, useRef, useState } from 'react'
import { addRecording } from '../lib/db'
import { copy } from '../lib/copy'
import { MAX_RECORDING_MS, fmtDuration, recorderOptions, recordingSupported } from '../lib/audio'

const BALKEN = 28

interface Laufend {
  recorder: MediaRecorder
  stream: MediaStream
  ctx: AudioContext
  timer: number
  start: number
}

/**
 * Aufnahme-Panel. Bewusst eine Zugabe: Abhaken geht immer ohne, und nichts
 * hier blockiert das Eintragen. Wer nach dem Üben noch Lust hat, drückt auf
 * Aufnehmen — wer nicht, hakt ab und ist in fünf Sekunden fertig.
 *
 * Die Aufnahme landet nur lokal (siehe `Recording` in types.ts).
 */
export function AudioRecorder({ habitId, date }: { habitId: string; date: string }) {
  const [laeuft, setLaeuft] = useState(false)
  const [ms, setMs] = useState(0)
  const [fehler, setFehler] = useState<string | null>(null)
  const [pegel, setPegel] = useState<number[]>(() => new Array<number>(BALKEN).fill(0))
  const ref = useRef<Laufend | null>(null)

  // Beim Verlassen der Seite läuft das Mikrofon sonst weiter
  useEffect(() => () => aufraeumen(), [])

  function aufraeumen(): void {
    const l = ref.current
    if (l === null) return
    window.clearInterval(l.timer)
    l.stream.getTracks().forEach((t) => t.stop())
    void l.ctx.close()
    ref.current = null
  }

  async function starten(): Promise<void> {
    setFehler(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, recorderOptions())
      const teile: Blob[] = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) teile.push(e.data)
      }
      const start = Date.now()
      recorder.onstop = () => {
        const dauer = Date.now() - start
        const blob = new Blob(teile, { type: recorder.mimeType || teile[0]?.type || 'audio/webm' })
        aufraeumen()
        setLaeuft(false)
        setMs(0)
        setPegel(new Array<number>(BALKEN).fill(0))
        // Unter ~0,4 s ist nichts drauf — meist ein Fehlgriff auf Stopp
        if (dauer > 400) void addRecording(habitId, date, blob, dauer)
      }

      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 512
      ctx.createMediaStreamSource(stream).connect(analyser)
      const daten = new Uint8Array(analyser.frequencyBinCount)

      const timer = window.setInterval(() => {
        analyser.getByteTimeDomainData(daten)
        let summe = 0
        for (const v of daten) summe += (v - 128) ** 2
        const rms = Math.sqrt(summe / daten.length) / 128
        setPegel((alt) => [...alt.slice(1), Math.min(1, rms * 3)])
        const vergangen = Date.now() - start
        setMs(vergangen)
        if (vergangen >= MAX_RECORDING_MS && recorder.state === 'recording') recorder.stop()
      }, 60)

      ref.current = { recorder, stream, ctx, timer, start }
      recorder.start(1000)
      setLaeuft(true)
    } catch {
      setFehler(copy.audio.denied)
    }
  }

  function stoppen(): void {
    const r = ref.current?.recorder
    if (r && r.state === 'recording') r.stop()
  }

  if (!recordingSupported()) {
    return <p className="text-xs text-faint">{copy.audio.unsupported}</p>
  }

  return (
    <div>
      {laeuft ? (
        <div className="rounded-xl border border-slip/25 bg-slip-soft px-3.5 py-3">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-2 text-sm font-medium text-slip-deep">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-slip" />
              {fmtDuration(ms)}
            </span>
            <span className="text-xs text-slip-deep/70">
              {copy.audio.maxLength(fmtDuration(MAX_RECORDING_MS))}
            </span>
          </div>
          <div className="mt-2.5 flex h-10 items-center gap-[2px]">
            {pegel.map((p, i) => (
              <div
                key={i}
                className="flex-1 rounded-full bg-slip"
                style={{ height: `${Math.max(6, p * 100)}%`, opacity: 0.35 + p * 0.65 }}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={stoppen}
            className="mt-2.5 w-full rounded-xl bg-slip-deep py-2.5 text-sm font-medium text-card transition active:scale-[0.98]"
          >
            {copy.audio.stop}
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void starten()}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-paper py-2.5 text-sm font-medium text-soft transition active:scale-[0.98]"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
          {copy.audio.record}
        </button>
      )}
      {fehler !== null && <p className="mt-2 text-xs text-slip-deep">{fehler}</p>}
    </div>
  )
}
