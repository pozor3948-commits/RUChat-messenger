/* ==========================================================
   5. АВТОРИЗАЦИЯ
   ========================================================== */
function hashPassword(p) {
  let h = 0;
  for (let i = 0; i < p.length; i++) { h = ((h << 5) - h) + p.charCodeAt(i); h |= 0; }
  return h;
}

async function register() {
  if (!checkConnection()) return;
  showLoading();
  try {
    const u = document.getElementById("usernameInput").value.trim();
    const p = document.getElementById("passwordInput").value;
    if (!u || !p) throw new Error("Введите имя и пароль!");
    if (u.length < 3) throw new Error("Имя должно быть не менее 3 символов!");
    if (p.length < 6) throw new Error("Пароль должен быть не менее 6 символов!");
    const snap = await db.ref("accounts/" + u).get();
    if (snap.exists()) throw new Error("Пользователь уже существует!");
    const ts = Date.now();
    await db.ref("accounts/" + u).set({ 
      password: hashPassword(p), 
      friends: {}, 
      avatar: "", 
      displayName: u,
      about: "",
      friendRequests: { incoming: {}, outgoing: {} },
      blocked: {},
      chatBg: "", 
      stories: {}, 
      lastSeen: ts, 
      createdAt: ts, 
      chatThemes: {} 
    });
    showNotification("Успешно", "Регистрация прошла успешно!");
    // Возвращаем в режим входа (чтобы сразу можно было зайти)
    if (typeof applyAuthMode === 'function') applyAuthMode('login');
    document.getElementById("usernameInput").value = "";
    document.getElementById("passwordInput").value = "";
  } catch (e) {
    showError(e.message);
  } finally {
    hideLoading();
  }
}

async function doLoginAfterAuth(u, title, message) {
  username = u;
  window.username = username;
  if (localStorage.getItem('ruchat_autologin') === null) {
    localStorage.setItem('ruchat_autologin', 'true');
  }
  localStorage.setItem('ruchat_last_user', u);
  updateMyStatus(true, false);
  setupActivityTracking();
  setupUserStatusMonitoring();
  db.ref(`userStatus/${username}`).onDisconnect().set({ online: false, idle: false, lastSeen: Date.now(), username: username });
  document.getElementById("login").style.display = "none";
  document.getElementById("main").style.display = "flex";
  const safeName = typeof normalizeText === 'function' ? normalizeText(username) : username;
  document.getElementById("userName").textContent = safeName;
  document.getElementById("mobileChatTitle").textContent = safeName;
  document.getElementById("userStatus").textContent = "В сети";
  document.getElementById("userStatus").className = "user-status";
  const callBtn = document.getElementById('callButton');
  if (callBtn) {
    callBtn.classList.add('active');
    callBtn.style.display = 'flex';
  }
  loadFriends();
  loadGroups();
  loadStories();
  updateUserAvatar();
  if (typeof loadMyProfile === 'function') {
    loadMyProfile();
  }
  if (typeof loadFriendRequests === 'function') {
    loadFriendRequests();
  }
  if (typeof loadStickers === 'function') {
    loadStickers();
  }
  initEmojiPicker();
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
  if (typeof initSoundsAfterLogin === 'function') {
    initSoundsAfterLogin();
  }
  if (typeof listenForIncomingCalls === 'function') {
    listenForIncomingCalls();
  }
  if (typeof initVideoMessagesAfterLogin === 'function') {
    initVideoMessagesAfterLogin();
  }
  await registerDeviceToken(username);
  if (title && message) showNotification(title, message);
  checkMobile();
}

async function login() {
  if (!checkConnection()) return;
  showLoading();
  try {
    const u = document.getElementById("usernameInput").value.trim();
    const p = document.getElementById("passwordInput").value;
    if (!u || !p) throw new Error("Введите имя и пароль!");
    const snap = await db.ref("accounts/" + u).get();
    if (!snap.exists()) throw new Error("Пользователь не найден!");
    if (snap.val().password !== hashPassword(p)) throw new Error("Неверный пароль!");
    await doLoginAfterAuth(u, "Добро пожаловать", `Привет, ${u}!`);
  } catch (e) {
    showError(e.message, () => login());
  } finally {
    hideLoading();
  }
}

// ────────────────────────────────────────────────
//  UI: Переключение режимов Вход / Регистрация (экран авторизации)
// ────────────────────────────────────────────────
let authMode = 'login'; // 'login' | 'register'

function applyAuthMode(mode) {
  authMode = mode === 'register' ? 'register' : 'login';
  const title = document.getElementById('authTitle');
  const submit = document.getElementById('authSubmitBtn');
  const switchText = document.getElementById('authSwitchText');
  const switchLink = document.getElementById('authSwitchLink');
  const forgot = document.getElementById('authForgotBtn');

  if (title) title.textContent = authMode === 'register' ? 'РЕГИСТРАЦИЯ' : 'ВХОД';
  if (submit) {
    submit.textContent = authMode === 'register' ? 'СОЗДАТЬ АККАУНТ' : 'ВОЙТИ';
    submit.onclick = authMode === 'register' ? register : login;
  }
  if (switchText) switchText.textContent = authMode === 'register' ? 'Уже есть аккаунт?' : 'Нет аккаунта?';
  if (switchLink) switchLink.textContent = authMode === 'register' ? 'Войти' : 'Регистрация';
  if (forgot) forgot.style.display = authMode === 'register' ? 'none' : 'inline-flex';
}

function toggleAuthMode() {
  applyAuthMode(authMode === 'login' ? 'register' : 'login');
}

window.applyAuthMode = applyAuthMode;
window.toggleAuthMode = toggleAuthMode;

