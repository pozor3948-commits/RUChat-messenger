/* ==========================================================
   1. FIREBASE
   ========================================================== */
const firebaseConfig = {
  apiKey: "AIzaSyArPlbiw8QTUBsx88Vx3JJYzPo0mMcyi6s",
  authDomain: "ruchat-e1b0a.firebaseapp.com",
  databaseURL: "https://ruchat-e1b0a-default-rtdb.firebaseio.com",
  projectId: "ruchat-e1b0a",
  storageBucket: "ruchat-e1b0a.appspot.com",
  messagingSenderId: "868140400942",
  appId: "1:868140400942:web:7f09edac08c18766183abf"
};

// Set this to your Firebase Web Push certificate key (VAPID public key).
// Firebase Console -> Project Settings -> Cloud Messaging -> Web configuration.
// To get your VAPID key: Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
// IMPORTANT: Replace the empty string below with your actual VAPID key from Firebase Console.
// Until then, push notifications will be disabled (no errors will be shown).
if (typeof window.RUCHAT_WEB_PUSH_VAPID_KEY !== 'string') {
  window.RUCHAT_WEB_PUSH_VAPID_KEY = 'BOwBpDQUGXgTtFQYoXVq_8z6bkQlDxYGueTJDodv3HC0E0dhoeMKICphcaDAzNpOFW-v_U-s0q5T5aip3wt3Gu4';
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
