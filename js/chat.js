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

const displayNameCache = {};
let friendsCache = {};
let blockedCache = {};

const lastMessageKeyByChat = {};
const reactionOptions = ['👍','❤️','😂','😮','😢','😡'];
const ephemeralWatch = new Map();
let ephemeralInterval = null;
let replyToMessage = null;

/* ==========================================================
   6. ЗАГРУЗКА ДАННЫХ
   ========================================================== */
function loadFriends() {
  const friendsRef = db.ref("accounts/" + username + "/friends");
  friendsRef.on("value", snap => {
    friendsCache = snap.exists() ? (snap.val() || {}) : {};
    renderFriends();
  });
  const blockedRef = db.ref("accounts/" + username + "/blocked");
  blockedRef.on("value", snap => {
    blockedCache = snap.exists() ? (snap.val() || {}) : {};
    renderFriends();
    renderBlocked();
  });
}

function renderFriends() {
  const friendList = document.getElementById("friendList");
  if (!friendList) return;
  friendList.innerHTML = "";
  const friendKeys = Object.keys(friendsCache || {});
  const visibleKeys = friendKeys.filter(fn => !blockedCache[fn]);
  if (!visibleKeys.length) {
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
  visibleKeys.forEach(fn => {
    setTimeout(() => {
      createFriendItem(fn);
      friendStatusListeners[fn] = db.ref(`userStatus/${fn}`).on("value", st => updateFriendStatusInList(fn, st.val()));
      db.ref(`userStatus/${fn}`).once("value").then(s => updateFriendStatusInList(fn, s.val()));
    }, idx * 50);
    idx++;
  });
}

function renderBlocked() {
  const list = document.getElementById("blockedList");
  if (!list) return;
  list.innerHTML = "";
  const keys = Object.keys(blockedCache || {});
  if (!keys.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">🚫</div>
        <div class="title">Нет блокировок</div>
        <div class="description">Здесь будут заблокированные пользователи</div>
      </div>`;
    return;
  }
  keys.forEach(fn => {
    const item = document.createElement("div");
    item.className = "blocked-item";
    const name = displayNameCache[fn] || normalizeText(fn);
    item.innerHTML = `
      <div class="blocked-name" id="blocked_name_${fn}">${name}</div>
      <div class="blocked-actions">
        <button class="blocked-btn" onclick="unblockUser('${fn}')">Разблокировать</button>
      </div>`;
    list.appendChild(item);
    db.ref("accounts/" + fn + "/displayName").once("value").then(s => {
      const dn = s.val();
      const display = typeof normalizeText === 'function' ? normalizeText(dn || fn) : (dn || fn);
      displayNameCache[fn] = display;
      const el = document.getElementById(`blocked_name_${fn}`);
      if (el) el.textContent = display;
    });
  });
}

function createFriendItem(fn) {
  const displayName = displayNameCache[fn] || normalizeText(fn);
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
      <div class="contact-name" id="contactName_${fn}">${displayName}</div>
      <div class="last-message" id="lastMsg_${fn}">Напишите сообщение...</div>
      <div class="last-seen recently" id="lastSeen_${fn}">Был(а) недавно</div>
    </div>
    <div class="contact-actions">
      <button class="contact-action-btn" title="Удалить" onclick="removeFriend('${fn}', event)">🗑</button>
      <button class="contact-action-btn" title="Блокировать" onclick="blockUser('${fn}', event)">🚫</button>
    </div>
    <div class="unread-badge" id="unread_${fn}" style="display:none">0</div>`;
  fl.appendChild(item);
  db.ref("accounts/" + fn + "/avatar").on("value", s => {
    const av = document.getElementById(`avatar_${fn}`);
    const url = s.val();
    if (s.exists() && url && (typeof isValidMediaUrl !== 'function' || isValidMediaUrl(url))) {
      av.src = url;
    } else {
      av.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0088cc&color=fff&size=48`;
    }
  });
  db.ref("accounts/" + fn + "/displayName").on("value", s => {
    const dn = s.val();
    const name = typeof normalizeText === 'function' ? normalizeText(dn || fn) : (dn || fn);
    displayNameCache[fn] = name;
    const nameEl = document.getElementById(`contactName_${fn}`);
    if (nameEl) nameEl.textContent = name;
    if (currentChatPartner === fn) {
      document.getElementById("chatWith").textContent = name;
      document.getElementById("mobileChatTitle").textContent = name;
    }
  });
  loadLastMessage(fn);
}

function loadLastMessage(fn) {
  const chatId = [username, fn].sort().join("_");
  db.ref("privateChats/" + chatId).limitToLast(1).on("value", snap => {
    if (snap.exists()) snap.forEach(ch => {
      const m = ch.val();
      const lm = document.getElementById(`lastMsg_${fn}`);
      if (lm && m && m.text) {
        const t = normalizeText(m.text);
        lm.textContent = t.length > 30 ? t.substring(0, 30) + "..." : t;
      }

      const lastKey = lastMessageKeyByChat[chatId];
      if (!lastKey) {
        lastMessageKeyByChat[chatId] = ch.key;
        return;
      }
      if (ch.key !== lastKey) {
        lastMessageKeyByChat[chatId] = ch.key;
        const isCurrentChat = currentChatId === chatId;
        if (m && m.from !== username && !isCurrentChat) {
          const preview = m.text ? normalizeText(m.text) : 'Новое сообщение';
          showNotification(fn, preview);
        }
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
  if (g.avatar && (typeof isValidMediaUrl !== 'function' || isValidMediaUrl(g.avatar))) {
    document.getElementById(`group_avatar_${gid}`).src = g.avatar;
  }
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
  const displayName = displayNameCache[fn] || normalizeText(fn);
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
  if (typeof clearMessageSearch === 'function') clearMessageSearch();
  if (typeof clearReply === 'function') clearReply();
  const displayName = displayNameCache[fn] || normalizeText(fn);
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
  if (typeof clearMessageSearch === 'function') clearMessageSearch();
  if (typeof clearReply === 'function') clearReply();
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
  clearEphemeralWatch();
  chatRef = db.ref(path);
  const md = document.getElementById("messages");
  md.innerHTML = "";
  md.style.opacity = .7;
  let firstLoaded = false;
  chatRef.limitToLast(100).on("child_added", snap => {
    const m = snap.val();
    m.id = snap.key;
    if (!m) return;
    if (m.text === undefined || m.text === null) m.text = "";
    if (!document.getElementById(`message_${m.id}`)) {
      addMessageToChat(m);
      if (!firstLoaded) {
        md.style.opacity = 1;
        md.style.transition = 'opacity .2s ease';
        firstLoaded = true;
      }
    }
  });
  chatRef.on("child_changed", snap => {
    const m = snap.val();
    if (!m) return;
    m.id = snap.key;
    updateMessageInChat(m);
  });
  chatRef.on("child_removed", snap => {
    const el = document.getElementById(`message_${snap.key}`);
    if (el) el.remove();
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
  const now = Date.now();
  if (m.expiresAt && m.expiresAt <= now) {
    if (m.from === username && chatRef) chatRef.child(m.id).remove();
    return;
  }
  
  if (m.from !== username && typeof playReceiveSound === 'function') {
    playReceiveSound();
  }

  if (m.from !== username && chatRef) {
    const updates = { delivered: true };
    if (!isGroupChat) updates.read = true;
    chatRef.child(m.id).update(updates).catch(() => {});
  }
  
  const wrap = document.createElement("div");
  wrap.className = `message-wrapper ${m.from === username ? "me" : "other"}`;
  wrap.id = `message_${m.id}`;
  wrap.dataset.from = m.from || '';
  wrap.style.opacity = 0;
  wrap.style.transform = 'translateY(10px)';
  const msg = document.createElement("div");
  msg.className = `message ${m.from === username ? "me" : "other"}`;
  let status = 'sent';
  if (m.error) status = 'error';
  else if (m.read) status = 'read';
  else if (m.sent || m.delivered) status = 'sent';
  const photoUrl = (typeof isValidMediaUrl === 'function' && isValidMediaUrl(m.photo)) ? m.photo : null;
  const videoUrl = (typeof isValidMediaUrl === 'function' && isValidMediaUrl(m.video)) ? m.video : null;
  const audioUrl = (typeof isValidMediaUrl === 'function' && isValidMediaUrl(m.audio)) ? m.audio : null;
  const docUrl = (typeof isValidMediaUrl === 'function' && isValidMediaUrl(m.document)) ? m.document : null;
  if (!m.text && (m.photo || m.video || m.audio || m.document) && !photoUrl && !videoUrl && !audioUrl && !docUrl) {
    m.text = String(m.photo || m.video || m.audio || m.document);
  }
  if (!m.text && !photoUrl && !videoUrl && !audioUrl && !docUrl) return;
  const reactionsHtml = renderReactions(m.id, m.reactions || {});
  const expireHtml = m.expiresAt ? `<div class="message-expire" data-expires="${m.expiresAt}"></div>` : "";
  const actionsHtml = `<div class="message-actions">
    <button class="reaction-btn" data-message-id="${m.id}" title="Реакции">😊</button>
    <button class="reaction-btn" onclick="startReply('${m.id}')" title="Ответить">↩</button>
    <button class="reaction-btn" onclick="forwardMessage('${m.id}')" title="Переслать">↗</button>
    ${m.from === username ? `<button class="reaction-btn" onclick="deleteMessage('${m.id}')" title="Удалить">🗑</button>` : ""}
  </div>`;
  let content = "";
  const replyFrom = m.replyTo && m.replyTo.from ? (displayNameCache[m.replyTo.from] || m.replyTo.from) : '';
  const replyHtml = m.replyTo ? `<div class="message-reply">↩ ${escapeHtml(replyFrom)}: ${escapeHtml(m.replyTo.text || '')}</div>` : "";
  const fwdName = m.forwardedFrom ? (displayNameCache[m.forwardedFrom] || m.forwardedFrom) : '';
  const forwardedHtml = m.forwardedFrom ? `<div class="message-forwarded">↪ Переслано от ${escapeHtml(fwdName)}</div>` : "";
  if (m.text && !photoUrl && !videoUrl && !audioUrl && !docUrl) {
    content = `${forwardedHtml}${replyHtml}<div class="message-text">${escapeHtml(m.text)}</div>`;
  } else if (photoUrl) {
    content = `
      ${forwardedHtml}${replyHtml}<div class="message-text">${escapeHtml(m.text)}</div>
      <a href="${photoUrl}" target="_blank" download>
        <img src="${photoUrl}" class="message-media" onclick="openMedia('${photoUrl}')" alt="Фото">
      </a>
      <div class="message-media-actions">
        <a href="${photoUrl}" target="_blank" download>Скачать</a>
      </div>
    `;
  } else if (videoUrl) {
    // ВИДЕОСООБЩЕНИЯ - НОВАЯ ЛОГИКА
    if (m.type === 'video_message') {
      content = `
        ${forwardedHtml}${replyHtml}<div class="message-text">${escapeHtml(m.text)}</div>
        <div class="message-video" onclick="playVideoMessage('${videoUrl}')">
          <video src="${videoUrl}" preload="metadata"></video>
        </div>
        ${m.duration ? `<div class="video-duration">${m.duration} сек</div>` : ''}
        <div class="message-media-actions">
          <a href="${videoUrl}" target="_blank" download>Скачать</a>
        </div>
      `;
    } else {
      content = `
        ${forwardedHtml}${replyHtml}<div class="message-text">${escapeHtml(m.text)}</div>
        <video src="${videoUrl}" class="message-media" controls onclick="openMedia('${videoUrl}')"></video>
        <div class="message-media-actions">
          <a href="${videoUrl}" target="_blank" download>Скачать</a>
        </div>
      `;
    }
  } else if (audioUrl) {
    content = `
      ${forwardedHtml}${replyHtml}<div class="message-text">${escapeHtml(m.text)}</div>
      <audio src="${audioUrl}" class="message-audio" controls></audio>
      <div class="message-media-actions">
        <a href="${audioUrl}" target="_blank" download>Скачать</a>
      </div>
    `;
  } else if (docUrl) {
    const fs = formatFileSize(m.filesize);
    content = `${forwardedHtml}${replyHtml}<div class="message-text">${escapeHtml(m.text)}</div><a href="${docUrl}" download="${m.filename}" class="message-doc"><div class="doc-icon">📄</div><div class="doc-info"><div class="doc-name">${escapeHtml(m.filename)}</div><div class="doc-size">${fs}</div></div></a>`;
  }
  const t = new Date(m.time || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const senderName = escapeHtml(normalizeText(m.from || ''));
  msg.innerHTML = `
    ${m.from !== username && !isGroupChat ? `<div class="message-sender">${senderName}</div>` : ""}
    ${isGroupChat && m.from !== username ? `<div class="message-sender">${senderName}</div>` : ""}
    ${content}
    ${reactionsHtml}
    ${expireHtml}
    ${actionsHtml}
    <div class="message-time">
      ${t}
      ${m.from === username ? `<span class="message-status ${status}">${status === 'read' ? '✓✓' : status === 'sent' ? '✓' : '⏳'}</span>` : ''}
    </div>`;
  wrap.appendChild(msg);
  md.appendChild(wrap);
  setTimeout(() => { wrap.style.opacity = 1; wrap.style.transform = 'translateY(0)'; wrap.style.transition = 'all .3s ease'; }, 10);
  md.scrollTop = md.scrollHeight;
  if (m.expiresAt) registerEphemeral(m.id, m.expiresAt, wrap, m.from);
}

function renderReactions(messageId, reactions) {
  const items = [];
  Object.keys(reactions || {}).forEach(emoji => {
    const users = reactions[emoji] || {};
    const count = Object.keys(users).length;
    if (!count) return;
    const active = !!users[username];
    items.push(`<button class="reaction-emoji ${active ? 'active' : ''}" data-message-id="${messageId}" data-emoji="${emoji}">${emoji} <span>${count}</span></button>`);
  });
  if (!items.length) return '';
  return `<div class="message-reactions">${items.join('')}</div>`;
}

function getMessagePreview(m) {
  if (!m) return '';
  if (m.text) return m.text;
  if (m.photo) return '📷 Фото';
  if (m.video) return m.type === 'video_message' ? '🎥 Видеосообщение' : '🎥 Видео';
  if (m.audio) return '🎵 Аудио';
  if (m.document) return '📄 Документ';
  return 'Сообщение';
}

function setReply(messageId, from, text) {
  replyToMessage = { id: messageId, from: from, text: text };
  const bar = document.getElementById('replyBar');
  const content = document.getElementById('replyContent');
  if (bar && content) {
    const name = from === username ? 'Вы' : (displayNameCache[from] || from);
    content.textContent = `${name}: ${text}`;
    bar.classList.add('active');
  }
}

function clearReply() {
  replyToMessage = null;
  const bar = document.getElementById('replyBar');
  const content = document.getElementById('replyContent');
  if (content) content.textContent = '';
  if (bar) bar.classList.remove('active');
}

function startReply(messageId) {
  const el = document.getElementById(`message_${messageId}`);
  if (!el) return;
  const from = el.dataset.from || '';
  const textEl = el.querySelector('.message-text');
  const text = textEl ? (textEl.textContent || '') : getMessagePreview({});
  setReply(messageId, from, text);
}

async function deleteMessage(messageId, e) {
  if (e) e.stopPropagation();
  if (!chatRef || !messageId) return;
  const el = document.getElementById(`message_${messageId}`);
  const from = el ? el.dataset.from : null;
  if (from && from !== username) { showError('Можно удалить только свои сообщения'); return; }
  if (!confirm('Удалить сообщение?')) return;
  try {
    await chatRef.child(messageId).remove();
  } catch (e) {
    showError('Не удалось удалить сообщение');
  }
}

async function forwardMessage(messageId, e) {
  if (e) e.stopPropagation();
  if (!chatRef || !messageId) return;
  const snap = await chatRef.child(messageId).get();
  if (!snap.exists()) { showError('Сообщение не найдено'); return; }
  const original = snap.val();
  const target = prompt('Кому переслать? Введите логин пользователя или ID группы:');
  if (!target) return;
  const targetUser = await db.ref(`accounts/${target}`).get();
  let path = '';
  let targetChatId = '';
  if (targetUser.exists()) {
    targetChatId = [username, target].sort().join("_");
    path = `privateChats/${targetChatId}`;
  } else {
    const targetGroup = await db.ref(`groups/${target}`).get();
    if (!targetGroup.exists()) { showError('Пользователь/группа не найдены'); return; }
    targetChatId = target;
    path = `groupChats/${targetChatId}`;
  }
  const forwarded = {
    from: username,
    time: Date.now(),
    sent: true,
    delivered: false,
    read: false,
    status: 'sent',
    forwardedFrom: original.from || ''
  };
  if (original.text) forwarded.text = original.text;
  if (original.photo) forwarded.photo = original.photo;
  if (original.video) forwarded.video = original.video;
  if (original.audio) forwarded.audio = original.audio;
  if (original.document) {
    forwarded.document = original.document;
    forwarded.filename = original.filename;
    forwarded.filesize = original.filesize;
  }
  if (original.type) forwarded.type = original.type;
  if (original.duration) forwarded.duration = original.duration;
  const expiresAt = typeof getEphemeralExpiresAt === 'function' ? getEphemeralExpiresAt() : null;
  if (expiresAt) forwarded.expiresAt = expiresAt;
  await db.ref(path).push(forwarded);
  showNotification('Переслано', 'Сообщение переслано');
}

function updateMessageInChat(m) {
  const wrap = document.getElementById(`message_${m.id}`);
  if (!wrap) return;
  const msg = wrap.querySelector('.message');
  if (!msg) return;
  const reactionsHtml = renderReactions(m.id, m.reactions || {});
  const currentReactions = msg.querySelector('.message-reactions');
  if (reactionsHtml) {
    if (currentReactions) currentReactions.outerHTML = reactionsHtml;
    else msg.insertAdjacentHTML('beforeend', reactionsHtml);
  } else if (currentReactions) {
    currentReactions.remove();
  }
  const statusEl = msg.querySelector('.message-status');
  if (statusEl && m.from === username) {
    const status = m.read ? 'read' : (m.sent || m.delivered) ? 'sent' : 'error';
    statusEl.className = `message-status ${status}`;
    statusEl.textContent = status === 'read' ? '✓✓' : status === 'sent' ? '✓' : '⏳';
  }
}

function toggleReaction(messageId, emoji) {
  if (!chatRef || !messageId || !emoji || !username) return;
  const ref = chatRef.child(`${messageId}/reactions/${emoji}/${username}`);
  ref.get().then(s => {
    if (s.exists()) ref.remove();
    else ref.set(true);
  });
}

function showReactionPicker(target) {
  hideReactionPicker();
  const msg = target.closest('.message');
  if (!msg) return;
  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  picker.dataset.messageId = target.dataset.messageId;
  picker.innerHTML = reactionOptions.map(e => `<button class="reaction-option" data-emoji="${e}">${e}</button>`).join('');
  msg.appendChild(picker);
}

function hideReactionPicker() {
  document.querySelectorAll('.reaction-picker').forEach(p => p.remove());
}

function formatRemaining(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const ss = s % 60;
  const mm = m % 60;
  if (h > 0) return `${h}ч ${mm}м`;
  if (mm > 0) return `${mm}м ${ss}с`;
  return `${ss}с`;
}

function registerEphemeral(messageId, expiresAt, wrap, from) {
  ephemeralWatch.set(messageId, { expiresAt, wrap, from });
  if (!ephemeralInterval) {
    ephemeralInterval = setInterval(() => {
      const now = Date.now();
      ephemeralWatch.forEach((item, id) => {
        const remain = item.expiresAt - now;
        const el = item.wrap.querySelector('.message-expire');
        if (remain <= 0) {
          item.wrap.remove();
          ephemeralWatch.delete(id);
          if (item.from === username && chatRef) chatRef.child(id).remove();
        } else if (el) {
          el.textContent = `⏳ ${formatRemaining(remain)}`;
        }
      });
      if (ephemeralWatch.size === 0) {
        clearInterval(ephemeralInterval);
        ephemeralInterval = null;
      }
    }, 1000);
  }
}

function clearEphemeralWatch() {
  ephemeralWatch.clear();
  if (ephemeralInterval) {
    clearInterval(ephemeralInterval);
    ephemeralInterval = null;
  }
}

document.addEventListener('click', (e) => {
  const reactionBtn = e.target.closest('.reaction-btn');
  if (reactionBtn) {
    showReactionPicker(reactionBtn);
    return;
  }
  const reactionOption = e.target.closest('.reaction-option');
  if (reactionOption) {
    const picker = reactionOption.closest('.reaction-picker');
    const messageId = picker ? picker.dataset.messageId : null;
    const emoji = reactionOption.dataset.emoji;
    toggleReaction(messageId, emoji);
    hideReactionPicker();
    return;
  }
  const reactionEmoji = e.target.closest('.reaction-emoji');
  if (reactionEmoji) {
    toggleReaction(reactionEmoji.dataset.messageId, reactionEmoji.dataset.emoji);
    return;
  }
  if (!e.target.closest('.reaction-picker') && !e.target.closest('.reaction-btn')) {
    hideReactionPicker();
  }
});

async function sendMessage() {
  if (!checkConnection()) return;
  const ti = document.getElementById("text");
  const txt = ti.value.trim();
  if (!txt || !currentChatId || !chatRef || !username) { showError("Введите сообщение или выберите чат!"); return; }
  const btn = document.getElementById("sendBtn");
  const orig = btn.innerHTML;
  btn.innerHTML = "⏳"; btn.style.animation = "rotate 1s linear infinite";
  try {
    const expiresAt = typeof getEphemeralExpiresAt === 'function' ? getEphemeralExpiresAt() : null;
    const msg = { from: username, text: txt, time: Date.now(), sent: true, delivered: false, read: false, status: 'sent' };
    if (expiresAt) msg.expiresAt = expiresAt;
    if (replyToMessage) {
      msg.replyTo = { id: replyToMessage.id, from: replyToMessage.from, text: replyToMessage.text };
    }
    await chatRef.push(msg);
    ti.value = ""; updateSendButton();
    clearReply();
    
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
  if (blockedCache[fn]) { showError("Пользователь заблокирован"); return; }
  showLoading();
  db.ref("accounts/" + fn).get().then(async s => {
    if (!s.exists()) { showError("Пользователь не найден"); return; }
    const blockedBy = await db.ref(`accounts/${fn}/blocked/${username}`).get();
    if (blockedBy.exists()) { showError("Этот пользователь недоступен"); return; }
    const alreadyFriend = await db.ref(`accounts/${username}/friends/${fn}`).get();
    if (alreadyFriend.exists()) { showNotification("Друзья", "Этот пользователь уже в друзьях"); return; }
    const incoming = await db.ref(`accounts/${username}/friendRequests/incoming/${fn}`).get();
    if (incoming.exists()) {
      const accept = confirm("У вас уже есть заявка от этого пользователя. Принять?");
      if (accept) await acceptFriendRequest(fn);
      return;
    }
    const outgoing = await db.ref(`accounts/${username}/friendRequests/outgoing/${fn}`).get();
    if (outgoing.exists()) { showNotification("Заявка", "Запрос уже отправлен"); return; }
    await db.ref(`accounts/${fn}/friendRequests/incoming/${username}`).set(true);
    await db.ref(`accounts/${username}/friendRequests/outgoing/${fn}`).set(true);
    showNotification("Заявка", `Запрос отправлен пользователю ${fn}`);
  }).catch(() => { showError("Ошибка поиска пользователя"); })
    .finally(() => hideLoading());
}

function loadFriendRequests() {
  const list = document.getElementById("friendRequestsList");
  if (!list) return;
  db.ref(`accounts/${username}/friendRequests/incoming`).on("value", snap => {
    list.innerHTML = "";
    if (!snap.exists()) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">🤝</div>
          <div class="title">Нет заявок</div>
          <div class="description">Новые заявки появятся здесь</div>
        </div>`;
      return;
    }
    let hasAny = false;
    snap.forEach(ch => {
      const from = ch.key;
      if (blockedCache[from]) return;
      hasAny = true;
      createRequestItem(from);
    });
    if (!hasAny) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">🤝</div>
          <div class="title">Нет заявок</div>
          <div class="description">Новые заявки появятся здесь</div>
        </div>`;
    }
  });
}

function createRequestItem(from) {
  const list = document.getElementById("friendRequestsList");
  const item = document.createElement("div");
  item.className = "request-item";
  const name = displayNameCache[from] || normalizeText(from);
  item.innerHTML = `
    <img class="contact-avatar" id="req_avatar_${from}" alt="${name}" onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0088cc&color=fff&size=48'">
    <div class="request-name" id="req_name_${from}">${name}</div>
    <div class="request-actions">
      <button class="request-btn accept" title="Принять">Принять</button>
      <button class="request-btn reject" title="Отклонить">Отклонить</button>
    </div>`;
  list.appendChild(item);
  const acceptBtn = item.querySelector('.request-btn.accept');
  const rejectBtn = item.querySelector('.request-btn.reject');
  acceptBtn.onclick = (e) => { e.stopPropagation(); acceptFriendRequest(from); };
  rejectBtn.onclick = (e) => { e.stopPropagation(); rejectFriendRequest(from); };
  db.ref("accounts/" + from + "/avatar").once("value").then(s => {
    const av = document.getElementById(`req_avatar_${from}`);
    const url = s.val();
    if (av) {
      if (s.exists() && url && (typeof isValidMediaUrl !== 'function' || isValidMediaUrl(url))) av.src = url;
      else av.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0088cc&color=fff&size=48`;
    }
  });
  db.ref("accounts/" + from + "/displayName").once("value").then(s => {
    const dn = s.val();
    const display = typeof normalizeText === 'function' ? normalizeText(dn || from) : (dn || from);
    displayNameCache[from] = display;
    const nameEl = document.getElementById(`req_name_${from}`);
    if (nameEl) nameEl.textContent = display;
  });
}

async function acceptFriendRequest(from) {
  try {
    showLoading();
    await db.ref(`accounts/${username}/friendRequests/incoming/${from}`).remove();
    await db.ref(`accounts/${from}/friendRequests/outgoing/${username}`).remove();
    await db.ref(`accounts/${username}/friends/${from}`).set(true);
    await db.ref(`accounts/${from}/friends/${username}`).set(true);
    showNotification("Друзья", `Теперь вы друзья с ${from}`);
  } catch (e) {
    showError("Не удалось принять заявку");
  } finally {
    hideLoading();
  }
}

async function rejectFriendRequest(from) {
  try {
    showLoading();
    await db.ref(`accounts/${username}/friendRequests/incoming/${from}`).remove();
    await db.ref(`accounts/${from}/friendRequests/outgoing/${username}`).remove();
    showNotification("Заявка", "Заявка отклонена");
  } catch (e) {
    showError("Не удалось отклонить заявку");
  } finally {
    hideLoading();
  }
}

async function removeFriend(fn, e) {
  if (e) e.stopPropagation();
  if (!confirm(`Удалить ${fn} из друзей?`)) return;
  try {
    showLoading();
    await db.ref(`accounts/${username}/friends/${fn}`).remove();
    await db.ref(`accounts/${fn}/friends/${username}`).remove();
    showNotification("Друзья", "Пользователь удален");
  } catch (error) {
    showError("Не удалось удалить");
  } finally {
    hideLoading();
  }
}

async function blockUser(fn, e) {
  if (e) e.stopPropagation();
  if (!confirm(`Заблокировать ${fn}?`)) return;
  try {
    showLoading();
    await db.ref(`accounts/${username}/blocked/${fn}`).set(true);
    await db.ref(`accounts/${username}/friends/${fn}`).remove();
    await db.ref(`accounts/${fn}/friends/${username}`).remove();
    await db.ref(`accounts/${username}/friendRequests/incoming/${fn}`).remove();
    await db.ref(`accounts/${username}/friendRequests/outgoing/${fn}`).remove();
    await db.ref(`accounts/${fn}/friendRequests/incoming/${username}`).remove();
    await db.ref(`accounts/${fn}/friendRequests/outgoing/${username}`).remove();
    showNotification("Блокировка", "Пользователь заблокирован");
  } catch (error) {
    showError("Не удалось заблокировать");
  } finally {
    hideLoading();
  }
}

async function unblockUser(fn) {
  if (!confirm(`Разблокировать ${fn}?`)) return;
  try {
    showLoading();
    await db.ref(`accounts/${username}/blocked/${fn}`).remove();
    showNotification("Блокировка", "Пользователь разблокирован");
  } catch (error) {
    showError("Не удалось разблокировать");
  } finally {
    hideLoading();
  }
}

