// Запоминание имени для входа
document.addEventListener('DOMContentLoaded', function() {
  const savedUser = localStorage.getItem('ruchat_last_user');
  if (savedUser) {
    const u = document.getElementById('usernameInput');
    if (u) u.value = savedUser;
  }

  // Инициализируем красивую форму авторизации
  if (document.getElementById('authSubmitBtn')) {
    applyAuthMode('login');
    const keep = document.getElementById('keepSignedIn');
    if (keep) {
      keep.checked = localStorage.getItem('ruchat_autologin') !== 'false';
      keep.addEventListener('change', () => {
        localStorage.setItem('ruchat_autologin', keep.checked ? 'true' : 'false');
      });
    }
    const pw = document.getElementById('passwordInput');
    if (pw) {
      pw.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const btn = document.getElementById('authSubmitBtn');
        if (btn) btn.click();
      });
    }
  }

  // Автовход на этом устройстве (если ранее входили)
  setTimeout(autoLoginFromDevice, 300);
});
function recoverPassword() {
  const u = prompt("Введите имя пользователя:");
  if (!u) return;
  showLoading();
  db.ref("accounts/" + u).get().then(async snap => {
    hideLoading();
    if (!snap.exists()) { showError("Пользователь не найден!"); return; }
    const adminCode = prompt("Введите код администратора:");
    if (adminCode !== "1234") { showError("Неверный код администратора!"); return; }
    const choice = prompt("Введите '1' чтобы задать новый пароль или '2' чтобы войти без пароля:");
    if (choice === "1") {
      const np = prompt("Введите новый пароль:");
      if (!np) { showError("Пароль не изменен!"); return; }
      showLoading();
      await db.ref("accounts/" + u + "/password").set(hashPassword(np));
      hideLoading();
      showNotification("Успешно", "Пароль успешно изменен!");
    } else if (choice === "2") {
      username = u;
      window.username = username;
      showLoading();
      await doLoginAfterAuth(u, "Вход выполнен", "Вы вошли без пароля!");
    }
  }).catch(e => { hideLoading(); showError("Ошибка загрузки данных пользователя"); });
}

function logout() {
  if (!confirm("Вы уверены, что хотите выйти?")) return;
  unregisterDeviceToken(username).catch(() => {});
  updateMyStatus(false, false);
  Object.keys(friendStatusListeners).forEach(f => {
    if (friendStatusListeners[f]) db.ref("userStatus/" + f).off('value', friendStatusListeners[f]);
  });
  friendStatusListeners = {};
  db.ref(`userStatus/${username}`).onDisconnect().cancel();
  document.getElementById('callButton').classList.remove('active');
  setTimeout(() => window.location.reload(), 500);
}

function updateUserAvatar() {
  db.ref("accounts/" + username + "/avatar").on("value", s => {
    const av = document.getElementById("userAvatar");
    const avTop = document.getElementById("userAvatarTop");
    const url = s.val();
    if (s.exists() && url && (typeof isValidMediaUrl !== 'function' || isValidMediaUrl(url))) {
      av.src = url;
      if (avTop) avTop.src = url;
    } else {
      av.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=0088cc&color=fff&size=44`;
      if (avTop) avTop.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=0088cc&color=fff&size=36`;
    }
  });
}

function loadMyProfile() {
  if (!username) return;
  db.ref("accounts/" + username).on("value", s => {
    if (!s.exists()) return;
    const data = s.val() || {};
    const displayName = typeof normalizeText === 'function' ? normalizeText(data.displayName || username) : (data.displayName || username);
    const userNameEl = document.getElementById("userName");
    if (userNameEl) userNameEl.textContent = displayName;
    if (!currentChatId) {
      const mobileTitle = document.getElementById("mobileChatTitle");
      if (mobileTitle) mobileTitle.textContent = displayName;
    }
    window.myProfile = data;
  });
}

function getDeviceToken() {
  let token = localStorage.getItem('ruchat_device_token');
  if (!token) {
    try {
      const arr = new Uint8Array(16);
      (crypto.getRandomValues || window.msCrypto.getRandomValues).call(crypto, arr);
      token = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
    } catch {
      token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    }
    localStorage.setItem('ruchat_device_token', token);
  }
  return token;
}

async function registerDeviceToken(u) {
  if (!u) return;
  const token = getDeviceToken();
  localStorage.setItem('ruchat_device_user', u);
  try {
    await db.ref(`accounts/${u}/devices/${token}`).set({
      createdAt: Date.now(),
      userAgent: navigator.userAgent || ''
    });
  } catch (e) {
    // ignore
  }
}

async function unregisterDeviceToken(u) {
  const token = localStorage.getItem('ruchat_device_token');
  const user = u || localStorage.getItem('ruchat_device_user');
  if (!token || !user) return;
  try {
    await db.ref(`accounts/${user}/devices/${token}`).remove();
  } catch (e) {
    // ignore
  }
  localStorage.removeItem('ruchat_device_user');
  localStorage.removeItem('ruchat_device_token');
}

window.unregisterDeviceToken = unregisterDeviceToken;

async function autoLoginFromDevice() {
  if (username) return;
  if (localStorage.getItem('ruchat_autologin') === 'false') return;
  const u = localStorage.getItem('ruchat_device_user');
  const token = localStorage.getItem('ruchat_device_token');
  if (!u || !token) return;
  try {
    const snap = await db.ref(`accounts/${u}/devices/${token}`).get();
    if (!snap.exists()) return;
    await doLoginAfterAuth(u, "Автовход", "Вы вошли на этом устройстве");
  } catch (e) {
    // ignore
  }
}
