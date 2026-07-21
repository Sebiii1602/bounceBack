// Edge Function „send-reminders“ — wird stündlich von pg_cron angestoßen
// und schickt allen Abos, deren Wunsch-Stunde (Europe/Berlin) gerade ist,
// eine sanfte Web-Push-Erinnerung. Kein Guilt-Tripping, nur ein Check-in.
//
// Benötigte Secrets (Dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, CRON_SECRET
// SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY stellt Supabase automatisch bereit.
// Wichtig: Beim Deploy „Verify JWT“ AUSschalten — Auth läuft über x-cron-secret.

import webpush from 'npm:web-push@3.6.7'

Deno.serve(async (req) => {
  const secret = Deno.env.get('CRON_SECRET')
  if (!secret || req.headers.get('x-cron-secret') !== secret) {
    return new Response('forbidden', { status: 403 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  webpush.setVapidDetails(
    'mailto:sebi.sydow@gmail.com',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  // Alle Nutzer sind (Stand jetzt) in Deutschland — Wunsch-Stunde in Berlin-Zeit
  const hourBerlin = Number(
    new Intl.DateTimeFormat('de-DE', {
      hour: 'numeric',
      hour12: false,
      timeZone: 'Europe/Berlin',
    }).format(new Date()),
  )

  const res = await fetch(
    `${supabaseUrl}/rest/v1/push_subscriptions?hour=eq.${hourBerlin}&select=endpoint,subscription`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
  )
  const subs: Array<{ endpoint: string; subscription: unknown }> = await res.json()

  let sent = 0
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        sub.subscription as Parameters<typeof webpush.sendNotification>[0],
        JSON.stringify({ title: 'bounceBack', body: 'Kurzer Check-in: Wie war gestern?' }),
      )
      sent++
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode
      // 404/410 = Abo existiert nicht mehr (App gelöscht, Berechtigung entzogen) → aufräumen
      if (status === 404 || status === 410) {
        await fetch(
          `${supabaseUrl}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(sub.endpoint)}`,
          { method: 'DELETE', headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } },
        )
      }
    }
  }

  return new Response(JSON.stringify({ hour: hourBerlin, matched: subs.length, sent }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
