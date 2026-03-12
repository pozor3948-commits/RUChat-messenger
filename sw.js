/* ==========================================================
   RUCHAT SERVICE WORKER
   Service Worker для PWA приложения
   Версия: 2026-03-12
   ========================================================== */

const CACHE_NAME = 'ruchat-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/css/new-features.css',
  '/js/firebase-config.js',
  '/js/utils.js',
  '/js/main.js',
  '/js/ui.js',
  '/js/chat.js',
  '/js/auth.js',
  '/js/media.js',
  '/js/extended-features.js',
  '/js/advanced-features.js',
  '/js/media-features.js'
];

// Установка service worker
self.addEventListener('install', (event) => {
  console.log('[SW] Установка...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Кэширование статики');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log('[SW] Установка завершена');
        return self.skipWaiting();
      })
  );
});

// Активация service worker
self.addEventListener('activate', (event) => {
  console.log('[SW] Активация...');
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => caches.delete(name))
        );
      })
      .then(() => {
        console.log('[SW] Активация завершена');
        return self.clients.claim();
      })
  );
});

// Обработка запросов
self.addEventListener('fetch', (event) => {
  // Пропускаем Firebase запросы
  if (event.request.url.includes('firebaseio.com') ||
      event.request.url.includes('googleapis.com')) {
    return;
  }
  
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          return response;
        }
        return fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(event.request, responseClone);
                });
            }
            return networkResponse;
          })
          .catch(() => {
            // Офлайн страница
            if (event.request.mode === 'navigate') {
              return caches.match('/index.html');
            }
          });
      })
  );
});

// Фоновая синхронизация
self.addEventListener('sync', (event) => {
  console.log('[SW] Синхронизация:', event.tag);
  if (event.tag === 'send-message') {
    event.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Синхронизация отложенных сообщений
  console.log('[SW] Синхронизация сообщений...');
}

// Push уведомления
self.addEventListener('push', (event) => {
  console.log('[SW] Push получен');
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'RuChat', body: event.data.text() };
    }
  }
  
  const title = data.title || 'RuChat';
  const options = {
    body: data.body || 'Новое сообщение',
    icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22 fill=%22%230088cc%22>💬</text></svg>',
    badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22 fill=%22white%22>💬</text></svg>',
    vibrate: [100, 50, 100],
    data: data,
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'mute', title: 'Не беспокоить' }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Клик по уведомлению
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Клик по уведомлению');
  event.notification.close();
  
  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' })
        .then((clientList) => {
          for (let i = 0; i < clientList.length; i++) {
            const client = clientList[i];
            if (client.url === '/' && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow('/');
          }
        })
    );
  }
});

console.log('[SW] Service Worker загружен');
