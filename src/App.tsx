import { useEffect } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import { useSyncStatus, wireSyncEvents } from './lib/sync'
import { copy } from './lib/copy'
import { TabBar } from './components/TabBar'
import { Wordmark } from './components/ui'
import { Today } from './routes/Today'
import { Trends } from './routes/Trends'
import { History } from './routes/History'
import { More } from './routes/More'
import { AuthScreen } from './routes/AuthScreen'

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

function Shell() {
  return (
    <div className="min-h-dvh">
      <header
        className="mx-auto flex w-full max-w-md items-center justify-between px-4"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <Wordmark />
        <SyncDot />
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
  const { cloud, session, loading } = useAuth()
  useEffect(() => {
    wireSyncEvents()
  }, [])
  if (cloud && loading) {
    return <div className="grid min-h-dvh place-items-center text-sm text-soft">{copy.common.loading}</div>
  }
  if (cloud && !session) return <AuthScreen />
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
