/* ==========================================================
   5. АВТОРИЗАЦИЯ
   ========================================================== */
function hashPassword(p) {
  let h = 0;
  for (let i = 0; i < p.length; i++) { h = ((h << 5) - h) + p.charCodeAt(i); h |= 0; }
  return h;
}

function sanitizeProfileText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  let text = String(value);
  if (typeof normalizeText === 'function') text = normalizeText(text);
  if (text.includes('\uFFFD') && typeof fixMojibakeCp1251 === 'function') {
    const fixed = fixMojibakeCp1251(text);
    if (fixed) text = typeof normalizeText === 'function' ? normalizeText(fixed) : fixed;
    text = text.replace(/\uFFFD+/g, '');
  }
  text = text.trim();
  return text || fallback;
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
    const snap = await (typeof withTimeout === 'function'
      ? withTimeout(db.ref("accounts/" + u).get(), 12000, "Не удалось подключиться к серверу. Проверьте интернет.")
      : db.ref("accounts/" + u).get());
    if (snap.exists()) throw new Error("Пользователь уже существует!");
    const ts = Date.now();
    await (typeof withTimeout === 'function'
      ? withTimeout(db.ref("accounts/" + u).set({ 
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
    }), 12000, "Сервер не отвечает. Попробуйте ещё раз.")
      : db.ref("accounts/" + u).set({ 
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
    }));
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
  
  // Проверка блокировки при каждом входе (даже если уже авторизован)
  try {
    const blockedSnap = await db.ref("blockedUsers/" + u).get();
    if (blockedSnap.exists() && blockedSnap.val().blocked === true) {
      // Блокируем выход из приложения, показываем сообщение о блокировке
      blockAppInterface();
      showBlockedMessage(blockedSnap.val());
      return; // Не продолжаем загрузку
    }
    
    // Дополнительная проверка блокировки в аккаунте
    const accountSnap = await db.ref("accounts/" + u).get();
    const accountData = accountSnap.val();
    if (accountData && accountData.blocked && accountData.blocked.admin === true) {
      blockAppInterface();
      showBlockedMessage({ reason: "Нарушение правил пользования мессенджером", blockedAt: Date.now() });
      return;
    }
  } catch (e) {
    console.warn("Ошибка проверки блокировки:", e.message);
    // Продолжаем вход даже если проверка не прошла
  }
  
  if (localStorage.getItem('ruchat_autologin') === null) {
    localStorage.setItem('ruchat_autologin', 'true');
  }
  localStorage.setItem('ruchat_last_user', u);
  updateMyStatus(true, false);
  setupActivityTracking();
  setupUserStatusMonitoring();
  if (typeof setupPresenceDisconnectHook === 'function') {
    setupPresenceDisconnectHook();
  } else {
    db.ref(`userStatus/${username}`).onDisconnect().set({ online: false, idle: false, lastSeen: Date.now(), username: username });
  }
  document.getElementById("login").style.display = "none";
  document.getElementById("main").style.display = "flex";
  const safeName = sanitizeProfileText(username, username);
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
    
    // Проверяем, не заблокирован ли пользователь глобально
    const blockedSnap = await (typeof withTimeout === 'function'
      ? withTimeout(db.ref("blockedUsers/" + u).get(), 12000, "Не удалось подключиться к серверу.")
      : db.ref("blockedUsers/" + u).get());
    
    if (blockedSnap.exists() && blockedSnap.val().blocked === true) {
      const blockData = blockedSnap.val() || {};
      const reason = blockData.reason || "Нарушение правил пользования мессенджером";
      const blockedAt = blockData.blockedAt ? new Date(blockData.blockedAt).toLocaleString('ru-RU') : 'неизвестно';
      throw new Error(
        "🚫 АККАУНТ ЗАБЛОКИРОВАН\n\n" +
        "По причине: " + reason + "\n" +
        "Дата блокировки: " + blockedAt + "\n\n" +
        "Если вы хотите обжаловать блокировку, пишите на почту:\n" +
        "📧 ruchat.offical@mail.ru"
      );
    }
    
    const snap = await (typeof withTimeout === 'function'
      ? withTimeout(db.ref("accounts/" + u).get(), 12000, "Не удалось подключиться к серверу. Проверьте интернет.")
      : db.ref("accounts/" + u).get());
    if (!snap.exists()) throw new Error("Пользователь не найден!");
    if (snap.val().password !== hashPassword(p)) throw new Error("Неверный пароль!");
    
    // Дополнительная проверка блокировки в аккаунте
    const accountData = snap.val();
    if (accountData.blocked && accountData.blocked.admin === true) {
      throw new Error(
        "🚫 АККАУНТ ЗАБЛОКИРОВАН\n\n" +
        "За нарушение правил пользования мессенджером.\n\n" +
        "Если вы хотите обжаловать блокировку, пишите на почту:\n" +
        "📧 ruchat.offical@mail.ru"
      );
    }
    
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
    submit.textContent = authMode === 'register' ? 'СОЗДАТЬ АККАУНТ' : 'ВХОД';
    submit.onclick = authMode === 'register' ? register : login;
  }
  if (switchText) switchText.textContent = authMode === 'register' ? 'Уже есть аккаунт?' : 'Нет аккаунта?';
  if (switchLink) switchLink.textContent = authMode === 'register' ? 'Войти' : 'Зарегистрироваться';
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
  db.ref(`accounts/${username}`).onDisconnect().cancel();
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
    const displayName = sanitizeProfileText(data.displayName || username, username);
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
    // Проверка блокировки перед автовходом
    const blockedSnap = await db.ref("blockedUsers/" + u).get();
    if (blockedSnap.exists() && blockedSnap.val().blocked === true) {
      blockAppInterface();
      showBlockedMessage(blockedSnap.val());
      return;
    }
    
    const snap = await db.ref(`accounts/${u}/devices/${token}`).get();
    if (!snap.exists()) return;
    
    // Дополнительная проверка блокировки в аккаунте
    const accountSnap = await db.ref(`accounts/${u}`).get();
    const accountData = accountSnap.val();
    if (accountData && accountData.blocked && accountData.blocked.admin === true) {
      blockAppInterface();
      showBlockedMessage({ reason: "Нарушение правил пользования мессенджером", blockedAt: Date.now() });
      return;
    }
    
    await doLoginAfterAuth(u, "Автовход", "Вы вошли на этом устройстве");
  } catch (e) {
    // ignore
  }
}

