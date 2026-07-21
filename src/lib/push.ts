import { VAPID_PUBLIC_KEY } from './config'
import { supabase } from './supabase'

/**
 * Sanfte tägliche Erinnerung per Web Push. Auf dem iPhone funktioniert das
 * nur in der installierten PWA (Home-Bildschirm, iOS 16.4+) — im normalen
 * Safari-Tab existiert `PushManager` dort gar nicht.
 */
export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

export async function getReminderHour(): Promise<number | null> {
  if (!pushSupported() || !supabase) return null
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return null
  const { data } = await supabase
    .from('push_subscriptions')
    .select('hour')
    .eq('endpoint', sub.endpoint)
    .maybeSingle()
  return (data?.hour as number | undefined) ?? null
}

export async function enableReminder(hour: number): Promise<'ok' | 'denied'> {
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return 'denied'
  const reg = await navigator.serviceWorker.ready
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    }))
  const { error } = await supabase!
    .from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, subscription: sub.toJSON(), hour }, { onConflict: 'endpoint' })
  if (error) throw error
  return 'ok'
}

export async function updateReminderHour(hour: number): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase!.from('push_subscriptions').update({ hour }).eq('endpoint', sub.endpoint)
}

export async function disableReminder(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return
  await supabase!.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
