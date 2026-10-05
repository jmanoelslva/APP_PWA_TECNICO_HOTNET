// Avisos de OS nova (Web Push) — carregado pelo service worker gerado pelo
// vite-plugin-pwa (workbox.importScripts em vite.config.ts). Quem manda o
// aviso é o backend (app/vigia_os.py); o conteúdo vem em JSON:
// { titulo, corpo, url, tag }.

self.addEventListener('push', (evento) => {
  let aviso = {}
  try {
    aviso = evento.data ? evento.data.json() : {}
  } catch {
    aviso = { corpo: evento.data ? evento.data.text() : '' }
  }
  evento.waitUntil(
    self.registration.showNotification(aviso.titulo || 'HOTNET', {
      body: aviso.corpo || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      // Mesma OS não empilha dois avisos.
      tag: aviso.tag || undefined,
      data: { url: aviso.url || '/' },
    }),
  )
})

// Tocar no aviso abre a OS: reaproveita o app já aberto, se houver.
self.addEventListener('notificationclick', (evento) => {
  evento.notification.close()
  const destino = new URL((evento.notification.data && evento.notification.data.url) || '/', self.location.origin).href
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      for (const janela of janelas) {
        if (new URL(janela.url).origin === self.location.origin && 'focus' in janela) {
          return janela.focus().then((focada) => (focada && 'navigate' in focada ? focada.navigate(destino) : focada))
        }
      }
      return self.clients.openWindow(destino)
    }),
  )
})
