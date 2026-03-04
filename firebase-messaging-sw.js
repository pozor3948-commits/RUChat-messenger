/* global firebase, importScripts */

importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyArPlbiw8QTUBsx88Vx3JJYzPo0mMcyi6s',
  authDomain: 'web-messenger-1694a.firebaseapp.com',
  databaseURL: 'https://web-messenger-1694a-default-rtdb.firebaseio.com',
  projectId: 'web-messenger-1694a',
  storageBucket: 'web-messenger-1694a.appspot.com',
  messagingSenderId: '868140400942',
  appId: '1:868140400942:web:7f09edac08c18766183abf'
});

const messaging = firebase.messaging();

function getAppStartUrl(data) {
  const scopeUrl = new URL(self.registration.scope);
  const url = new URL(scopeUrl.pathname, self.location.origin);

  if (data && typeof data === 'object') {
    if (typeof data.kind === 'string' && data.kind) url.searchParams.set('kind', data.kind);
    if (typeof data.chatId === 'string' && data.chatId) url.searchParams.set('chatId', data.chatId);
    if (typeof data.groupId === 'string' && data.groupId) url.searchParams.set('groupId', data.groupId);
    if (typeof data.from === 'string' && data.from) url.searchParams.set('from', data.from);
  }

  return url.toString();
}

function getNotificationTag(data) {
  if (!data || typeof data !== 'object') return undefined;
  if (typeof data.chatId === 'string' && data.chatId) return `chat_${data.chatId}`;
  if (typeof data.groupId === 'string' && data.groupId) return `group_${data.groupId}`;
  if (typeof data.kind === 'string' && data.kind) return `kind_${data.kind}`;
  return undefined;
}

messaging.onBackgroundMessage((payload) => {
  const data = payload && payload.data ? payload.data : {};
  const notification = payload && payload.notification ? payload.notification : {};

  const title = notification.title || 'RuChat';
  const body = notification.body || 'You have a new message';
  const options = {
    body,
    data: {
      ...data,
      clickUrl: getAppStartUrl(data)
    },
    tag: getNotificationTag(data)
  };

  if (notification.icon) options.icon = notification.icon;
  if (notification.image) options.image = notification.image;

  return self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification && event.notification.data ? event.notification.data : {};
  const targetUrl = data.clickUrl || getAppStartUrl(data);

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if (!client || typeof client.focus !== 'function') continue;
      try {
        if (typeof client.postMessage === 'function') {
          client.postMessage({ type: 'ruchat_push_click', data });
        }
        await client.focus();
        if (typeof client.navigate === 'function' && targetUrl) {
          await client.navigate(targetUrl);
        }
        return;
      } catch (_) {
        // ignore and try next client
      }
    }
    if (clients.openWindow && targetUrl) {
      await clients.openWindow(targetUrl);
    }
  })());
});
