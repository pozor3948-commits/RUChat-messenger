/* ==========================================================
   6. ЗАГРУЗКА ДАННЫХ (ИСПОЛЬЗУЕМ ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ)
   ========================================================== */

// Проверяем, что глобальные переменные определены
if (typeof friendStatusListeners === 'undefined') {
    window.friendStatusListeners = {};
}

if (typeof userStatuses === 'undefined') {
    window.userStatuses = {};
}

/* ==========================================================
   6. ЗАГРУЗКА ДАННЫХ
   ========================================================== */
function loadFriends() {
  const friendList = document.getElementById("friendList");
  db.ref("accounts/" + username + "/friends").on("value", snap => {
    friendList.innerHTML = "";
    if (!snap.exists()) {
      friendList.innerHTML = `
        <div class="empty-state">
          <div class="icon">👤</div>
          <div class="title">У вас пока нет друзей</div>
          <div class="description">Добавьте друзей, чтобы начать общение</div>
        </div>`;
      return;
    }
    Object.keys(friendStatusListeners).forEach(f => {
      if (friendStatusListeners[f]) db.ref("userStatus/" + f).off('value', friendStatusListeners[f]);
    });
    friendStatusListeners = {};
    let idx = 0;
    snap.forEach(ch => {
      const fn = ch.key;
      setTimeout(() => {
        createFriendItem(fn);
        friendStatusListeners[fn] = db.ref(`userStatus/${fn}`).on("value", st => updateFriendStatusInList(fn, st.val()));
        db.ref(`userStatus/${fn}`).once("value").then(s => updateFriendStatusInList(fn, s.val()));
      }, idx * 50);
      idx++;
    });
  });
}

