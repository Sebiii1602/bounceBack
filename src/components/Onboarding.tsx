import { useState } from 'react'
import { copy } from '../lib/copy'
import { Wordmark } from './ui'

/** Statische Demo der zwei Log-Buttons — nur Optik, nicht klickbar. */
function DemoButtons() {
  return (
    <div className="pointer-events-none grid w-full max-w-xs grid-cols-2 gap-2">
      <div className="rounded-xl border border-track/25 bg-track-soft py-3.5 text-center text-[15px] font-medium text-track-deep">
        {copy.today.onTrack}
      </div>
      <div className="rounded-xl border border-slip/25 bg-slip-soft py-3.5 text-center text-[15px] font-medium text-slip-deep">
        {copy.today.notYesterday}
      </div>
    </div>
  )
}

/** Statische Demo der Trigger-Chips + Special Day. */
function DemoChips() {
  return (
    <div className="pointer-events-none flex max-w-xs flex-wrap justify-center gap-2">
      <span className="rounded-full border border-ink bg-ink px-3 py-1.5 text-sm text-card">Gestresst</span>
      <span className="rounded-full border border-line bg-card px-3 py-1.5 text-sm text-soft">Einsam</span>
      <span className="rounded-full border border-line bg-card px-3 py-1.5 text-sm text-soft">Müde</span>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-special/25 bg-special-soft px-3 py-1.5 text-sm text-special-deep">
        <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" />
        </svg>
        Special Day
      </span>
    </div>
  )
}

/** Die Rebound-Kurve aus dem Konzept: runter, aufkommen, wieder hoch. */
function DemoCurve() {
  return (
    <svg className="w-48" viewBox="0 0 200 90" fill="none" aria-hidden="true">
      <path
        d="M10 18 C 45 70, 62 82, 88 82 C 116 82, 132 46, 178 22"
        stroke="var(--color-track)"
        strokeWidth="7"
        strokeLinecap="round"
      />
      <circle cx="182" cy="20" r="8" fill="var(--color-track)" />
    </svg>
  )
}

const steps = [
  { title: copy.onboarding.step1Title, body: copy.onboarding.step1Body, visual: <DemoCurve /> },
  { title: copy.onboarding.step2Title, body: copy.onboarding.step2Body, visual: <DemoButtons /> },
  { title: copy.onboarding.step3Title, body: copy.onboarding.step3Body, visual: <DemoChips /> },
]

/** Kurzes Intro beim ersten Start — drei Karten, dann nie wieder. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0)
  const last = step === steps.length - 1
  const current = steps[step]!

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-paper">
      <header
        className="mx-auto flex w-full max-w-md items-center justify-between px-6"
        style={{ paddingTop: 'calc(1.25rem + env(safe-area-inset-top))' }}
      >
        <Wordmark />
        {!last && (
          <button type="button" onClick={onDone} className="text-sm text-faint">
            {copy.onboarding.skip}
          </button>
        )}
      </header>

      <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-8 px-8 text-center">
        {current.visual}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{current.title}</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-soft">{current.body}</p>
        </div>
      </main>

      <footer
        className="mx-auto w-full max-w-md px-6"
        style={{ paddingBottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}
      >
        <div className="mb-4 flex justify-center gap-1.5">
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-5 bg-track' : 'w-1.5 bg-line'
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => (last ? onDone() : setStep(step + 1))}
          className="w-full rounded-xl bg-ink py-3 font-medium text-card transition active:scale-[0.99]"
        >
          {last ? copy.onboarding.start : copy.onboarding.next}
        </button>
      </footer>
    </div>
  )
}
