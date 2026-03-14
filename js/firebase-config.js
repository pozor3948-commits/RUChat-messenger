/* ==========================================================
   1. FIREBASE
   ========================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyArPlbiw8QTUBsx88Vx3JJYzPo0mMcyi6s",
  authDomain: "web-messenger-1694a.firebaseapp.com",
  databaseURL: "https://web-messenger-1694a-default-rtdb.firebaseio.com",
  projectId: "web-messenger-1694a",
  storageBucket: "web-messenger-1694a.appspot.com",
  messagingSenderId: "868140400942",
  appId: "1:868140400942:web:7f09edac08c18766183abf"
};

// Set this to your Firebase Web Push certificate key (VAPID public key).
// Firebase Console -> Project Settings -> Cloud Messaging -> Web configuration.
// To get your VAPID key: Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
if (typeof window.RUCHAT_WEB_PUSH_VAPID_KEY !== 'string') {
  // Получите VAPID ключ из Firebase Console и вставьте его ниже
  window.RUCHAT_WEB_PUSH_VAPID_KEY = 'BKagKzZPFvZXZzJzYjY5YzY5YzY5YzY5YzY5YzY5YzY5YzY5YzY5YzY5YzY5YzY5YzY5YzY5YzY5YzY5YzY5YzY'; // ЗАМЕНИТЕ НА ВАШ КЛЮЧ
}

// В Android WebView и некоторых сетях WebSocket к RTDB часто режется/глючит.
// Длинный polling стабильнее (пусть и чуть медленнее).
try {
  const ua = (navigator.userAgent || '').toLowerCase();
  const isWebView = ua.includes('wv') || ua.includes('webview') || (ua.includes('android') && !ua.includes('chrome'));
  const forceLongPoll =
    (typeof location !== 'undefined' && /[?&](lp|longpoll)=1/.test(location.search || '')) ||
    (typeof localStorage !== 'undefined' && localStorage.getItem('ruchat_force_longpoll') === 'true');
  if (
    (isWebView || forceLongPoll) &&
    typeof firebase !== 'undefined' &&
    firebase &&
    firebase.database &&
    firebase.database.INTERNAL &&
    typeof firebase.database.INTERNAL.forceLongPolling === 'function'
  ) {
    firebase.database.INTERNAL.forceLongPolling();
  }
} catch {
  // ignore
}
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
window.db = db;
