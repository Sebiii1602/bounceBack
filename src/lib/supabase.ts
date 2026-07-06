import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/**
 * `null`, solange keine Supabase-Keys in `.env.local` stehen —
 * die App läuft dann vollständig lokal (siehe README).
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null
