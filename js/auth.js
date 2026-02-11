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
    await db.ref("accounts/" + u).set({ password: hashPassword(p), friends: {}, avatar: "", chatBg: "", stories: {}, lastSeen: ts, createdAt: ts, chatThemes: {} });
    showNotification("Успешно", "Регистрация прошла успешно!");
    document.getElementById("usernameInput").value = "";
    document.getElementById("passwordInput").value = "";
  } catch (e) {
    showError(e.message);
  } finally {
    hideLoading();
  }
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
    username = u;
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
    initEmojiPicker();
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
    
    // ИНИЦИАЛИЗАЦИЯ ЗВУКОВ ПОСЛЕ ВХОДА
    if (typeof initSoundsAfterLogin === 'function') {
      initSoundsAfterLogin();
    }
    if (typeof listenForIncomingCalls === 'function') {
      listenForIncomingCalls();
    }
    
    // ИНИЦИАЛИЗАЦИЯ ВИДЕОСООБЩЕНИЙ ПОСЛЕ ВХОДА
    if (typeof initVideoMessagesAfterLogin === 'function') {
      initVideoMessagesAfterLogin();
    }
    
    showNotification("Добро пожаловать", `Привет, ${username}!`);
    checkMobile();
  } catch (e) {
    showError(e.message, () => login());
  } finally {
    hideLoading();
  }
}

// Запоминание имени для входа
document.addEventListener('DOMContentLoaded', function() {
  const savedUser = localStorage.getItem('ruchat_last_user');
  if (savedUser) {
    const u = document.getElementById('usernameInput');
    if (u) u.value = savedUser;
  }
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
      showLoading();
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
      document.getElementById('callButton').classList.add('active');
      loadFriends();
      loadGroups();
      loadStories();
      updateUserAvatar();
      initEmojiPicker();
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
      
      // ИНИЦИАЛИЗАЦИЯ ЗВУКОВ ПОСЛЕ ВХОДА
      if (typeof initSoundsAfterLogin === 'function') {
        initSoundsAfterLogin();
      }
      if (typeof listenForIncomingCalls === 'function') {
        listenForIncomingCalls();
      }
      
      hideLoading();
      showNotification("Вход выполнен", "Вы вошли без пароля!");
      checkMobile();
    }
  }).catch(e => { hideLoading(); showError("Ошибка загрузки данных пользователя"); });
}

function logout() {
  if (!confirm("Вы уверены, что хотите выйти?")) return;
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
    const url = s.val();
    if (s.exists() && url && (typeof isValidMediaUrl !== 'function' || isValidMediaUrl(url))) {
      av.src = url;
    } else {
      av.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=0088cc&color=fff&size=44`;
    }
  });
}


