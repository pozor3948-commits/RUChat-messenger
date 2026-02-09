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
firebase.initializeApp(firebaseConfig);
const db = firebase.database();