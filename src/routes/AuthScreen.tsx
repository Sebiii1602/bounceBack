import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { copy } from '../lib/copy'
import { Wordmark } from '../components/ui'

function mapError(err: unknown): string {
  const msg = err instanceof Error ? err.message : ''
  if (msg.includes('Invalid login credentials')) return copy.auth.errors.invalid
  if (msg.includes('Email not confirmed')) return copy.auth.errors.notConfirmed
  if (msg.includes('Password should be')) return copy.auth.errors.weakPassword
  return copy.auth.errors.generic
}

// text-base statt text-sm: unter 16px zoomt iOS beim Fokus unschön hinein
const inputCls =
  'w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-base outline-none focus:border-track'

type Mode = 'in' | 'up' | 'sent' | 'forgot' | 'forgot_sent'

export function AuthScreen() {
  const { signIn, signUp, requestPasswordReset } = useAuth()
  const [mode, setMode] = useState<Mode>('in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      if (mode === 'forgot') {
        await requestPasswordReset(email)
        setMode('forgot_sent')
      } else if (mode === 'in') {
        await signIn(email, password)
      } else {
        const result = await signUp(email, password)
        if (result === 'confirm_email') setMode('sent')
      }
    } catch (err) {
      setError(mapError(err))
    } finally {
      setBusy(false)
    }
  }

  const notice =
    mode === 'sent'
      ? { title: copy.auth.confirmSentTitle, body: copy.auth.confirmSentBody(email) }
      : mode === 'forgot_sent'
        ? { title: copy.auth.forgotSentTitle, body: copy.auth.forgotSentBody(email) }
        : null

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Wordmark className="text-3xl" />
          <p className="mt-2 text-sm text-soft">{copy.tagline}</p>
        </div>
        {notice ? (
          <div className="space-y-4 text-center">
            <h2 className="text-base font-semibold">{notice.title}</h2>
            <p className="text-sm text-soft">{notice.body}</p>
            <button
              type="button"
              onClick={() => setMode('in')}
              className="w-full rounded-xl border border-line py-2.5 text-sm font-medium"
            >
              {copy.auth.backToSignIn}
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            {mode === 'forgot' && (
              <div className="pb-1 text-center">
                <h2 className="text-base font-semibold">{copy.auth.forgotTitle}</h2>
                <p className="mt-1 text-sm text-soft">{copy.auth.forgotBody}</p>
              </div>
            )}
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={copy.auth.email}
              className={inputCls}
            />
            {mode !== 'forgot' && (
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={copy.auth.password}
                className={inputCls}
              />
            )}
            {error && <p className="text-sm text-slip-deep">{error}</p>}
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-xl bg-ink py-2.5 font-medium text-card transition disabled:opacity-50"
            >
              {mode === 'forgot'
                ? copy.auth.forgotSubmit
                : mode === 'in'
                  ? copy.auth.signIn
                  : copy.auth.signUp}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'forgot' ? 'in' : mode === 'in' ? 'up' : 'in')
                setError(null)
              }}
              className="w-full text-center text-sm font-medium text-track-deep"
            >
              {mode === 'forgot'
                ? copy.auth.backToSignIn
                : mode === 'in'
                  ? copy.auth.switchToSignUp
                  : copy.auth.switchToSignIn}
            </button>
            {mode === 'in' && (
              <button
                type="button"
                onClick={() => {
                  setMode('forgot')
                  setError(null)
                }}
                className="w-full text-center text-sm text-faint"
              >
                {copy.auth.forgotLink}
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  )
}