function createFriendItem(fn) {
  const displayName = normalizeText(fn);
  const fl = document.getElementById("friendList");
  const item = document.createElement("div");
  item.className = "contact-item";
  item.id = `contact_${fn}`;
  item.style.animation = "slideUp .3s ease-out";
  item.onclick = () => {
    openPrivateChat(fn);
    if (isMobile) document.getElementById('sidebar').classList.remove('active');
  };
  item.innerHTML = `
    <div style="position:relative;">
      <img class="contact-avatar" id="avatar_${fn}" alt="${displayName}" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0088cc&color=fff&size=48'">
      <span class="online-dot recently" id="online_${fn}"></span>
    </div>
    <div class="contact-info">
      <div class="contact-name">${displayName}</div>
      <div class="last-message" id="lastMsg_${fn}">Напишите сообщение...</div>
      <div class="last-seen recently" id="lastSeen_${fn}">Был(а) недавно</div>
    </div>
    <div class="unread-badge" id="unread_${fn}" style="display:none">0</div>`;
  fl.appendChild(item);
  db.ref("accounts/" + fn + "/avatar").on("value", s => {
    const av = document.getElementById(`avatar_${fn}`);
    if (s.exists() && s.val()) av.src = s.val(); else av.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0088cc&color=fff&size=48`;
  });
  loadLastMessage(fn);
}

function loadLastMessage(fn) {
  const chatId = [username, fn].sort().join("_");
  db.ref("privateChats/" + chatId).limitToLast(1).on("value", snap => {
    if (snap.exists()) snap.forEach(ch => {
      const m = ch.val();
      const lm = document.getElementById(`lastMsg_${fn}`);
      if (lm && m.text) {
      const t = normalizeText(m.text);
      lm.textContent = t.length > 30 ? t.substring(0, 30) + "..." : t;
    }
    });
  });
}

function loadGroups() {
  const gl = document.getElementById("groupList");
  db.ref("groups").orderByChild("members/" + username).equalTo(true).on("value", snap => {
    gl.innerHTML = "";
    if (!snap.exists()) {
      gl.innerHTML = `
        <div class="empty-state">
          <div class="icon">👥</div>
          <div class="title">У вас пока нет групп</div>
          <div class="description">Создайте группу или вас пригласят</div>
        </div>`;
      return;
    }
    let idx = 0;
    snap.forEach(ch => {
      const g = ch.val(), gid = ch.key;
      setTimeout(() => createGroupItem(g, gid), idx * 50);
      idx++;
    });
  });
}

function createGroupItem(g, gid) {
  const groupName = normalizeText(g.name);
  const gl = document.getElementById("groupList");
  const item = document.createElement("div");
  item.className = "group-item";
  item.id = `group_${gid}`;
  item.style.animation = "slideUp .3s ease-out";
  item.onclick = () => {
    openGroupChat(g, gid);
    if (isMobile) document.getElementById('sidebar').classList.remove('active');
  };
  item.innerHTML = `
    <div style="position:relative;">
      <img class="group-avatar" id="group_avatar_${gid}" alt="${groupName}" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=0088cc&color=fff&size=48'">
    </div>
    <div class="contact-info">
      <div class="contact-name">${groupName}</div>
      <div class="last-message" id="group_lastMsg_${gid}">${Object.keys(g.members || {}).length} участников</div>
      <div class="last-seen online">Группа</div>
    </div>`;
  gl.appendChild(item);
  if (g.avatar) document.getElementById(`group_avatar_${gid}`).src = g.avatar;
}

function loadStories() {
  const sl = document.getElementById("storiesList");
  db.ref("accounts/" + username + "/friends").once("value").then(snap => {
    if (!snap.exists()) {
      sl.innerHTML = `
        <div style="text-align:center;padding:20px;color:#8a8f98;width:100%;">
          <div style="font-size:48px;margin-bottom:20px;">📱</div>
          <div style="font-size:16px;margin-bottom:10px;">Нет активных историй</div>
          <div style="font-size:14px;">Ваши друзья пока не добавляли истории</div>
        </div>`;
      return;
    }
    let cnt = 0;
    snap.forEach(ch => {
      const fn = ch.key;
      cnt++;
      setTimeout(() => {
        db.ref("accounts/" + fn + "/stories").limitToLast(1).once("value", st => {
          if (st.exists()) createStoryItem(fn); else if (cnt === Object.keys(snap.val()).length) checkEmptyStories();
        });
      }, cnt * 100);
    });
  });
}

function createStoryItem(fn) {
  const sl = document.getElementById("storiesList");
  const item = document.createElement("div");
  item.className = "story-item";
  item.style.animation = "slideUp .5s ease-out";
  const displayName = normalizeText(fn);
  item.innerHTML = `
    <img class="story-avatar" src="https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0088cc&color=fff&size=60" alt="${displayName}">
    <div class="story-name">${displayName}</div>`;
  sl.appendChild(item);
}

function checkEmptyStories() {
  const sl = document.getElementById("storiesList");
  if (sl.children.length === 0) sl.innerHTML = `
    <div style="text-align:center;padding:20px;color:#8a8f98;width:100%;">
      <div style="font-size:48px;margin-bottom:20px;">📱</div>
      <div style="font-size:16px;margin-bottom:10px;">Нет активных историй</div>
      <div style="font-size:14px;">Ваши друзья пока не добавляли истории</div>
    </div>`;
}

/* ==========================================================
   7. ЧАТЫ / СООБЩЕНИЯ
   ========================================================== */
function openPrivateChat(fn) {
  setActiveChatItem('contact', fn);
  isGroupChat = false;
  currentChatId = [username, fn].sort().join("_");
  currentChatPartner = fn;
  const displayName = normalizeText(fn);
  document.getElementById("chatWith").textContent = displayName;
  document.getElementById("mobileChatTitle").textContent = displayName;
  if (isMobile) document.getElementById('mobileBackBtn').classList.add('active');
  const chatAvatar = document.getElementById("chatAvatar");
  const fAvatar = document.getElementById(`avatar_${fn}`);
  if (fAvatar) chatAvatar.src = fAvatar.src; else chatAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0088cc&color=fff&size=44`;
  const st = userStatuses[fn];
  updateChatStatus(fn, st);
  loadChat("privateChats/" + currentChatId);
  setupTypingIndicator();
  if (typeof updateCallButtonVisibility === 'function') updateCallButtonVisibility();
}

function openGroupChat(g, gid) {
  setActiveChatItem('group', gid);
  isGroupChat = true;
  currentChatId = gid;
  currentChatPartner = null;
  const groupName = normalizeText(g.name);
  document.getElementById("chatWith").textContent = groupName;
  document.getElementById("mobileChatTitle").textContent = groupName;
  if (isMobile) document.getElementById('mobileBackBtn').classList.add('active');
  const chatAvatar = document.getElementById("chatAvatar");
  const gAvatar = document.getElementById(`group_avatar_${gid}`);
  if (gAvatar) chatAvatar.src = gAvatar.src; else chatAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=0088cc&color=fff&size=44`;
  const mc = Object.keys(g.members || {}).length;
  document.getElementById("chatMembers").textContent = `${mc} участников`;
  document.getElementById("mobileChatStatus").textContent = `${mc} участников`;
  loadChat("groupChats/" + currentChatId);
  if (typeof updateCallButtonVisibility === 'function') updateCallButtonVisibility();
}

function loadChat(path) {
  if (chatRef) chatRef.off();
  chatRef = db.ref(path);
  const md = document.getElementById("messages");
  md.innerHTML = "";
  md.style.opacity = .5;
  chatRef.limitToLast(50).on("child_added", snap => {
    const m = snap.val();
    m.id = snap.key;
    if (!m) return;
    if (m.text === undefined || m.text === null) m.text = "";
    if (!document.getElementById(`message_${m.id}`)) {
      setTimeout(() => { addMessageToChat(m); md.style.opacity = 1; md.style.transition = 'opacity .3s ease'; }, 50);
    }
  });
}

function setActiveChatItem(kind, id) {
  document.querySelectorAll('.contact-item.active, .group-item.active')
    .forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`${kind}_${id}`);
  if (el) el.classList.add('active');
}

function addMessageToChat(m) {
  const md = document.getElementById("messages");
  if (document.getElementById(`message_${m.id}`)) return;
  
  if (m.from !== username && typeof playReceiveSound === 'function') {
    playReceiveSound();
  }
  
  const wrap = document.createElement("div");
  wrap.className = `message-wrapper ${m.from === username ? "me" : "other"}`;
  wrap.id = `message_${m.id}`;
  wrap.style.opacity = 0;
  wrap.style.transform = 'translateY(10px)';
  const msg = document.createElement("div");
  msg.className = `message ${m.from === username ? "me" : "other"}`;
  let status = 'sent';
  if (m.error) status = 'error'; else if (m.read) status = 'read'; else if (m.delivered) status = 'delivered'; else if (m.sent) status = 'sent';
  let content = "";
  if (m.text && !m.photo && !m.video && !m.audio && !m.document) {
    content = `<div class="message-text">${escapeHtml(m.text)}</div>`;
  } else if (m.photo) {
    content = `
      <div class="message-text">${escapeHtml(m.text)}</div>
      <a href="${m.photo}" target="_blank" download>
        <img src="${m.photo}" class="message-media" onclick="openMedia('${m.photo}')" alt="Фото">
      </a>
      <div class="message-media-actions">
        <a href="${m.photo}" target="_blank" download>Скачать</a>
      </div>
    `;
  } else if (m.video) {
    // ВИДЕОСООБЩЕНИЯ - НОВАЯ ЛОГИКА
    if (m.type === 'video_message') {
      content = `
        <div class="message-text">${escapeHtml(m.text)}</div>
        <div class="message-video" onclick="playVideoMessage('${m.video}')">
          <video src="${m.video}" preload="metadata"></video>
        </div>
        ${m.duration ? `<div class="video-duration">${m.duration} сек</div>` : ''}
        <div class="message-media-actions">
          <a href="${m.video}" target="_blank" download>Скачать</a>
        </div>
      `;
    } else {
      content = `
        <div class="message-text">${escapeHtml(m.text)}</div>
        <video src="${m.video}" class="message-media" controls onclick="openMedia('${m.video}')"></video>
        <div class="message-media-actions">
          <a href="${m.video}" target="_blank" download>Скачать</a>
        </div>
      `;
    }
  } else if (m.audio) {
    content = `
      <div class="message-text">${escapeHtml(m.text)}</div>
      <audio src="${m.audio}" class="message-audio" controls></audio>
      <div class="message-media-actions">
        <a href="${m.audio}" target="_blank" download>Скачать</a>
      </div>
    `;
  } else if (m.document) {
    const fs = formatFileSize(m.filesize);
    content = `<div class="message-text">${escapeHtml(m.text)}</div><a href="${m.document}" download="${m.filename}" class="message-doc"><div class="doc-icon">📄</div><div class="doc-info"><div class="doc-name">${escapeHtml(m.filename)}</div><div class="doc-size">${fs}</div></div></a>`;
  }
  const t = new Date(m.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  msg.innerHTML = `
    ${m.from !== username && !isGroupChat ? `<div class="message-sender">${senderName}</div>` : ""}
    ${isGroupChat && m.from !== username ? `<div class="message-sender">${senderName}</div>` : ""}
    ${content}
    <div class="message-time">
      ${t}
      ${m.from === username ? `<span class="message-status ${status}">${status === 'read' ? '✓✓' : status === 'delivered' ? '✓✓' : status === 'sent' ? '✓' : '⏳'}</span>` : ''}
    </div>`;
  wrap.appendChild(msg);
  md.appendChild(wrap);
  setTimeout(() => { wrap.style.opacity = 1; wrap.style.transform = 'translateY(0)'; wrap.style.transition = 'all .3s ease'; }, 10);
  md.scrollTop = md.scrollHeight;
}

async function sendMessage() {
  if (!checkConnection()) return;
  const ti = document.getElementById("text");
  const txt = ti.value.trim();
  if (!txt || !currentChatId || !chatRef || !username) { showError("Введите сообщение или выберите чат!"); return; }
  const btn = document.getElementById("sendBtn");
  const orig = btn.innerHTML;
  btn.innerHTML = "⏳"; btn.style.animation = "rotate 1s linear infinite";
  try {
    await chatRef.push({ from: username, text: txt, time: Date.now(), sent: true, delivered: true, read: false, status: 'sent' });
    ti.value = ""; updateSendButton();
    
    // ВОСПРОИЗВОДИМ ЗВУК ОТПРАВКИ
    if (typeof playSendSound === 'function') {
      playSendSound();
    }
    
    btn.innerHTML = orig; btn.style.animation = "";
    if (currentChatPartner && !isGroupChat) sendTypingStatus(false);
  } catch (e) {
    console.error(e);
    showError("Не удалось отправить сообщение", () => sendMessage());
    btn.innerHTML = "✗"; btn.style.animation = "";
  }
}

function setupTypingIndicator() {
  if (currentChatId && !isGroupChat) {
    db.ref(`typing/${currentChatId}/${currentChatPartner}`).on('value', s => showTypingIndicator(s.val(), currentChatPartner));
  }
}

function showTypingIndicator(isTyping, userName) {
  const ti = document.getElementById('typingIndicator');
  if (isTyping) {
    if (!ti) {
      const md = document.getElementById("messages");
      const d = document.createElement("div");
      d.id = "typingIndicator";
      d.className = "typing-indicator";
      d.innerHTML = `<div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-text">${userName} печатает...</div>`;
      md.appendChild(d);
      md.scrollTop = md.scrollHeight;
    }
  } else {
    if (ti) ti.remove();
  }
}

function sendTypingStatus(isTyping) {
  if (!currentChatId || !username || isGroupChat) return;
  db.ref(`typing/${currentChatId}/${username}`).set(isTyping);
}

function handleTyping() {
  if (!currentChatId || isGroupChat) return;
  if (!isTyping) { isTyping = true; sendTypingStatus(true); }
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => { isTyping = false; sendTypingStatus(false); }, 1000);
}

/* ==========================================================
   12. ПРОЧЕЕ (ФУНКЦИИ ПЕРЕМЕЩЕНЫ В sounds.js)
   ========================================================== */
function showAddFriend() {
  const fn = prompt("Введите имя пользователя:");
  if (!fn || fn === username) { showError("Некорректное имя пользователя"); return; }
  showLoading();
  db.ref("accounts/" + fn).get().then(async s => {
    hideLoading();
    if (!s.exists()) { showError("Пользователь не найден"); return; }
    await db.ref("accounts/" + username + "/friends/" + fn).set(true);
    await db.ref("accounts/" + fn + "/friends/" + username).set(true);
    showNotification("Успешно", `Друг ${fn} добавлен`);
  }).catch(() => { hideLoading(); showError("Ошибка поиска пользователя"); });
}













