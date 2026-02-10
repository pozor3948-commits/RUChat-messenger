/* ==========================================================
   5. РђР’РўРћР РР—РђР¦РРЇ
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
    if (!u || !p) throw new Error("Р’РІРµРґРёС‚Рµ РёРјСЏ Рё РїР°СЂРѕР»СЊ!");
    if (u.length < 3) throw new Error("РРјСЏ РґРѕР»Р¶РЅРѕ Р±С‹С‚СЊ РЅРµ РјРµРЅРµРµ 3 СЃРёРјРІРѕР»РѕРІ!");
    if (p.length < 6) throw new Error("РџР°СЂРѕР»СЊ РґРѕР»Р¶РµРЅ Р±С‹С‚СЊ РЅРµ РјРµРЅРµРµ 6 СЃРёРјРІРѕР»РѕРІ!");
    const snap = await db.ref("accounts/" + u).get();
    if (snap.exists()) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ СѓР¶Рµ СЃСѓС‰РµСЃС‚РІСѓРµС‚!");
    const ts = Date.now();
    await db.ref("accounts/" + u).set({ password: hashPassword(p), friends: {}, avatar: "", chatBg: "", stories: {}, lastSeen: ts, createdAt: ts, chatThemes: {} });
    showNotification("РЈСЃРїРµС€РЅРѕ", "Р РµРіРёСЃС‚СЂР°С†РёСЏ РїСЂРѕС€Р»Р° СѓСЃРїРµС€РЅРѕ!");
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
    if (!u || !p) throw new Error("Р’РІРµРґРёС‚Рµ РёРјСЏ Рё РїР°СЂРѕР»СЊ!");
    const snap = await db.ref("accounts/" + u).get();
    if (!snap.exists()) throw new Error("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ!");
    if (snap.val().password !== hashPassword(p)) throw new Error("РќРµРІРµСЂРЅС‹Р№ РїР°СЂРѕР»СЊ!");
    username = u;
    localStorage.setItem('ruchat_last_user', u);
    updateMyStatus(true, false);
    setupActivityTracking();
    setupUserStatusMonitoring();
    db.ref(`userStatus/${username}`).onDisconnect().set({ online: false, idle: false, lastSeen: Date.now(), username: username });
    document.getElementById("login").style.display = "none";
    document.getElementById("main").style.display = "flex";
    document.getElementById("userName").textContent = username;
    document.getElementById("mobileChatTitle").textContent = username;
    document.getElementById("userStatus").textContent = "Р’ СЃРµС‚Рё";
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
    
    // РРќРР¦РРђР›РР—РђР¦РРЇ Р—Р’РЈРљРћР’ РџРћРЎР›Р• Р’РҐРћР”Рђ
    if (typeof initSoundsAfterLogin === 'function') {
      initSoundsAfterLogin();
    }
    if (typeof listenForIncomingCalls === 'function') {
      listenForIncomingCalls();
    }
    
    // РРќРР¦РРђР›РР—РђР¦РРЇ Р’РР”Р•РћРЎРћРћР‘Р©Р•РќРР™ РџРћРЎР›Р• Р’РҐРћР”Рђ
    if (typeof initVideoMessagesAfterLogin === 'function') {
      initVideoMessagesAfterLogin();
    }
    
    showNotification("Р”РѕР±СЂРѕ РїРѕР¶Р°Р»РѕРІР°С‚СЊ", `РџСЂРёРІРµС‚, ${username}!`);
    checkMobile();
  } catch (e) {
    showError(e.message, () => login());
  } finally {
    hideLoading();
  }
}

// Заполнение имени при старте
document.addEventListener('DOMContentLoaded', function() {
  const savedUser = localStorage.getItem('ruchat_last_user');
  if (savedUser) {
    const u = document.getElementById('usernameInput');
    if (u) u.value = savedUser;
  }
});
function recoverPassword() {
  const u = prompt("Р’РІРµРґРёС‚Рµ РёРјСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ:");
  if (!u) return;
  showLoading();
  db.ref("accounts/" + u).get().then(async snap => {
    hideLoading();
    if (!snap.exists()) { showError("РџРѕР»СЊР·РѕРІР°С‚РµР»СЊ РЅРµ РЅР°Р№РґРµРЅ!"); return; }
    const adminCode = prompt("Р’РІРµРґРёС‚Рµ РєРѕРґ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°:");
    if (adminCode !== "1234") { showError("РќРµРІРµСЂРЅС‹Р№ РєРѕРґ Р°РґРјРёРЅРёСЃС‚СЂР°С‚РѕСЂР°!"); return; }
    const choice = prompt("Р’РІРµРґРёС‚Рµ '1' С‡С‚РѕР±С‹ Р·Р°РґР°С‚СЊ РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ РёР»Рё '2' С‡С‚РѕР±С‹ РІРѕР№С‚Рё Р±РµР· РїР°СЂРѕР»СЏ:");
    if (choice === "1") {
      const np = prompt("Р’РІРµРґРёС‚Рµ РЅРѕРІС‹Р№ РїР°СЂРѕР»СЊ:");
      if (!np) { showError("РџР°СЂРѕР»СЊ РЅРµ РёР·РјРµРЅРµРЅ!"); return; }
      showLoading();
      await db.ref("accounts/" + u + "/password").set(hashPassword(np));
      hideLoading();
      showNotification("РЈСЃРїРµС€РЅРѕ", "РџР°СЂРѕР»СЊ СѓСЃРїРµС€РЅРѕ РёР·РјРµРЅРµРЅ!");
    } else if (choice === "2") {
      username = u;
      showLoading();
      updateMyStatus(true, false);
      setupActivityTracking();
      setupUserStatusMonitoring();
      db.ref(`userStatus/${username}`).onDisconnect().set({ online: false, idle: false, lastSeen: Date.now(), username: username });
      document.getElementById("login").style.display = "none";
      document.getElementById("main").style.display = "flex";
      document.getElementById("userName").textContent = username;
      document.getElementById("mobileChatTitle").textContent = username;
      document.getElementById("userStatus").textContent = "Р’ СЃРµС‚Рё";
      document.getElementById("userStatus").className = "user-status";
      document.getElementById('callButton').classList.add('active');
      loadFriends();
      loadGroups();
      loadStories();
      updateUserAvatar();
      initEmojiPicker();
      
      // РРќРР¦РРђР›РР—РђР¦РРЇ Р—Р’РЈРљРћР’ РџРћРЎР›Р• Р’РҐРћР”Рђ
      if (typeof initSoundsAfterLogin === 'function') {
        initSoundsAfterLogin();
      }
      if (typeof listenForIncomingCalls === 'function') {
        listenForIncomingCalls();
      }
      
      hideLoading();
      showNotification("Р’С…РѕРґ РІС‹РїРѕР»РЅРµРЅ", "Р’С‹ РІРѕС€Р»Рё Р±РµР· РїР°СЂРѕР»СЏ!");
      checkMobile();
    }
  }).catch(e => { hideLoading(); showError("РћС€РёР±РєР° Р·Р°РіСЂСѓР·РєРё РґР°РЅРЅС‹С… РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ"); });
}

function logout() {
  if (!confirm("Р’С‹ СѓРІРµСЂРµРЅС‹, С‡С‚Рѕ С…РѕС‚РёС‚Рµ РІС‹Р№С‚Рё?")) return;
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
    if (s.exists() && s.val()) av.src = s.val(); else av.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=0088cc&color=fff&size=44`;
  });
}

