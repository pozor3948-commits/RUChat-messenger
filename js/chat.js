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
const friendPrivacyCache = {};
window.friendPrivacyCache = friendPrivacyCache;
const groupValueListeners = {};

const lastMessageKeyByChat = {};
const reactionOptions = ['👍','❤️','😂','😮','😢','😡'];
const ephemeralWatch = new Map();
let ephemeralInterval = null;
let replyToMessage = null;
let pendingChatBgValue = '';
let editingMessageId = null;
let editingOriginalText = '';
let mediaLibraryTab = 'photos';
let mediaLibraryCache = { photos: [], videos: [], files: [] };
let mediaLibraryChatId = null;
let currentGroupRole = 'member';
let currentGroupName = '';
const renderedClientMessageIds = new Set();
let currentChatPath = '';
let oldestLoadedKey = null;
let newestLoadedKey = null;
let hasMoreHistory = true;
let isHistoryLoading = false;
let addedMessagesQuery = null;
let addedMessagesHandler = null;
const CHAT_INITIAL_PAGE_SIZE = 80;
const CHAT_HISTORY_PAGE_SIZE = 60;
const SEND_RATE_WINDOW_MS = 3000;
const SEND_RATE_MAX_MESSAGES = 8;
let sendRateTimestamps = [];

function chatCacheKey(path) {
  return `ruchat_chat_cache_${path.replace(/[^\w]/g, '_')}`;
}

function readChatCache(path) {
  try {
    const raw = localStorage.getItem(chatCacheKey(path));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function writeChatCache(path, items) {
  try {
    const prepared = (items || []).slice(-120).map(m => ({
      id: m.id,
      from: m.from || '',
      text: m.text || '',
      time: m.time || 0,
      sent: !!m.sent,
      delivered: !!m.delivered,
      read: !!m.read,
      edited: !!m.edited,
      editedAt: m.editedAt || 0,
      photo: m.photo || '',
      video: m.video || '',
      audio: m.audio || '',
      document: m.document || '',
      filename: m.filename || '',
      filesize: m.filesize || 0,
      type: m.type || '',
      duration: m.duration || 0,
      sticker: m.sticker || '',
      stickerEmoji: m.stickerEmoji || '',
      clientMessageId: m.clientMessageId || ''
    }));
    localStorage.setItem(chatCacheKey(path), JSON.stringify(prepared));
  } catch {
    // ignore cache errors
  }
}

function upsertChatCacheMessage(path, message) {
  if (!path || !message || !message.id) return;
  const list = readChatCache(path);
  const idx = list.findIndex(m => m.id === message.id);
  if (idx >= 0) list[idx] = { ...list[idx], ...message };
  else list.push(message);
  list.sort((a, b) => String(a.id).localeCompare(String(b.id)));
  writeChatCache(path, list);
}

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
  const delayStep = isMobile ? 0 : 50;
  visibleKeys.forEach((fn, idx) => {
    setTimeout(() => {
      createFriendItem(fn);
      friendStatusListeners[fn] = db.ref(`userStatus/${fn}`).on("value", st => updateFriendStatusInList(fn, st.val()));
      db.ref(`userStatus/${fn}`).once("value").then(s => updateFriendStatusInList(fn, s.val()));
    }, idx * delayStep);
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
  item.style.animation = isMobile ? "none" : "slideUp .3s ease-out";
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
  db.ref(`accounts/${fn}/privacy/showLastSeen`).on("value", s => {
    friendPrivacyCache[fn] = s.val() || 'everyone';
    if (typeof updateFriendStatusInList === 'function') {
      updateFriendStatusInList(fn, userStatuses[fn] || null);
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
          if (typeof maybeShowSystemNotification === 'function') {
            const title = displayNameCache[fn] || fn;
            const body = m.text ? normalizeText(m.text) : getMessagePreview(m);
            maybeShowSystemNotification(title, body, { tag: `chat_${chatId}` });
          }
        }
      }
    });
  });
}

function loadGroups() {
  const gl = document.getElementById("groupList");
  const clearGroupRefs = () => {
    Object.keys(groupValueListeners).forEach(gid => {
      db.ref(`groups/${gid}`).off("value", groupValueListeners[gid]);
      delete groupValueListeners[gid];
    });
  };
  const renderEmpty = () => {
    gl.innerHTML = `
      <div class="empty-state">
        <div class="icon">👥</div>
        <div class="title">У вас пока нет групп</div>
        <div class="description">Создайте группу или вас пригласят</div>
      </div>`;
  };

  db.ref(`usersGroups/${username}`).on("value", snap => {
    clearGroupRefs();
    gl.innerHTML = "";

    if (!snap.exists()) {
      // Fallback для старых данных, пока индекс не собран функциями
      db.ref("groups").orderByChild("members/" + username).equalTo(true).once("value").then(oldSnap => {
        gl.innerHTML = "";
        if (!oldSnap.exists()) { renderEmpty(); return; }
        const delayStep = isMobile ? 0 : 50;
        let idx = 0;
        oldSnap.forEach(ch => {
          const g = ch.val(), gid = ch.key;
          setTimeout(() => createGroupItem(g, gid), idx * delayStep);
          idx++;
        });
      });
      return;
    }

    const groupIds = Object.keys(snap.val() || {});
    if (!groupIds.length) { renderEmpty(); return; }
    const delayStep = isMobile ? 0 : 50;
    let idx = 0;
    groupIds.forEach(gid => {
      const scheduledDelay = idx * delayStep;
      const handler = gs => {
        if (!gs.exists()) {
          const item = document.getElementById(`group_${gid}`);
          if (item) item.remove();
          return;
        }
        createGroupItem(gs.val() || {}, gid);
      };
      const listener = gs => {
        setTimeout(() => handler(gs), scheduledDelay);
      };
      groupValueListeners[gid] = listener;
      db.ref(`groups/${gid}`).on("value", listener);
      idx++;
    });
  });
}

