/* ==========================================================
   6. PUSH NOTIFICATIONS (FCM)
   ========================================================== */

const PUSH_SW_FILE = 'firebase-messaging-sw.js';
const PUSH_VAPID_STORAGE_KEY = 'ruchat_web_push_vapid_key';
const PUSH_FCM_TOKEN_STORAGE_KEY = 'ruchat_fcm_token';

let pushSwRegistrationPromise = null;
let pushForegroundHandlerBound = false;

function getCurrentSessionUser() {
  if (typeof username !== 'undefined' && username) return username;
  return window.username || '';
}

function getCurrentDeviceToken() {
  return localStorage.getItem('ruchat_device_token') || '';
}

function getDatabaseInstance() {
  if (window.db) return window.db;
  if (typeof db !== 'undefined') return db;
  return null;
}

function supportsPushMessaging() {
  return (
    typeof window !== 'undefined' &&
    typeof firebase !== 'undefined' &&
    firebase &&
    typeof firebase.messaging === 'function' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    window.isSecureContext === true
  );
}

function getPushVapidKey() {
  const fromWindow = typeof window.RUCHAT_WEB_PUSH_VAPID_KEY === 'string'
    ? window.RUCHAT_WEB_PUSH_VAPID_KEY.trim()
    : '';
  if (fromWindow) return fromWindow;
  const fromStorage = localStorage.getItem(PUSH_VAPID_STORAGE_KEY) || '';
  return String(fromStorage).trim();
}

function buildForegroundNotificationTag(data) {
  if (!data || typeof data !== 'object') return undefined;
  if (typeof data.chatId === 'string' && data.chatId) return `chat_${data.chatId}`;
  if (typeof data.groupId === 'string' && data.groupId) return `group_${data.groupId}`;
  return undefined;
}

async function ensurePushServiceWorkerRegistration() {
  if (!pushSwRegistrationPromise) {
    pushSwRegistrationPromise = navigator.serviceWorker.register(PUSH_SW_FILE, { scope: './' });
  }
  return pushSwRegistrationPromise;
}

function bindForegroundPushHandler(messaging) {
  if (pushForegroundHandlerBound) return;
  pushForegroundHandlerBound = true;

  messaging.onMessage((payload) => {
    try {
      const data = payload && payload.data ? payload.data : {};
      const notification = payload && payload.notification ? payload.notification : {};
      const title = notification.title || 'RuChat';
      const body = notification.body || 'New message';

      if (typeof showNotification === 'function') {
        showNotification(title, body, 'info');
      }
      if (typeof maybeShowSystemNotification === 'function') {
        maybeShowSystemNotification(title, body, {
          tag: buildForegroundNotificationTag(data),
          silent: false
        });
      }
    } catch (_) {
      // ignore
    }
  });
}

async function removeFcmTokenFromDatabase(user, deviceToken) {
  const database = getDatabaseInstance();
  if (!database || !user || !deviceToken) return;
  try {
    await database.ref(`accounts/${user}/devices/${deviceToken}`).update({
      fcmToken: null,
      fcmUpdatedAt: Date.now(),
      pushEnabled: false
    });
  } catch (_) {
    // ignore
  }
}

async function deleteKnownBrowserToken(messaging) {
  const knownToken = localStorage.getItem(PUSH_FCM_TOKEN_STORAGE_KEY);
  if (!knownToken) return;
  try {
    await messaging.deleteToken(knownToken);
  } catch (_) {
    // ignore
  }
  localStorage.removeItem(PUSH_FCM_TOKEN_STORAGE_KEY);
}

async function syncPushTokenForCurrentSession(options = {}) {
  const user = options.user || getCurrentSessionUser();
  const deviceToken = options.deviceToken || getCurrentDeviceToken();

  if (!user || !deviceToken) return { ok: false, reason: 'no_session' };
  if (!supportsPushMessaging()) return { ok: false, reason: 'unsupported' };
  if (localStorage.getItem('systemNotifications') === 'false') {
    await removePushTokenForCurrentSession({ user, deviceToken });
    return { ok: false, reason: 'disabled_by_settings' };
  }

  let permission = Notification.permission;
  if (options.askPermission === true && permission === 'default') {
    try {
      permission = await Notification.requestPermission();
    } catch (_) {
      permission = Notification.permission;
    }
  }

  if (permission !== 'granted') {
    await removeFcmTokenFromDatabase(user, deviceToken);
    return { ok: false, reason: 'permission_not_granted' };
  }

  const vapidKey = getPushVapidKey();
  if (!vapidKey || vapidKey.trim() === '' || vapidKey.includes('ЗАМЕНИТЕ') || vapidKey.includes('INSERT')) {
    // VAPID ключ не настроен - тихо отключаем push, не показываем ошибку в консоли
    await removeFcmTokenFromDatabase(user, deviceToken);
    return { ok: false, reason: 'missing_vapid_key' };
  }

  const database = getDatabaseInstance();
  if (!database) return { ok: false, reason: 'db_unavailable' };

  try {
    const registration = await ensurePushServiceWorkerRegistration();
    const messaging = firebase.messaging();
    bindForegroundPushHandler(messaging);

    const fcmToken = await messaging.getToken({
      vapidKey,
      serviceWorkerRegistration: registration
    });

    if (!fcmToken) {
      await removeFcmTokenFromDatabase(user, deviceToken);
      return { ok: false, reason: 'empty_token' };
    }

    await database.ref(`accounts/${user}/devices/${deviceToken}`).update({
      fcmToken,
      fcmUpdatedAt: Date.now(),
      pushEnabled: true
    });
    localStorage.setItem(PUSH_FCM_TOKEN_STORAGE_KEY, fcmToken);
    return { ok: true, token: fcmToken };
  } catch (error) {
    // Логируем только если это не ошибка аутентификации VAPID (401)
    const isAuthError = error && (
      String(error.code).includes('token-subscribe-failed') ||
      String(error.message).includes('401') ||
      String(error.message).includes('authentication')
    );
    
    if (!isAuthError) {
      console.warn('RuChat push: failed to sync token', error && error.message ? error.message : error);
    } else {
      // Тихая ошибка аутентификации - возможно VAPID ключ не соответствует проекту
      console.warn('RuChat push: VAPID authentication failed. Check if VAPID key matches your Firebase project.');
    }
    return { ok: false, reason: 'sync_failed' };
  }
}

async function removePushTokenForCurrentSession(options = {}) {
  const user = options.user || getCurrentSessionUser();
  const deviceToken = options.deviceToken || getCurrentDeviceToken();
  if (!user || !deviceToken) return { ok: false, reason: 'no_session' };

  try {
    if (typeof firebase !== 'undefined' && firebase && typeof firebase.messaging === 'function') {
      const messaging = firebase.messaging();
      await deleteKnownBrowserToken(messaging);
    } else {
      localStorage.removeItem(PUSH_FCM_TOKEN_STORAGE_KEY);
    }
  } catch (_) {
    localStorage.removeItem(PUSH_FCM_TOKEN_STORAGE_KEY);
  }

  await removeFcmTokenFromDatabase(user, deviceToken);
  return { ok: true };
}

window.syncPushTokenForCurrentSession = syncPushTokenForCurrentSession;
window.removePushTokenForCurrentSession = removePushTokenForCurrentSession;
