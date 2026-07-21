/* Web-Push-Handler — wird per importScripts in den Workbox-Service-Worker geladen. */

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    /* Kein JSON? Dann Defaults. */
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'bounceBack', {
      body: data.body ?? 'Kurzer Check-in: Wie war gestern?',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      data: { url: data.url ?? '/' },
    }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus()
      }
      return clients.openWindow(url)
    }),
  )
})