function createGroupItem(g, gid) {
  const groupName = normalizeText(g.name);
  const myRole = (g.roles && g.roles[username]) ? g.roles[username] : 'member';
  const roleLabel = myRole === 'owner' ? 'Владелец' : (myRole === 'admin' ? 'Админ' : 'Участник');
  const gl = document.getElementById("groupList");
  let item = document.getElementById(`group_${gid}`);
  if (!item) {
    item = document.createElement("div");
    item.className = "group-item";
    item.id = `group_${gid}`;
    item.style.animation = isMobile ? "none" : "slideUp .3s ease-out";
    gl.appendChild(item);
  }
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
      <div class="last-seen online">Группа • ${roleLabel}</div>
    </div>`;
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
    const delayStep = isMobile ? 0 : 100;
    let cnt = 0;
    snap.forEach(ch => {
      const fn = ch.key;
      cnt++;
      setTimeout(() => {
        db.ref("accounts/" + fn + "/stories").limitToLast(1).once("value", st => {
          if (st.exists()) createStoryItem(fn); else if (cnt === Object.keys(snap.val()).length) checkEmptyStories();
        });
      }, cnt * delayStep);
    });
  });
}

function createStoryItem(fn) {
  const sl = document.getElementById("storiesList");
  const item = document.createElement("div");
  item.className = "story-item";
  item.style.animation = isMobile ? "none" : "slideUp .5s ease-out";
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

function updateGroupManageMenuVisibility() {
  const item = document.getElementById('groupManageMenuItem');
  if (!item) return;
  if (!isGroupChat || !currentChatId) {
    item.style.display = 'none';
    return;
  }
  item.style.display = 'block';
}

/* ==========================================================
   7. ЧАТЫ / СООБЩЕНИЯ
   ========================================================== */
function openPrivateChat(fn) {
  setActiveChatItem('contact', fn);
  isGroupChat = false;
  currentChatId = [username, fn].sort().join("_");
  currentChatPartner = fn;
  currentGroupRole = 'member';
  currentGroupName = '';
  if (typeof clearMessageSearch === 'function') clearMessageSearch();
  if (typeof clearReply === 'function') clearReply();
  if (typeof clearEdit === 'function') clearEdit();
  const displayName = displayNameCache[fn] || normalizeText(fn);
  document.getElementById("chatWith").textContent = displayName;
  document.getElementById("mobileChatTitle").textContent = displayName;
  if (isMobile) document.getElementById('mobileBackBtn').classList.add('active');
  const chatAvatar = document.getElementById("chatAvatar");
  const fAvatar = document.getElementById(`avatar_${fn}`);
  if (fAvatar) chatAvatar.src = fAvatar.src; else chatAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0088cc&color=fff&size=44`;
  const mobileAvatar = document.getElementById('mobileChatAvatar');
  if (mobileAvatar) {
    mobileAvatar.style.display = 'block';
    mobileAvatar.src = fAvatar ? fAvatar.src : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=0088cc&color=fff&size=44`;
  }
  const st = userStatuses[fn];
  updateChatStatus(fn, st);
  if (typeof applyChatBackground === 'function') applyChatBackground(currentChatId);
  loadChat("privateChats/" + currentChatId);
  setupTypingIndicator();
  if (typeof updateCallButtonVisibility === 'function') updateCallButtonVisibility();
  updateGroupManageMenuVisibility();
  flushPendingQueue();
}

function openGroupChat(g, gid) {
  setActiveChatItem('group', gid);
  isGroupChat = true;
  currentChatId = gid;
  currentChatPartner = null;
  if (typeof clearMessageSearch === 'function') clearMessageSearch();
  if (typeof clearReply === 'function') clearReply();
  if (typeof clearEdit === 'function') clearEdit();
  const groupName = normalizeText(g.name);
  currentGroupRole = (g.roles && g.roles[username]) ? g.roles[username] : 'member';
  currentGroupName = groupName;
  document.getElementById("chatWith").textContent = groupName;
  document.getElementById("mobileChatTitle").textContent = groupName;
  if (isMobile) document.getElementById('mobileBackBtn').classList.add('active');
  const chatAvatar = document.getElementById("chatAvatar");
  const gAvatar = document.getElementById(`group_avatar_${gid}`);
  if (gAvatar) chatAvatar.src = gAvatar.src; else chatAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=0088cc&color=fff&size=44`;
  const mobileAvatar = document.getElementById('mobileChatAvatar');
  if (mobileAvatar) {
    mobileAvatar.style.display = 'block';
    mobileAvatar.src = gAvatar ? gAvatar.src : `https://ui-avatars.com/api/?name=${encodeURIComponent(groupName)}&background=0088cc&color=fff&size=44`;
  }
  const mc = Object.keys(g.members || {}).length;
  document.getElementById("chatMembers").textContent = `${mc} участников`;
  document.getElementById("mobileChatStatus").textContent = `${mc} участников`;
  if (typeof applyChatBackground === 'function') applyChatBackground(currentChatId);
  loadChat("groupChats/" + currentChatId);
  if (typeof updateCallButtonVisibility === 'function') updateCallButtonVisibility();
  updateGroupManageMenuVisibility();
  flushPendingQueue();
}

function loadChat(path) {
  if (chatRef) chatRef.off();
  if (addedMessagesQuery && addedMessagesHandler) {
    addedMessagesQuery.off("child_added", addedMessagesHandler);
    addedMessagesQuery = null;
    addedMessagesHandler = null;
  }
  clearEphemeralWatch();
  currentChatPath = path;
  chatRef = db.ref(path);
  oldestLoadedKey = null;
  newestLoadedKey = null;
  hasMoreHistory = true;
  isHistoryLoading = false;
  renderedClientMessageIds.clear();

  const md = document.getElementById("messages");
  md.innerHTML = "";
  md.style.opacity = 1;
  md.onscroll = handleMessagesScroll;
  const expectedPath = path;
  const cachedMessages = readChatCache(path);
  if (cachedMessages.length) {
    cachedMessages.forEach(m => addMessageToChat(m, { autoScroll: false, animate: false }));
    oldestLoadedKey = cachedMessages[0].id || null;
    newestLoadedKey = cachedMessages[cachedMessages.length - 1].id || null;
    md.scrollTop = md.scrollHeight;
  }

  chatRef.orderByKey().limitToLast(CHAT_INITIAL_PAGE_SIZE).once("value").then(snap => {
    if (currentChatPath !== expectedPath) return;
    const items = [];
    snap.forEach(ch => {
      const m = ch.val();
      if (!m) return;
      m.id = ch.key;
      if (m.text === undefined || m.text === null) m.text = "";
      items.push(m);
    });
    items.forEach(m => addMessageToChat(m, { autoScroll: false, animate: false }));
    oldestLoadedKey = items.length ? items[0].id : null;
    newestLoadedKey = items.length ? items[items.length - 1].id : null;
    hasMoreHistory = items.length === CHAT_INITIAL_PAGE_SIZE;
    md.scrollTop = md.scrollHeight;
    writeChatCache(path, items);
    markCurrentChatAsRead();
    setupAddedMessagesListener();
  });

  chatRef.on("child_changed", snap => {
    const m = snap.val();
    if (!m) return;
    m.id = snap.key;
    updateMessageInChat(m);
    upsertChatCacheMessage(currentChatPath, m);
  });
  chatRef.on("child_removed", snap => {
    const el = document.getElementById(`message_${snap.key}`);
    if (el) el.remove();
    const list = readChatCache(currentChatPath).filter(m => m.id !== snap.key);
    writeChatCache(currentChatPath, list);
  });
}

function setupAddedMessagesListener() {
  if (!chatRef) return;
  const anchor = newestLoadedKey;
  let skipAnchor = !!anchor;
  addedMessagesQuery = anchor ? chatRef.orderByKey().startAt(anchor) : chatRef.limitToLast(1);
  addedMessagesHandler = snap => {
    const m = snap.val();
    if (!m) return;
    m.id = snap.key;
    if (skipAnchor && anchor && m.id === anchor) {
      skipAnchor = false;
      return;
    }
    skipAnchor = false;
    if (m.text === undefined || m.text === null) m.text = "";
    newestLoadedKey = m.id;
    addMessageToChat(m);
    upsertChatCacheMessage(currentChatPath, m);
    markCurrentChatAsRead();
  };
  addedMessagesQuery.on("child_added", addedMessagesHandler);
}

function handleMessagesScroll() {
  const md = document.getElementById("messages");
  if (!md || isHistoryLoading || !hasMoreHistory) return;
  if (md.scrollTop <= 120) {
    loadOlderMessages();
  }
}

function loadOlderMessages() {
  if (!chatRef || !oldestLoadedKey || isHistoryLoading || !hasMoreHistory) return;
  const md = document.getElementById("messages");
  if (!md) return;
  isHistoryLoading = true;
  const expectedPath = currentChatPath;
  const prevHeight = md.scrollHeight;
  const prevTop = md.scrollTop;
  chatRef.orderByKey().endAt(oldestLoadedKey).limitToLast(CHAT_HISTORY_PAGE_SIZE + 1).once("value")
    .then(snap => {
      if (currentChatPath !== expectedPath) return;
      const items = [];
      snap.forEach(ch => {
        const m = ch.val();
        if (!m) return;
        m.id = ch.key;
        if (m.text === undefined || m.text === null) m.text = "";
        items.push(m);
      });
      if (items.length <= 1) {
        hasMoreHistory = false;
        return;
      }
      const older = items.slice(0, -1);
      older.forEach(m => addMessageToChat(m, { prepend: true, autoScroll: false, animate: false }));
      oldestLoadedKey = older[0].id;
      hasMoreHistory = older.length === CHAT_HISTORY_PAGE_SIZE;
      md.scrollTop = (md.scrollHeight - prevHeight) + prevTop;
    })
    .finally(() => {
      isHistoryLoading = false;
    });
}

function setActiveChatItem(kind, id) {
  document.querySelectorAll('.contact-item.active, .group-item.active')
    .forEach(el => el.classList.remove('active'));
  const el = document.getElementById(`${kind}_${id}`);
  if (el) el.classList.add('active');
}

function addMessageToChat(m, options = {}) {
  const opts = {
    prepend: false,
    autoScroll: true,
    animate: !isMobile,
    ...options
  };
  const md = document.getElementById("messages");
  if (document.getElementById(`message_${m.id}`)) return;
  if (m.clientMessageId && renderedClientMessageIds.has(m.clientMessageId)) return;
  
  if (m.from !== username && typeof playReceiveSound === 'function') {
    playReceiveSound();
  }
  if (m.from !== username && typeof maybeShowSystemNotification === 'function') {
    const chatTitle = document.getElementById('chatWith');
    const senderTitle = isGroupChat ? `${normalizeText(m.from || '')} • ${chatTitle ? chatTitle.textContent : 'Чат'}` : (displayNameCache[m.from] || m.from);
    const body = m.text ? normalizeText(m.text) : getMessagePreview(m);
    maybeShowSystemNotification(senderTitle, body, { tag: `chat_${currentChatId}` });
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
  const stickerUrl = (typeof isValidMediaUrl === 'function' && isValidMediaUrl(m.sticker)) ? m.sticker : null;
  if (!m.text && (m.photo || m.video || m.audio || m.document || m.sticker) && !photoUrl && !videoUrl && !audioUrl && !docUrl && !stickerUrl) {
    m.text = String(m.photo || m.video || m.audio || m.document || m.sticker);
  }
  if (!m.text && !photoUrl && !videoUrl && !audioUrl && !docUrl && !stickerUrl) return;
  const reactionsHtml = renderReactions(m.id, m.reactions || {});
  const expireHtml = "";
  const actionsHtml = `<div class="message-actions">
    <button class="reaction-btn" data-message-id="${m.id}" title="Реакции">😊</button>
    <button class="reaction-btn" onclick="startReply('${m.id}')" title="Ответить">↩</button>
    <button class="reaction-btn" onclick="forwardMessage('${m.id}')" title="Переслать">↗</button>
    ${m.from === username && m.text ? `<button class="reaction-btn" onclick="startEdit('${m.id}')" title="Редактировать">✎</button>` : ""}
    ${m.from === username ? `<button class="reaction-btn" onclick="deleteMessage('${m.id}')" title="Удалить">🗑</button>` : ""}
  </div>`;
  let content = "";
  const replyFrom = m.replyTo && m.replyTo.from ? (displayNameCache[m.replyTo.from] || m.replyTo.from) : '';
  const replyHtml = m.replyTo ? `<div class="message-reply">↩ ${escapeHtml(replyFrom)}: ${escapeHtml(m.replyTo.text || '')}</div>` : "";
  const fwdName = m.forwardedFrom ? (displayNameCache[m.forwardedFrom] || m.forwardedFrom) : '';
  const forwardedHtml = m.forwardedFrom ? `<div class="message-forwarded">↪ Переслано от ${escapeHtml(fwdName)}</div>` : "";
  if (m.text && !photoUrl && !videoUrl && !audioUrl && !docUrl) {
    content = `${forwardedHtml}${replyHtml}<div class="message-text">${escapeHtml(m.text)}</div>`;
  } else if (stickerUrl) {
    const emojiTag = m.stickerEmoji ? `<div class="sticker-emoji">${escapeHtml(m.stickerEmoji)}</div>` : '';
    content = `
      ${forwardedHtml}${replyHtml}${m.text ? `<div class="message-text">${escapeHtml(m.text)}</div>` : ''}
      <div class="message-sticker-wrap">
        <img src="${stickerUrl}" class="message-sticker" onclick="openMedia('${stickerUrl}')" alt="Стикер">
        ${emojiTag}
      </div>
    `;
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
      ${m.editedAt || m.edited ? `<span class="message-edited"> (изм.)</span>` : ''}
      ${m.from === username ? `<span class="message-status ${status}">${status === 'read' ? '✓✓' : status === 'sent' ? '✓' : ''}</span>` : ''}
    </div>`;
  wrap.appendChild(msg);
  if (m.clientMessageId) renderedClientMessageIds.add(m.clientMessageId);
  if (opts.prepend) {
    md.insertBefore(wrap, md.firstChild);
  } else {
    md.appendChild(wrap);
  }
  if (!opts.animate || isMobile) {
    wrap.style.opacity = 1;
    wrap.style.transform = 'none';
  } else {
    setTimeout(() => { wrap.style.opacity = 1; wrap.style.transform = 'translateY(0)'; wrap.style.transition = 'all .3s ease'; }, 10);
  }
  if (opts.autoScroll && !opts.prepend) {
    md.scrollTop = md.scrollHeight;
  }
  // авто-удаление отключено
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
  if (m.sticker) return '🧩 Стикер';
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

function getReplyToMessage() {
  return replyToMessage;
}

window.getReplyToMessage = getReplyToMessage;

function startReply(messageId) {
  const el = document.getElementById(`message_${messageId}`);
  if (!el) return;
  const from = el.dataset.from || '';
  const textEl = el.querySelector('.message-text');
  const text = textEl ? (textEl.textContent || '') : getMessagePreview({});
  setReply(messageId, from, text);
}

function startEdit(messageId) {
  const el = document.getElementById(`message_${messageId}`);
  if (!el) return;
  const from = el.dataset.from || '';
  if (from !== username) { showError('Можно редактировать только свои сообщения'); return; }
  const textEl = el.querySelector('.message-text');
  const text = textEl ? (textEl.textContent || '') : '';
  if (!text) { showError('Редактировать можно только текстовые сообщения'); return; }
  editingMessageId = messageId;
  editingOriginalText = text;
  const input = document.getElementById('text');
  if (input) {
    input.value = text;
    input.focus();
    updateSendButton();
  }
  if (typeof clearReply === 'function') clearReply();
  const bar = document.getElementById('editBar');
  const content = document.getElementById('editContent');
  if (content) content.textContent = text;
  if (bar) bar.classList.add('active');
}

function clearEdit() {
  editingMessageId = null;
  editingOriginalText = '';
  const bar = document.getElementById('editBar');
  const content = document.getElementById('editContent');
  if (content) content.textContent = '';
  if (bar) bar.classList.remove('active');
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
    clientMessageId: createClientMessageId(),
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
  const sent = navigator.onLine ? await sendMessagePayload(path, forwarded) : false;
  if (!sent) {
    enqueuePendingMessage(path, forwarded);
    showNotification('Сеть', 'Пересылка поставлена в очередь');
  } else {
    showNotification('Переслано', 'Сообщение переслано');
  }
}

function updateMessageInChat(m) {
  const wrap = document.getElementById(`message_${m.id}`);
  if (!wrap) return;
  const msg = wrap.querySelector('.message');
  if (!msg) return;
  const textEl = msg.querySelector('.message-text');
  if (textEl && typeof m.text === 'string') {
    textEl.textContent = m.text;
  }
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
    if (status === 'read') {
      statusEl.textContent = '✓✓';
      statusEl.style.display = 'inline-block';
    } else if (status === 'sent') {
      statusEl.textContent = '✓';
      statusEl.style.display = 'inline-block';
    } else {
      statusEl.textContent = '';
      statusEl.style.display = 'none';
    }
  }
  const editedEl = msg.querySelector('.message-edited');
  if (m.editedAt || m.edited) {
    if (!editedEl) {
      const timeEl = msg.querySelector('.message-time');
      if (timeEl) timeEl.insertAdjacentHTML('beforeend', `<span class="message-edited"> (изм.)</span>`);
    }
  } else if (editedEl) {
    editedEl.remove();
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

function applyChatBackground(chatId) {
  const md = document.getElementById('messages');
  if (!md || !chatId) return;
  const key = `ruchat_chat_bg_${chatId}`;
  const value = localStorage.getItem(key) || '';
  if (!value) {
    md.style.backgroundImage = '';
    md.style.backgroundColor = '';
    return;
  }
  if (/^(https?:|data:|blob:|url\()/i.test(value)) {
    md.style.backgroundImage = value.startsWith('url(') ? value : `url('${value}')`;
    md.style.backgroundSize = 'cover';
    md.style.backgroundPosition = 'center';
    md.style.backgroundRepeat = 'no-repeat';
  } else {
    md.style.backgroundImage = '';
    md.style.background = value;
  }
}

function openChatBackground() {
  if (!currentChatId) { showError('Сначала откройте чат'); return; }
  const overlay = document.getElementById('chatBgOverlay');
  if (!overlay) return;
  const key = `ruchat_chat_bg_${currentChatId}`;
  pendingChatBgValue = localStorage.getItem(key) || '';
  const preview = document.getElementById('chatBgPreviewBox');
  if (preview) {
    preview.style.backgroundImage = '';
    preview.style.background = pendingChatBgValue || 'rgba(255,255,255,0.04)';
    if (/^(https?:|data:|blob:|url\()/i.test(pendingChatBgValue)) {
      preview.style.background = 'transparent';
      preview.style.backgroundImage = pendingChatBgValue.startsWith('url(') ? pendingChatBgValue : `url('${pendingChatBgValue}')`;
      preview.style.backgroundSize = 'cover';
      preview.style.backgroundPosition = 'center';
    }
  }
  document.querySelectorAll('.chat-bg-item').forEach(b => b.classList.remove('active'));
  if (pendingChatBgValue) {
    document.querySelectorAll('.chat-bg-item').forEach(b => {
      if (b.dataset.bg === pendingChatBgValue) b.classList.add('active');
    });
  }
  overlay.classList.add('active');
}

function closeChatBackground() {
  const overlay = document.getElementById('chatBgOverlay');
  if (overlay) overlay.classList.remove('active');
}

function selectChatBackground(btn) {
  if (!btn) return;
  const value = btn.dataset.bg || '';
  pendingChatBgValue = value;
  document.querySelectorAll('.chat-bg-item').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const preview = document.getElementById('chatBgPreviewBox');
  if (preview) {
    preview.style.backgroundImage = '';
    preview.style.background = value || 'rgba(255,255,255,0.04)';
    if (/^url\(/i.test(value) || /^(https?:|data:|blob:)/i.test(value)) {
      preview.style.background = 'transparent';
      preview.style.backgroundImage = value.startsWith('url(') ? value : `url('${value}')`;
      preview.style.backgroundSize = 'cover';
      preview.style.backgroundPosition = 'center';
    }
  }
}

function handleChatBgFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showError('Нужна картинка'); return; }
  const reader = new FileReader();
  reader.onload = () => {
    pendingChatBgValue = reader.result;
    const preview = document.getElementById('chatBgPreviewBox');
    if (preview) {
      preview.style.background = 'transparent';
      preview.style.backgroundImage = `url('${pendingChatBgValue}')`;
      preview.style.backgroundSize = 'cover';
      preview.style.backgroundPosition = 'center';
    }
    document.querySelectorAll('.chat-bg-item').forEach(b => b.classList.remove('active'));
  };
  reader.readAsDataURL(file);
}

function saveChatBackground() {
  if (!currentChatId) return;
  const key = `ruchat_chat_bg_${currentChatId}`;
  if (!pendingChatBgValue) {
    localStorage.removeItem(key);
  } else {
    localStorage.setItem(key, pendingChatBgValue);
  }
  applyChatBackground(currentChatId);
  closeChatBackground();
}

function getRoleLabel(role) {
  if (role === 'owner') return 'Владелец';
  if (role === 'admin') return 'Админ';
  return 'Участник';
}

function roleSortValue(role) {
  if (role === 'owner') return 0;
  if (role === 'admin') return 1;
  return 2;
}

function closeGroupAdminPanel() {
  const overlay = document.getElementById('groupAdminOverlay');
  if (overlay) overlay.classList.remove('active');
}

function renderGroupAdminList(groupData) {
  const list = document.getElementById('groupAdminList');
  const subtitle = document.getElementById('groupAdminSubtitle');
  const leaveBtn = document.getElementById('leaveGroupBtn');
  if (!list) return;

  const membersMap = groupData.members || {};
  const roles = groupData.roles || {};
  const members = Object.keys(membersMap).filter(name => membersMap[name] === true);
  const myRole = roles[username] || 'member';
  currentGroupRole = myRole;
  currentGroupName = normalizeText(groupData.name || currentGroupName || 'Группа');

  if (subtitle) {
    subtitle.textContent = `${members.length} участников • Ваша роль: ${getRoleLabel(myRole)}`;
  }
  if (leaveBtn) {
    leaveBtn.style.display = 'inline-block';
  }

  const sorted = members.sort((a, b) => {
    const roleCmp = roleSortValue(roles[a] || 'member') - roleSortValue(roles[b] || 'member');
    if (roleCmp !== 0) return roleCmp;
    return String(a).localeCompare(String(b));
  });

  if (!sorted.length) {
    list.innerHTML = `<div class="group-admin-empty">В группе нет участников</div>`;
    return;
  }

  const canManageRoles = myRole === 'owner';
  const canKickAsAdmin = myRole === 'admin';
  const ownerName = groupData.createdBy || sorted.find(n => (roles[n] || '') === 'owner') || '';

  list.innerHTML = sorted.map(memberName => {
    const role = roles[memberName] || (memberName === ownerName ? 'owner' : 'member');
    const displayName = escapeHtml(displayNameCache[memberName] || normalizeText(memberName));
    const isMe = memberName === username;
    const roleBadge = `<span class="group-role-badge">${getRoleLabel(role)}${isMe ? ' • Вы' : ''}</span>`;
    const controls = [];

    if (canManageRoles && !isMe && memberName !== ownerName && role === 'member') {
      controls.push(`<button class="group-role-btn promote" onclick="setGroupRole('${memberName}','admin')">Сделать админом</button>`);
    }
    if (canManageRoles && !isMe && memberName !== ownerName && role === 'admin') {
      controls.push(`<button class="group-role-btn demote" onclick="setGroupRole('${memberName}','member')">Снять админа</button>`);
    }
    if (canManageRoles && !isMe && memberName !== ownerName) {
      controls.push(`<button class="group-role-btn remove" onclick="removeGroupMember('${memberName}')">Удалить</button>`);
    }
    if (canKickAsAdmin && !isMe && role === 'member') {
      controls.push(`<button class="group-role-btn remove" onclick="removeGroupMember('${memberName}')">Удалить</button>`);
    }

    return `
      <div class="group-admin-item">
        <div class="group-admin-user">
          <div class="group-admin-name">${displayName}</div>
          <div class="group-admin-role">@${escapeHtml(memberName)}</div>
        </div>
        <div class="group-admin-controls">
          ${roleBadge}
          ${controls.join('')}
        </div>
      </div>
    `;
  }).join('');
}

async function openGroupAdminPanel() {
  if (!isGroupChat || !currentChatId) {
    showError('Откройте группу');
    return;
  }
  const overlay = document.getElementById('groupAdminOverlay');
  const title = document.getElementById('groupAdminTitle');
  const list = document.getElementById('groupAdminList');
  const settingsMenu = document.getElementById('chatSettingsMenu');
  if (!overlay || !list) return;
  if (settingsMenu) settingsMenu.classList.remove('active');

  overlay.classList.add('active');
  list.innerHTML = `<div class="group-admin-empty">Загрузка...</div>`;
  if (title) title.textContent = currentGroupName ? `Управление: ${currentGroupName}` : 'Управление группой';

  try {
    const snap = await db.ref(`groups/${currentChatId}`).get();
    if (!snap.exists()) {
      showError('Группа не найдена');
      closeGroupAdminPanel();
      return;
    }
    const groupData = snap.val() || {};
    const groupName = normalizeText(groupData.name || 'Группа');
    currentGroupRole = (groupData.roles && groupData.roles[username]) ? groupData.roles[username] : 'member';
    currentGroupName = groupName;
    if (title) title.textContent = `Управление: ${groupName}`;
    renderGroupAdminList(groupData);
  } catch (error) {
    showError('Не удалось загрузить участников');
    closeGroupAdminPanel();
  }
}

async function setGroupRole(memberName, role) {
  if (!isGroupChat || !currentChatId) return;
  if (role !== 'admin' && role !== 'member') return;
  try {
    const snap = await db.ref(`groups/${currentChatId}`).get();
    if (!snap.exists()) { showError('Группа не найдена'); return; }
    const g = snap.val() || {};
    const roles = g.roles || {};
    const myRole = roles[username] || 'member';
    const ownerName = g.createdBy || Object.keys(roles).find(n => roles[n] === 'owner');
    if (myRole !== 'owner') { showError('Только владелец может менять админов'); return; }
    if (memberName === ownerName) { showError('Нельзя менять роль владельца'); return; }
    if (!g.members || g.members[memberName] !== true) { showError('Участник не найден'); return; }
    await db.ref(`groups/${currentChatId}/roles/${memberName}`).set(role);
    showNotification('Группа', role === 'admin' ? 'Пользователь назначен админом' : 'Права админа сняты');
    openGroupAdminPanel();
  } catch (error) {
    showError('Не удалось изменить роль');
  }
}

async function removeGroupMember(memberName) {
  if (!isGroupChat || !currentChatId) return;
  try {
    const snap = await db.ref(`groups/${currentChatId}`).get();
    if (!snap.exists()) { showError('Группа не найдена'); return; }
    const g = snap.val() || {};
    const roles = g.roles || {};
    const myRole = roles[username] || 'member';
    const targetRole = roles[memberName] || 'member';
    const ownerName = g.createdBy || Object.keys(roles).find(n => roles[n] === 'owner');

    if (memberName === username) {
      await leaveCurrentGroup();
      return;
    }
    if (memberName === ownerName || targetRole === 'owner') {
      showError('Нельзя удалить владельца');
      return;
    }
    if (myRole === 'admin' && targetRole !== 'member') {
      showError('Админ может удалять только участников');
      return;
    }
    if (myRole !== 'owner' && myRole !== 'admin') {
      showError('Недостаточно прав');
      return;
    }
    if (!confirm(`Удалить ${memberName} из группы?`)) return;
    const updates = {};
    updates[`groups/${currentChatId}/members/${memberName}`] = null;
    updates[`groups/${currentChatId}/roles/${memberName}`] = null;
    updates[`usersGroups/${memberName}/${currentChatId}`] = null;
    await db.ref().update(updates);
    showNotification('Группа', 'Участник удален');
    openGroupAdminPanel();
  } catch (error) {
    showError('Не удалось удалить участника');
  }
}

function resetCurrentChatAfterLeave() {
  if (chatRef) {
    chatRef.off();
    chatRef = null;
  }
  currentChatId = null;
  currentChatPartner = null;
  isGroupChat = false;
  currentGroupRole = 'member';
  currentGroupName = '';
  const messages = document.getElementById('messages');
  if (messages) messages.innerHTML = '';
  const chatWith = document.getElementById('chatWith');
  if (chatWith) chatWith.textContent = 'Выберите чат';
  const chatMembers = document.getElementById('chatMembers');
  if (chatMembers) chatMembers.textContent = '';
  const mobileStatus = document.getElementById('mobileChatStatus');
  if (mobileStatus) mobileStatus.textContent = 'Выберите чат';
  updateGroupManageMenuVisibility();
  if (typeof updateCallButtonVisibility === 'function') updateCallButtonVisibility();
}

async function leaveCurrentGroup() {
  if (!isGroupChat || !currentChatId) { showError('Откройте группу'); return; }
  try {
    const snap = await db.ref(`groups/${currentChatId}`).get();
    if (!snap.exists()) { resetCurrentChatAfterLeave(); closeGroupAdminPanel(); return; }
    const g = snap.val() || {};
    const members = g.members || {};
    const roles = g.roles || {};
    const ownerName = g.createdBy || Object.keys(roles).find(n => roles[n] === 'owner');
    const memberNames = Object.keys(members).filter(n => members[n] === true);

    if (username === ownerName && memberNames.length > 1) {
      showError('Владелец не может выйти, пока есть другие участники');
      return;
    }

    if (!confirm('Выйти из группы?')) return;

    if (username === ownerName && memberNames.length <= 1) {
      const updates = {};
      updates[`groups/${currentChatId}`] = null;
      updates[`groupChats/${currentChatId}`] = null;
      updates[`usersGroups/${username}/${currentChatId}`] = null;
      await db.ref().update(updates);
      showNotification('Группа', 'Группа удалена');
    } else {
      const updates = {};
      updates[`groups/${currentChatId}/members/${username}`] = null;
      updates[`groups/${currentChatId}/roles/${username}`] = null;
      updates[`usersGroups/${username}/${currentChatId}`] = null;
      await db.ref().update(updates);
      showNotification('Группа', 'Вы вышли из группы');
    }

    closeGroupAdminPanel();
    resetCurrentChatAfterLeave();
  } catch (error) {
    showError('Не удалось выйти из группы');
  }
}

async function clearCurrentChat() {
  if (!chatRef || !currentChatId) return;
  if (!confirm('Очистить весь чат?')) return;
  try {
    await chatRef.remove();
    document.getElementById('messages').innerHTML = '';
    showNotification('Чат', 'История очищена');
  } catch (e) {
    showError('Не удалось очистить чат');
  }
}

window.applyChatBackground = applyChatBackground;
window.openChatBackground = openChatBackground;
window.clearCurrentChat = clearCurrentChat;
window.closeChatBackground = closeChatBackground;
window.selectChatBackground = selectChatBackground;
window.handleChatBgFileChange = handleChatBgFileChange;
window.saveChatBackground = saveChatBackground;
window.openGroupAdminPanel = openGroupAdminPanel;
window.closeGroupAdminPanel = closeGroupAdminPanel;
window.setGroupRole = setGroupRole;
window.removeGroupMember = removeGroupMember;
window.leaveCurrentGroup = leaveCurrentGroup;
window.updateGroupManageMenuVisibility = updateGroupManageMenuVisibility;

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

function createClientMessageId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function canSendNow() {
  const now = Date.now();
  sendRateTimestamps = sendRateTimestamps.filter(ts => (now - ts) < SEND_RATE_WINDOW_MS);
  if (sendRateTimestamps.length >= SEND_RATE_MAX_MESSAGES) return false;
  sendRateTimestamps.push(now);
  return true;
}

function getPendingQueueKey() {
  if (!username) return null;
  return `ruchat_pending_queue_${username}`;
}

function readPendingQueue() {
  const key = getPendingQueueKey();
  if (!key) return [];
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writePendingQueue(items) {
  const key = getPendingQueueKey();
  if (!key) return;
  if (!items || !items.length) {
    localStorage.removeItem(key);
    return;
  }
  localStorage.setItem(key, JSON.stringify(items.slice(-300)));
}

function enqueuePendingMessage(path, msg) {
  if (!path || !msg || !msg.clientMessageId) return;
  const queue = readPendingQueue();
  const exists = queue.some(item => item.path === path && item.msg && item.msg.clientMessageId === msg.clientMessageId);
  if (!exists) queue.push({ path, msg });
  writePendingQueue(queue);
}

async function sendMessagePayload(path, msg) {
  if (!path || !msg || !msg.clientMessageId) return false;
  const targetRef = db.ref(path);
  try {
    await targetRef.child(msg.clientMessageId).set(msg);
    return true;
  } catch {
    return false;
  }
}

async function flushPendingQueue() {
  if (!navigator.onLine || !username) return;
  const queue = readPendingQueue();
  if (!queue.length) return;
  const rest = [];
  for (const item of queue) {
    if (!item || !item.path || !item.msg) continue;
    const ok = await sendMessagePayload(item.path, item.msg);
    if (!ok) rest.push(item);
  }
  writePendingQueue(rest);
}

function markCurrentChatAsRead() {
  if (!chatRef || !username) return;
  chatRef.limitToLast(120).once("value").then(snap => {
    const updates = {};
    snap.forEach(ch => {
      const m = ch.val() || {};
      if (m.from === username) return;
      if (!m.delivered) updates[`${ch.key}/delivered`] = true;
      if (!isGroupChat && !m.read) updates[`${ch.key}/read`] = true;
    });
    if (Object.keys(updates).length) chatRef.update(updates).catch(() => {});
  });
}

window.addEventListener('online', () => {
  flushPendingQueue();
});

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) {
    markCurrentChatAsRead();
    flushPendingQueue();
  }
});

async function sendMessage() {
  const ti = document.getElementById("text");
  const txt = ti.value.trim();
  if (!txt || !currentChatId || !chatRef || !username) { showError("Введите сообщение или выберите чат!"); return; }
  if (!canSendNow()) { showError("Слишком часто. Подождите пару секунд."); return; }
  const btn = document.getElementById("sendBtn");
  const orig = btn.innerHTML;
  btn.innerHTML = "⏳"; btn.style.animation = "rotate 1s linear infinite";
  try {
    if (editingMessageId) {
      await chatRef.child(editingMessageId).update({ 
        text: txt, 
        edited: true, 
        editedAt: Date.now() 
      });
      ti.value = ""; updateSendButton();
      clearEdit();
      btn.innerHTML = orig; btn.style.animation = "";
      return;
    }
    const expiresAt = typeof getEphemeralExpiresAt === 'function' ? getEphemeralExpiresAt() : null;
    const msg = { from: username, text: txt, time: Date.now(), sent: true, delivered: false, read: false, status: 'sent', clientMessageId: createClientMessageId() };
    if (expiresAt) msg.expiresAt = expiresAt;
    if (replyToMessage) {
      msg.replyTo = { id: replyToMessage.id, from: replyToMessage.from, text: replyToMessage.text };
    }
    const sent = navigator.onLine ? await sendMessagePayload(currentChatPath, msg) : false;
    if (!sent) {
      enqueuePendingMessage(currentChatPath, msg);
      showNotification("Сеть", "Сообщение в очереди и отправится при подключении");
    }
    ti.value = ""; updateSendButton();
    clearReply();
    
    // ВОСПРОИЗВОДИМ ЗВУК ОТПРАВКИ
    if (typeof playSendSound === 'function') {
      playSendSound();
    }
    
    btn.innerHTML = orig; btn.style.animation = "";
    if (currentChatPartner && !isGroupChat) sendTypingStatus(false);
    flushPendingQueue();
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

/* ==========================================================
   11. МЕДИАТЕКА ЧАТА
   ========================================================== */
function openMediaLibrary() {
  if (!currentChatId) { showError('Сначала откройте чат'); return; }
  const overlay = document.getElementById('mediaLibraryOverlay');
  if (!overlay) return;
  overlay.classList.add('active');
  setMediaTab(mediaLibraryTab || 'photos');
  if (mediaLibraryChatId !== currentChatId) {
    mediaLibraryChatId = currentChatId;
    loadMediaLibrary();
  } else {
    renderMediaLibrary();
  }
}

function closeMediaLibrary() {
  const overlay = document.getElementById('mediaLibraryOverlay');
  if (overlay) overlay.classList.remove('active');
}

function setMediaTab(tab) {
  mediaLibraryTab = tab;
  document.querySelectorAll('.media-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  renderMediaLibrary();
}

function loadMediaLibrary() {
  const grid = document.getElementById('mediaGrid');
  const empty = document.getElementById('mediaEmpty');
  if (grid) {
    grid.className = 'media-grid';
    grid.innerHTML = `<div class="media-loading">Загрузка...</div>`;
  }
  if (empty) empty.style.display = 'none';
  if (!currentChatId) return;

  const basePath = isGroupChat ? 'groupChats' : 'privateChats';
  db.ref(`${basePath}/${currentChatId}`).limitToLast(500).once('value')
    .then(snap => {
      const media = { photos: [], videos: [], files: [] };
      snap.forEach(child => {
        const m = child.val() || {};
        const time = m.time || 0;
        const photoUrl = (typeof isValidMediaUrl === 'function' && isValidMediaUrl(m.photo)) ? m.photo : null;
        const videoUrl = (typeof isValidMediaUrl === 'function' && isValidMediaUrl(m.video)) ? m.video : null;
        const audioUrl = (typeof isValidMediaUrl === 'function' && isValidMediaUrl(m.audio)) ? m.audio : null;
        const docUrl = (typeof isValidMediaUrl === 'function' && isValidMediaUrl(m.document)) ? m.document : null;

        if (photoUrl) media.photos.push({ url: photoUrl, time });
        if (videoUrl) media.videos.push({ url: videoUrl, time, isVideoMessage: m.type === 'video_message' });
        if (audioUrl) media.files.push({ url: audioUrl, time, kind: 'audio', filename: m.filename || 'Аудио', size: m.filesize || 0 });
        if (docUrl) media.files.push({ url: docUrl, time, kind: 'file', filename: m.filename || 'Файл', size: m.filesize || 0 });
      });
      const sortDesc = (a, b) => (b.time || 0) - (a.time || 0);
      media.photos.sort(sortDesc);
      media.videos.sort(sortDesc);
      media.files.sort(sortDesc);
      mediaLibraryCache = media;
      renderMediaLibrary();
    })
    .catch(() => {
      if (grid) grid.innerHTML = `<div class="media-empty">Ошибка загрузки</div>`;
    });
}

function renderMediaLibrary() {
  const grid = document.getElementById('mediaGrid');
  const empty = document.getElementById('mediaEmpty');
  if (!grid) return;
  const items = mediaLibraryCache[mediaLibraryTab] || [];
  grid.className = mediaLibraryTab === 'files' ? 'media-list' : 'media-grid';
  grid.innerHTML = '';
  if (!items.length) {
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  if (mediaLibraryTab === 'files') {
    items.forEach(item => {
      const fs = typeof formatFileSize === 'function' ? formatFileSize(item.size || 0) : '';
      const name = escapeHtml(normalizeText(item.filename || 'Файл'));
      const meta = [item.kind === 'audio' ? 'Аудио' : 'Файл', fs].filter(Boolean).join(' • ');
      const a = document.createElement('a');
      a.className = 'media-file';
      a.href = item.url;
      a.target = '_blank';
      a.download = item.filename || '';
      a.innerHTML = `
        <div class="file-icon">${item.kind === 'audio' ? '🎵' : '📄'}</div>
        <div>
          <div class="file-name">${name}</div>
          <div class="file-meta">${meta}</div>
        </div>`;
      grid.appendChild(a);
    });
    return;
  }

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'media-item';
    if (mediaLibraryTab === 'photos') {
      div.innerHTML = `<img src="${item.url}" alt="Фото">`;
    } else {
      div.innerHTML = `<video src="${item.url}" muted preload="metadata"></video><div class="media-play">▶</div>`;
    }
    div.onclick = () => openMedia(item.url);
    grid.appendChild(div);
  });
}

window.sendMessagePayload = sendMessagePayload;
window.enqueuePendingMessage = enqueuePendingMessage;
window.flushPendingQueue = flushPendingQueue;
window.createClientMessageId = createClientMessageId;

















