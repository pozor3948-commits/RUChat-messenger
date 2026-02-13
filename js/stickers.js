/* ==========================================================
   СТИКЕРЫ / STICKER BOT
   ========================================================== */
let stickersCache = {};
let pendingStickerData = null;

function loadStickers() {
  if (!username || !db) return;
  db.ref(`accounts/${username}/stickers`).on('value', snap => {
    stickersCache = snap.exists() ? (snap.val() || {}) : {};
    renderStickerPanel();
  });
}

function renderStickerPanel() {
  const grid = document.getElementById('stickerGrid');
  if (!grid) return;
  grid.innerHTML = '';
  const keys = Object.keys(stickersCache || {});
  if (!keys.length) {
    grid.innerHTML = `
      <div class="sticker-empty">
        <div class="icon">🧩</div>
        <div class="title">Стикеров нет</div>
        <div class="desc">Добавьте свои стикеры через Sticker Bot</div>
      </div>`;
    return;
  }
  keys.forEach(id => {
    const st = stickersCache[id] || {};
    if (!st.url) return;
    const item = document.createElement('button');
    item.className = 'sticker-item';
    item.title = 'Отправить стикер';
    item.onclick = () => sendSticker(id);
    item.innerHTML = `
      <img src="${st.url}" alt="sticker">
      ${st.emoji ? `<span class="sticker-tag">${escapeHtml(st.emoji)}</span>` : ''}`;
    grid.appendChild(item);
  });
}

function toggleStickerPanel() {
  const panel = document.getElementById('stickerPanel');
  if (!panel) return;
  const isActive = panel.classList.contains('active');
  const attachmentMenu = document.getElementById('attachmentMenu');
  const recordTypeMenu = document.getElementById('recordTypeMenu');
  const emojiPicker = document.getElementById('emojiPicker');
  if (attachmentMenu) attachmentMenu.classList.remove('active');
  if (recordTypeMenu) recordTypeMenu.classList.remove('active');
  if (emojiPicker) emojiPicker.classList.remove('active');
  if (isActive) panel.classList.remove('active');
  else {
    panel.classList.add('active');
    if (isMobile) positionStickerPanelForMobile();
  }
}

function positionStickerPanelForMobile() {
  const panel = document.getElementById('stickerPanel');
  const inputContainer = document.querySelector('.message-input-container');
  if (!panel || !inputContainer) return;
  const inputRect = inputContainer.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  panel.style.bottom = `${viewportHeight - inputRect.top + 10}px`;
  panel.style.left = '10px';
  panel.style.right = '10px';
  panel.style.width = 'calc(100% - 20px)';
}

function openStickerBot() {
  const overlay = document.getElementById('stickerBotOverlay');
  if (!overlay) return;
  overlay.classList.add('active');
  const fileInput = document.getElementById('stickerFileInput');
  const emojiInput = document.getElementById('stickerEmojiInput');
  const preview = document.getElementById('stickerPreview');
  if (fileInput) fileInput.value = '';
  if (emojiInput) emojiInput.value = '';
  if (preview) preview.src = '';
  pendingStickerData = null;
}

function closeStickerBot() {
  const overlay = document.getElementById('stickerBotOverlay');
  if (overlay) overlay.classList.remove('active');
  pendingStickerData = null;
}

function handleStickerFileChange(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) {
    showError('Нужна картинка');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    pendingStickerData = reader.result;
    const preview = document.getElementById('stickerPreview');
    if (preview) preview.src = pendingStickerData;
  };
  reader.readAsDataURL(file);
}

async function saveSticker() {
  if (!pendingStickerData) { showError('Загрузите картинку'); return; }
  if (!username || !db) { showError('Не удалось сохранить'); return; }
  const emojiInput = document.getElementById('stickerEmojiInput');
  const emoji = emojiInput ? emojiInput.value.trim() : '';
  try {
    await db.ref(`accounts/${username}/stickers`).push({
      url: pendingStickerData,
      emoji,
      createdAt: Date.now()
    });
    showNotification('Стикеры', 'Стикер добавлен', 'success');
    closeStickerBot();
  } catch (e) {
    console.error(e);
    showError('Не удалось сохранить стикер');
  }
}

async function sendSticker(stickerId) {
  if (!currentChatId || !chatRef || !username) { showError('Выберите чат'); return; }
  const st = stickersCache[stickerId];
  if (!st || !st.url) return;
  const msg = {
    from: username,
    time: Date.now(),
    sent: true,
    delivered: false,
    read: false,
    status: 'sent',
    clientMessageId: (typeof createClientMessageId === 'function') ? createClientMessageId() : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
    sticker: st.url,
    stickerEmoji: st.emoji || ''
  };
  const expiresAt = typeof getEphemeralExpiresAt === 'function' ? getEphemeralExpiresAt() : null;
  if (expiresAt) msg.expiresAt = expiresAt;
  const reply = typeof getReplyToMessage === 'function' ? getReplyToMessage() : null;
  if (reply) msg.replyTo = { id: reply.id, from: reply.from, text: reply.text };
  const path = isGroupChat ? `groupChats/${currentChatId}` : `privateChats/${currentChatId}`;
  const sent = (typeof sendMessagePayload === 'function')
    ? await sendMessagePayload(path, msg)
    : await chatRef.push(msg).then(() => true).catch(() => false);
  if (!sent && typeof enqueuePendingMessage === 'function') {
    enqueuePendingMessage(path, msg);
    showNotification('Сеть', 'Стикер в очереди отправки');
  }
  if (reply && typeof clearReply === 'function') clearReply();
}

// Экспорты в глобальную область
window.loadStickers = loadStickers;
window.toggleStickerPanel = toggleStickerPanel;
window.openStickerBot = openStickerBot;
window.closeStickerBot = closeStickerBot;
window.handleStickerFileChange = handleStickerFileChange;
window.saveSticker = saveSticker;
