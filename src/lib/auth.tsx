import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { onSignedIn } from './sync'

interface AuthValue {
  /** false = lokaler Modus ohne Supabase-Keys */
  cloud: boolean
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<'ok' | 'confirm_email'>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(supabase !== null)

  useEffect(() => {
    if (!supabase) return
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session) void onSignedIn(data.session)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'SIGNED_IN' && s) void onSignedIn(s)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function signIn(email: string, password: string): Promise<void> {
    const { error } = await supabase!.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  /**
   * Funktioniert mit und ohne „Confirm email“ in Supabase:
   * kommt eine Session zurück, ist man direkt drin; sonst wartet
   * eine Bestätigungs-Mail im Postfach.
   */
  async function signUp(email: string, password: string): Promise<'ok' | 'confirm_email'> {
    const { data, error } = await supabase!.auth.signUp({ email, password })
    if (error) throw error
    return data.session ? 'ok' : 'confirm_email'
  }

  async function signOut(): Promise<void> {
    await supabase!.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ cloud: supabase !== null, session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth außerhalb des AuthProviders')
  return value
}