// ────────────────────────────────────────────────
//  БЛОКИРОВКА ПОЛЬЗОВАТЕЛЕЙ
// ────────────────────────────────────────────────

/**
 * Блокирует интерфейс приложения, показывая экран блокировки
 */
function blockAppInterface() {
  // Скрываем основной интерфейс
  const main = document.getElementById("main");
  if (main) main.style.display = "none";
  
  // Показываем экран блокировки
  const login = document.getElementById("login");
  if (login) login.style.display = "flex";
  
  // Блокируем все элементы ввода
  const inputs = login.querySelectorAll("input, button");
  inputs.forEach(el => {
    if (!el.classList.contains("blocked-overlay")) {
      el.disabled = true;
    }
  });
}

/**
 * Показывает сообщение о блокировке
 */
function showBlockedMessage(blockData) {
  const reason = blockData?.reason || "Нарушение правил пользования мессенджером";
  const blockedAt = blockData?.blockedAt ? new Date(blockData.blockedAt).toLocaleString('ru-RU') : 'неизвестно';
  
  // Создаём или находим оверлей блокировки
  let overlay = document.getElementById("blockedOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "blockedOverlay";
    overlay.className = "blocked-overlay";
    overlay.innerHTML = `
      <div class="blocked-modal">
        <div class="blocked-icon">🚫</div>
        <h2 class="blocked-title">АККАУНТ ЗАБЛОКИРОВАН</h2>
        <div class="blocked-content">
          <p class="blocked-reason-label">Причина блокировки:</p>
          <p class="blocked-reason" id="blockedReason">${reason}</p>
          <p class="blocked-date">Дата: <span id="blockedDate">${blockedAt}</span></p>
          <div class="blocked-footer">
            <p>Если вы хотите обжаловать блокировку, напишите на почту:</p>
            <a href="mailto:ruchat.offical@mail.ru" class="blocked-email">ruchat.offical@mail.ru</a>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    // Добавляем стили
    const style = document.createElement("style");
    style.id = "blockedStyles";
    style.textContent = `
      .blocked-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.9);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        padding: 20px;
      }
      .blocked-modal {
        background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
        border-radius: 20px;
        padding: 40px;
        max-width: 500px;
        width: 100%;
        text-align: center;
        box-shadow: 0 25px 50px rgba(0, 0, 0, 0.5);
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .blocked-icon {
        font-size: 80px;
        margin-bottom: 20px;
      }
      .blocked-title {
        color: #ef4444;
        font-size: 28px;
        font-weight: 800;
        margin-bottom: 25px;
        text-transform: uppercase;
        letter-spacing: 2px;
      }
      .blocked-content {
        color: #e2e8f0;
        line-height: 1.6;
      }
      .blocked-reason-label {
        font-size: 14px;
        color: #94a3b8;
        margin-bottom: 8px;
      }
      .blocked-reason {
        font-size: 18px;
        font-weight: 600;
        color: #f8fafc;
        margin-bottom: 15px;
        padding: 15px;
        background: rgba(239, 68, 68, 0.1);
        border-radius: 10px;
        border-left: 3px solid #ef4444;
      }
      .blocked-date {
        font-size: 14px;
        color: #94a3b8;
        margin-bottom: 25px;
      }
      .blocked-footer {
        margin-top: 30px;
        padding-top: 25px;
        border-top: 1px solid rgba(255, 255, 255, 0.1);
      }
      .blocked-footer p {
        font-size: 14px;
        color: #94a3b8;
        margin-bottom: 10px;
      }
      .blocked-email {
        display: inline-block;
        color: #38bdf8;
        font-size: 16px;
        font-weight: 600;
        text-decoration: none;
        padding: 10px 20px;
        background: rgba(56, 189, 248, 0.1);
        border-radius: 8px;
        transition: all 0.3s;
      }
      .blocked-email:hover {
        background: rgba(56, 189, 248, 0.2);
        transform: translateY(-2px);
      }
      @media (max-width: 600px) {
        .blocked-modal {
          padding: 30px 20px;
        }
        .blocked-title {
          font-size: 22px;
        }
        .blocked-icon {
          font-size: 60px;
        }
      }
    `;
    if (!document.getElementById("blockedStyles")) {
      document.head.appendChild(style);
    }
  } else {
    // Обновляем данные
    document.getElementById("blockedReason").textContent = reason;
    document.getElementById("blockedDate").textContent = blockedAt;
  }
  
  overlay.style.display = "flex";
}

window.blockAppInterface = blockAppInterface;
window.showBlockedMessage = showBlockedMessage;
