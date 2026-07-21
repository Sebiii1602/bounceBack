import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { copy } from '../lib/copy'
import { Wordmark } from '../components/ui'

/** Erscheint, wenn die App über einen „Passwort zurücksetzen“-Link geöffnet wurde. */
export function NewPasswordScreen() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await updatePassword(password)
    } catch (err) {
      const msg = err instanceof Error ? err.message : ''
      setError(msg.includes('Password should be') ? copy.auth.errors.weakPassword : copy.auth.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Wordmark className="text-3xl" />
          <p className="mt-2 text-sm text-soft">{copy.auth.newPasswordTitle}</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            required
            autoFocus
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={copy.auth.newPasswordPlaceholder}
            className="w-full rounded-xl border border-line bg-card px-3.5 py-2.5 text-base outline-none focus:border-track"
          />
          {error && <p className="text-sm text-slip-deep">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-ink py-2.5 font-medium text-card transition disabled:opacity-50"
          >
            {copy.auth.newPasswordSubmit}
          </button>
        </form>
      </div>
    </div>
  )
}
