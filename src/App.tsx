import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './lib/db'
import { AuthProvider, useAuth } from './lib/auth'
import { useSyncStatus, wireSyncEvents } from './lib/sync'
import { copy } from './lib/copy'
import { isPrivate, toggleRevealed, useRevealed } from './lib/privacy'
import { TabBar } from './components/TabBar'
import { Wordmark } from './components/ui'
import { Onboarding } from './components/Onboarding'
import { Today } from './routes/Today'
import { Trends } from './routes/Trends'
import { History } from './routes/History'
import { More } from './routes/More'
import { AuthScreen } from './routes/AuthScreen'
import { NewPasswordScreen } from './routes/NewPasswordScreen'

function SyncDot() {
  const { state } = useSyncStatus()
  if (state === 'disabled') return null
  const color =
    state === 'synced'
      ? 'bg-track'
      : state === 'syncing'
        ? 'animate-pulse bg-track'
        : state === 'error'
          ? 'bg-slip'
          : 'bg-faint'
  return <span className={`inline-block h-2 w-2 rounded-full ${color}`} title={state} />
}

/** Deckt private Habits für diese Sitzung auf — nur sichtbar, wenn es welche gibt. */
function PrivacyToggle() {
  const hatPrivate = useLiveQuery(
    async () => (await db.habits.toArray()).some(isPrivate),
    [],
    false,
  )
  const revealed = useRevealed()
  if (!hatPrivate) return null
  return (
    <button
      type="button"
      onClick={toggleRevealed}
      aria-label={revealed ? copy.common.hidePrivate : copy.common.showPrivate}
      className="rounded-md p-1 text-faint transition hover:text-ink"
    >
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {revealed ? (
          <>
            <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
            <circle cx="12" cy="12" r="3" />
          </>
        ) : (
          <>
            <path d="M3 3l18 18" />
            <path d="M10.6 6.2A9.9 9.9 0 0 1 12 6c6.5 0 10 6 10 6a16 16 0 0 1-3.1 3.8M6.2 7.4A16 16 0 0 0 2 12s3.5 6 10 6a9.6 9.6 0 0 0 3.6-.7" />
            <path d="M9.9 10.1a3 3 0 0 0 4.1 4.2" />
          </>
        )}
      </svg>
    </button>
  )
}

function Shell() {
  return (
    <div className="min-h-dvh">
      <header
        className="mx-auto flex w-full max-w-md items-center justify-between px-4"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <Wordmark />
        <div className="flex items-center gap-2">
          <PrivacyToggle />
          <SyncDot />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md px-4 pb-28 pt-4">
        <Routes>
          <Route path="/" element={<Today />} />
          <Route path="/trend" element={<Trends />} />
          <Route path="/verlauf" element={<History />} />
          <Route path="/mehr" element={<More />} />
          <Route path="*" element={<Today />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  )
}

function Gate() {
  const { cloud, session, loading, recovery } = useAuth()
  // undefined = lädt noch, null = noch nie gesehen, Zeile = erledigt
  const onboardingDone = useLiveQuery(async () => (await db.meta.get('onboarding_done')) ?? null, [])
  useEffect(() => {
    wireSyncEvents()
  }, [])
  if (cloud && loading) {
    return <div className="grid min-h-dvh place-items-center text-sm text-soft">{copy.common.loading}</div>
  }
  // Reset-Link geöffnet: erst neues Passwort setzen, dann normal weiter
  if (cloud && recovery) return <NewPasswordScreen />
  if (cloud && !session) return <AuthScreen />
  if (onboardingDone === null) {
    return <Onboarding onDone={() => void db.meta.put({ key: 'onboarding_done', value: '1' })} />
  }
  return <Shell />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </BrowserRouter>
  )
}
