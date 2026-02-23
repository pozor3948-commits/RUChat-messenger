/* ==========================================================
   RUCHAT - ДОПОЛНИТЕЛЬНЫЕ ФУНКЦИИ (CONFEТКА)
   ========================================================== */

// Глобальные переменные (если ещё не объявлены)
if (typeof window.editingMessageId === 'undefined') {
    window.editingMessageId = null;
}
if (typeof window.editingOriginalText === 'undefined') {
    window.editingOriginalText = '';
}

/* ==========================================================
   1. УДАЛЕНИЕ СООБЩЕНИЙ
   ========================================================== */

// Удаление сообщения (для себя)
async function deleteMessageForSelf(messageId) {
    if (!currentChatPath || !messageId) return;
    
    try {
        const messageRef = db.ref(currentChatPath + '/' + messageId);
        await messageRef.update({
            deletedFor: firebase.database.ServerValue.increment(1),
            deletedForUsers: firebase.database.ServerValue.increment(1)
        });
        
        // Удаляем из DOM
        const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageEl) {
            messageEl.style.opacity = '0';
            messageEl.style.transform = 'translateX(-20px)';
            setTimeout(() => messageEl.remove(), 300);
        }
        
        showNotification('Сообщение удалено', 'info');
    } catch (e) {
        console.error('Ошибка удаления сообщения:', e);
        showError('Не удалось удалить сообщение');
    }
}

// Удаление для всех (в течение 24 часов)
async function deleteMessageForAll(messageId) {
    if (!currentChatPath || !messageId) return;
    
    try {
        // Проверяем время сообщения
        const messageRef = db.ref(currentChatPath + '/' + messageId);
        const snapshot = await messageRef.once('value');
        const message = snapshot.val();
        
        if (!message) {
            showError('Сообщение не найдено');
            return;
        }
        
        const hoursPassed = (Date.now() - message.time) / (1000 * 60 * 60);
        if (hoursPassed > 24) {
            showError('Можно удалить только сообщения за последние 24 часа');
            return;
        }
        
        await messageRef.update({
            deletedForAll: true,
            text: '🗑️ Это сообщение было удалено',
            edited: true
        });
        
        showNotification('Сообщение удалено для всех', 'success');
    } catch (e) {
        console.error('Ошибка удаления для всех:', e);
        showError('Не удалось удалить сообщение');
    }
}

// Контекстное меню для удаления
function showMessageActions(messageId, event) {
    event.preventDefault();
    event.stopPropagation();
    
    // Закрываем предыдущее меню
    closeAllMenus();
    
    // Создаём меню
    const menu = document.createElement('div');
    menu.className = 'message-actions-menu';
    menu.innerHTML = `
        <div class="message-action-item" onclick="editMessage('${messageId}')">
            <span class="icon">✏️</span>
            <span>Редактировать</span>
        </div>
        <div class="message-action-item" onclick="forwardMessage('${messageId}')">
            <span class="icon">↗️</span>
            <span>Переслать</span>
        </div>
        <div class="message-action-item" onclick="addToFavorites('${messageId}')">
            <span class="icon">⭐</span>
            <span>В избранное</span>
        </div>
        <div class="message-action-item" onclick="deleteMessageForSelf('${messageId}')">
            <span class="icon">🗑️</span>
            <span>Удалить (для себя)</span>
        </div>
        <div class="message-action-item danger" onclick="deleteMessageForAll('${messageId}')">
            <span class="icon">❌</span>
            <span>Удалить для всех</span>
        </div>
    `;
    
    // Позиционируем меню
    menu.style.position = 'fixed';
    menu.style.left = Math.min(event.clientX, window.innerWidth - 200) + 'px';
    menu.style.top = Math.min(event.clientY, window.innerHeight - 250) + 'px';
    menu.style.zIndex = '10000';
    
    document.body.appendChild(menu);
    
    // Закрываем по клику вне
    setTimeout(() => {
        document.addEventListener('click', function closeMenu(e) {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        });
    }, 100);
}

/* ==========================================================
   2. РЕДАКТИРОВАНИЕ СООБЩЕНИЙ
   ========================================================== */

// Используем глобальные переменные
// editingMessageId и editingOriginalText объявлены выше

function editMessage(messageId) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;
    
    const messageText = messageEl.querySelector('.message-text');
    if (!messageText) return;
    
    editingMessageId = messageId;
    editingOriginalText = messageText.textContent;
    
    // Заменяем текст на input
    const input = document.createElement('textarea');
    input.className = 'edit-message-input';
    input.value = editingOriginalText;
    input.rows = 3;
    
    messageText.innerHTML = '';
    messageText.appendChild(input);
    
    // Добавляем кнопки сохранения
    const actions = document.createElement('div');
    actions.className = 'edit-message-actions';
    actions.innerHTML = `
        <button class="btn-save-edit" onclick="saveEditMessage('${messageId}')">✓</button>
        <button class="btn-cancel-edit" onclick="cancelEditMessage()">✕</button>
    `;
    messageText.appendChild(actions);
    
    input.focus();
    
    // Сохранение по Ctrl+Enter
    input.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'Enter') {
            saveEditMessage(messageId);
        }
        if (e.key === 'Escape') {
            cancelEditMessage();
        }
    });
}

function saveEditMessage(messageId) {
    const input = document.querySelector('.edit-message-input');
    if (!input) return;
    
    const newText = input.value.trim();
    if (!newText || newText === editingOriginalText) {
        cancelEditMessage();
        return;
    }
    
    db.ref(currentChatPath + '/' + messageId).update({
        text: newText,
        edited: true,
        editTime: Date.now()
    }).then(() => {
        showNotification('Сообщение отредактировано', 'success');
        editingMessageId = null;
        editingOriginalText = '';
    }).catch(e => {
        console.error('Ошибка редактирования:', e);
        showError('Не удалось отредактировать сообщение');
    });
}

function cancelEditMessage() {
    if (!editingMessageId) return;
    
    // Перерисовываем сообщение
    renderMessagesBatched([], {}, 1);
    editingMessageId = null;
    editingOriginalText = '';
}

/* ==========================================================
   3. ПЕРЕСЫЛКА СООБЩЕНИЙ
   ========================================================== */

function forwardMessage(messageId) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;
    
    const messageText = messageEl.querySelector('.message-text')?.textContent;
    if (!messageText) return;
    
    // Сохраняем для пересылки
    window.pendingForwardMessage = {
        id: messageId,
        text: messageText,
        time: Date.now()
    };
    
    // Показываем список чатов для выбора
    showForwardDialog();
}

function showForwardDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'forward-dialog-overlay';
    dialog.innerHTML = `
        <div class="forward-dialog">
            <div class="forward-header">
                <h3>Переслать сообщение</h3>
                <button class="close-forward" onclick="this.closest('.forward-dialog-overlay').remove()">✕</button>
            </div>
            <div class="forward-chats-list" id="forwardChatsList">
                <!-- Список чатов -->
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
    
    // Загружаем список чатов
    loadForwardChatsList();
}

function loadForwardChatsList() {
    const list = document.getElementById('forwardChatsList');
    if (!list) return;
    
    // Получаем список контактов
    db.ref('users/' + username + '/friends').once('value', snapshot => {
        const friends = snapshot.val() || {};
        
        list.innerHTML = Object.keys(friends).map(friendId => `
            <div class="forward-chat-item" onclick="executeForward('${friendId}')">
                <div class="forward-chat-avatar">${friendId[0].toUpperCase()}</div>
                <div class="forward-chat-name">${friendId}</div>
            </div>
        `).join('');
    });
}

function executeForward(targetFriendId) {
    if (!window.pendingForwardMessage) return;
    
    const forwardPath = 'chats/' + [username, targetFriendId].sort().join('_') + '/messages';
    const newMessageRef = db.ref(forwardPath).push();
    
    newMessageRef.set({
        from: username,
        text: window.pendingForwardMessage.text + '\n\n━━━━━━━━━\n↗️ Переслано',
        time: Date.now(),
        forwarded: true,
        originalId: window.pendingForwardMessage.id
    }).then(() => {
        showNotification('Сообщение переслано', 'success');
        document.querySelector('.forward-dialog-overlay')?.remove();
        window.pendingForwardMessage = null;
    }).catch(e => {
        console.error('Ошибка пересылки:', e);
        showError('Не удалось переслать сообщение');
    });
}

/* ==========================================================
   4. ИЗБРАННОЕ / ЗАКЛАДКИ
   ========================================================== */

function addToFavorites(messageId) {
    const messageEl = document.querySelector(`[data-message-id="${messageId}"]`);
    if (!messageEl) return;
    
    const messageText = messageEl.querySelector('.message-text')?.textContent;
    const messageTime = messageEl.querySelector('.message-time')?.textContent;
    
    if (!messageText) return;
    
    const favorite = {
        id: messageId,
        chatId: currentChatId,
        text: messageText,
        time: Date.now(),
        originalTime: messageTime
    };
    
    db.ref('users/' + username + '/favorites/' + messageId).set(favorite)
        .then(() => {
            showNotification('Добавлено в избранное ⭐', 'success');
        })
        .catch(e => {
            console.error('Ошибка добавления в избранное:', e);
            showError('Не удалось добавить в избранное');
        });
}

function openFavoritesPanel() {
    const panel = document.createElement('div');
    panel.className = 'favorites-panel-overlay';
    panel.innerHTML = `
        <div class="favorites-panel">
            <div class="favorites-header">
                <h3>⭐ Избранное</h3>
                <button class="close-favorites" onclick="this.closest('.favorites-panel-overlay').remove()">✕</button>
            </div>
            <div class="favorites-list" id="favoritesList">
                <div class="loading-favorites">Загрузка...</div>
            </div>
        </div>
    `;
    
    document.body.appendChild(panel);
    loadFavoritesList();
}

function loadFavoritesList() {
    const list = document.getElementById('favoritesList');
    if (!list) return;
    
    db.ref('users/' + username + '/favorites').once('value', snapshot => {
        const favorites = snapshot.val();
        
        if (!favorites || Object.keys(favorites).length === 0) {
            list.innerHTML = '<div class="empty-favorites">В избранном пока пусто ⭐</div>';
            return;
        }
        
        list.innerHTML = Object.values(favorites).map(fav => `
            <div class="favorite-item">
                <div class="favorite-text">${fav.text}</div>
                <div class="favorite-meta">
                    <span class="favorite-chat">${fav.chatId}</span>
                    <span class="favorite-time">${fav.originalTime || new Date(fav.time).toLocaleTimeString()}</span>
                    <button class="remove-favorite" onclick="removeFromFavorites('${fav.id}')">✕</button>
                </div>
            </div>
        `).join('');
    });
}

function removeFromFavorites(messageId) {
    db.ref('users/' + username + '/favorites/' + messageId).remove()
        .then(() => {
            showNotification('Удалено из избранного', 'info');
            loadFavoritesList();
        })
        .catch(e => {
            console.error('Ошибка удаления:', e);
        });
}

/* ==========================================================
   5. PUSH-УВЕДОМЛЕНИЯ (PWA)
   ========================================================== */

let pushNotificationPermission = false;

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        console.log('Браузер не поддерживает уведомления');
        return false;
    }
    
    if (Notification.permission === 'granted') {
        pushNotificationPermission = true;
        return true;
    }
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        pushNotificationPermission = permission === 'granted';
        return pushNotificationPermission;
    }
    
    return false;
}

function sendPushNotification(title, body, icon = '💬') {
    if (!pushNotificationPermission) return;
    
    if (document.visibilityState === 'visible') return;
    
    const notification = new Notification(title, {
        body: body,
        icon: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>' + icon + '</text></svg>',
        badge: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>💬</text></svg>',
        vibrate: [200, 100, 200],
        tag: 'ruchat-message-' + Date.now()
    });
    
    notification.onclick = () => {
        window.focus();
        notification.close();
    };
}

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // navigator.serviceWorker.register('/sw.js').then(registration => {
        //     console.log('Service Worker зарегистрирован:', registration.scope);
        // }).catch(error => {
        //     console.log('Service Worker ошибка:', error);
        // });
    });
}

/* ==========================================================
   6. НАСТРОЙКИ ПРИВАТНОСТИ
   ========================================================== */

const privacySettings = {
    showOnline: true,
    showLastSeen: true,
    allowAddToGroups: true,
    blockUnknown: false
};

// Загрузка настроек приватности
function loadPrivacySettings() {
    db.ref('users/' + username + '/privacy').once('value', snapshot => {
        const settings = snapshot.val();
        if (settings) {
            Object.assign(privacySettings, settings);
        }
        updatePrivacyStatus();
    });
}

// Обновление статуса приватности
function updatePrivacyStatus() {
    // Обновляем статус в базе
    db.ref('users/' + username + '/privacy').set(privacySettings);
    
    // Если скрыт онлайн - не обновляем статус
    if (!privacySettings.showOnline) {
        updateUserStatus('hidden');
    }
}

// Показ настроек приватности
function showPrivacySettings() {
    const dialog = document.createElement('div');
    dialog.className = 'privacy-settings-overlay';
    dialog.innerHTML = `
        <div class="privacy-settings">
            <div class="privacy-header">
                <h3>🔒 Приватность</h3>
                <button class="close-privacy" onclick="this.closest('.privacy-settings-overlay').remove()">✕</button>
            </div>
            <div class="privacy-options">
                <div class="privacy-option">
                    <div class="privacy-label">
                        <span class="privacy-icon">👁️</span>
                        <div>
                            <div class="privacy-title">Показывать статус "В сети"</div>
                            <div class="privacy-desc">Другие пользователи будут видеть, когда вы онлайн</div>
                        </div>
                    </div>
                    <label class="privacy-toggle">
                        <input type="checkbox" ${privacySettings.showOnline ? 'checked' : ''} onchange="togglePrivacySetting('showOnline', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                
                <div class="privacy-option">
                    <div class="privacy-label">
                        <span class="privacy-icon">⏰</span>
                        <div>
                            <div class="privacy-title">Показывать время посещения</div>
                            <div class="privacy-desc">Другие пользователи будут видеть, когда вы были в сети</div>
                        </div>
                    </div>
                    <label class="privacy-toggle">
                        <input type="checkbox" ${privacySettings.showLastSeen ? 'checked' : ''} onchange="togglePrivacySetting('showLastSeen', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                
                <div class="privacy-option">
                    <div class="privacy-label">
                        <span class="privacy-icon">👥</span>
                        <div>
                            <div class="privacy-title">Разрешить добавлять в группы</div>
                            <div class="privacy-desc">Любые пользователи смогут добавлять вас в группы</div>
                        </div>
                    </div>
                    <label class="privacy-toggle">
                        <input type="checkbox" ${privacySettings.allowAddToGroups ? 'checked' : ''} onchange="togglePrivacySetting('allowAddToGroups', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
                
                <div class="privacy-option">
                    <div class="privacy-label">
                        <span class="privacy-icon">🚫</span>
                        <div>
                            <div class="privacy-title">Блокировать неизвестных</div>
                            <div class="privacy-desc">Только контакты смогут писать вам</div>
                        </div>
                    </div>
                    <label class="privacy-toggle">
                        <input type="checkbox" ${privacySettings.blockUnknown ? 'checked' : ''} onchange="togglePrivacySetting('blockUnknown', this.checked)">
                        <span class="toggle-slider"></span>
                    </label>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
}

function togglePrivacySetting(setting, value) {
    privacySettings[setting] = value;
    updatePrivacyStatus();
    showNotification('Настройки приватности сохранены', 'success');
}

/* ==========================================================
   7. РЕАКЦИИ НА СООБЩЕНИЯ
   ========================================================== */

const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥'];

function showReactionPicker(messageId, event) {
    event.preventDefault();
    event.stopPropagation();
    
    closeAllMenus();
    
    const picker = document.createElement('div');
    picker.className = 'reaction-picker';
    picker.innerHTML = reactionEmojis.map(emoji => 
        `<span class="reaction-emoji" onclick="addReaction('${messageId}', '${emoji}')">${emoji}</span>`
    ).join('');
    
    picker.style.position = 'fixed';
    picker.style.left = event.clientX + 'px';
    picker.style.top = (event.clientY - 50) + 'px';
    picker.style.zIndex = '10000';
    
    document.body.appendChild(picker);
    
    setTimeout(() => {
        document.addEventListener('click', function closePicker(e) {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', closePicker);
            }
        });
    }, 100);
}

function addReaction(messageId, emoji) {
    db.ref(currentChatPath + '/' + messageId + '/reactions/' + username).set({
        emoji: emoji,
        time: Date.now()
    }).then(() => {
        showNotification('Реакция добавлена', 'success');
    }).catch(e => {
        console.error('Ошибка добавления реакции:', e);
    });
}

function renderReactions(messageEl, reactions) {
    if (!reactions || Object.keys(reactions).length === 0) return;
    
    const reactionsContainer = document.createElement('div');
    reactionsContainer.className = 'message-reactions';
    
    // Группируем реакции
    const grouped = {};
    Object.values(reactions).forEach(r => {
        if (!grouped[r.emoji]) grouped[r.emoji] = [];
        grouped[r.emoji].push(r);
    });
    
    reactionsContainer.innerHTML = Object.entries(grouped).map(([emoji, users]) => 
        `<span class="reaction-item" title="${users.map(u => u.username).join(', ')}">${emoji} ${users.length}</span>`
    ).join('');
    
    messageEl.querySelector('.message-content')?.appendChild(reactionsContainer);
}

/* ==========================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ========================================================== */

function closeAllMenus() {
    document.querySelectorAll('.message-actions-menu, .reaction-picker, .forward-dialog-overlay, .privacy-settings-overlay, .favorites-panel-overlay').forEach(el => el.remove());
}

// Добавляем стили для новых функций
const additionalStyles = document.createElement('style');
additionalStyles.textContent = `
    /* Контекстное меню */
    .message-actions-menu {
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        padding: 8px;
        min-width: 200px;
        animation: slideUp 0.2s ease;
    }
    
    .message-action-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px 16px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
        color: #1e293b;
    }
    
    .message-action-item:hover {
        background: #f1f5f9;
    }
    
    .message-action-item.danger {
        color: #ef4444;
    }
    
    .message-action-item .icon {
        font-size: 18px;
    }
    
    /* Редактирование */
    .edit-message-input {
        width: 100%;
        padding: 12px;
        border: 2px solid #0088cc;
        border-radius: 8px;
        font-family: inherit;
        font-size: 14px;
        resize: vertical;
        min-height: 80px;
    }
    
    .edit-message-actions {
        display: flex;
        gap: 8px;
        margin-top: 8px;
        justify-content: flex-end;
    }
    
    .btn-save-edit, .btn-cancel-edit {
        width: 36px;
        height: 36px;
        border-radius: 8px;
        border: none;
        cursor: pointer;
        font-size: 18px;
        transition: all 0.2s;
    }
    
    .btn-save-edit {
        background: #10b981;
        color: white;
    }
    
    .btn-cancel-edit {
        background: #ef4444;
        color: white;
    }
    
    /* Пересылка */
    .forward-dialog-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    }
    
    .forward-dialog {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 400px;
        max-height: 80vh;
        overflow: hidden;
        animation: slideUp 0.3s ease;
    }
    
    .forward-header {
        padding: 20px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .forward-header h3 {
        margin: 0;
        color: #1e293b;
    }
    
    .close-forward {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #64748b;
    }
    
    .forward-chats-list {
        padding: 10px;
        overflow-y: auto;
        max-height: 400px;
    }
    
    .forward-chat-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 12px;
        border-radius: 8px;
        cursor: pointer;
        transition: background 0.2s;
    }
    
    .forward-chat-item:hover {
        background: #f1f5f9;
    }
    
    .forward-chat-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0088cc, #0ea5e9);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 600;
    }
    
    .forward-chat-name {
        font-weight: 600;
        color: #1e293b;
    }
    
    /* Избранное */
    .favorites-panel-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        justify-content: flex-end;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    }
    
    .favorites-panel {
        background: white;
        width: 400px;
        max-width: 90%;
        height: 100vh;
        animation: slideLeft 0.3s ease;
        display: flex;
        flex-direction: column;
    }
    
    .favorites-header {
        padding: 20px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .favorites-header h3 {
        margin: 0;
        color: #1e293b;
    }
    
    .close-favorites {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #64748b;
    }
    
    .favorites-list {
        flex: 1;
        overflow-y: auto;
        padding: 15px;
    }
    
    .favorite-item {
        background: #f8fafc;
        border-radius: 12px;
        padding: 15px;
        margin-bottom: 12px;
    }
    
    .favorite-text {
        color: #1e293b;
        margin-bottom: 10px;
        line-height: 1.5;
    }
    
    .favorite-meta {
        display: flex;
        align-items: center;
        gap: 10px;
        font-size: 13px;
        color: #64748b;
    }
    
    .remove-favorite {
        margin-left: auto;
        background: none;
        border: none;
        cursor: pointer;
        color: #ef4444;
        font-size: 16px;
    }
    
    .empty-favorites {
        text-align: center;
        padding: 40px 20px;
        color: #64748b;
    }
    
    /* Приватность */
    .privacy-settings-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10000;
        animation: fadeIn 0.2s ease;
    }
    
    .privacy-settings {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 500px;
        max-height: 80vh;
        overflow: hidden;
        animation: slideUp 0.3s ease;
    }
    
    .privacy-header {
        padding: 20px;
        border-bottom: 1px solid #e2e8f0;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .privacy-header h3 {
        margin: 0;
        color: #1e293b;
    }
    
    .close-privacy {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #64748b;
    }
    
    .privacy-options {
        padding: 10px;
        max-height: 60vh;
        overflow-y: auto;
    }
    
    .privacy-option {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px;
        border-bottom: 1px solid #f1f5f9;
    }
    
    .privacy-label {
        display: flex;
        gap: 12px;
        flex: 1;
    }
    
    .privacy-icon {
        font-size: 24px;
    }
    
    .privacy-title {
        font-weight: 600;
        color: #1e293b;
        margin-bottom: 4px;
    }
    
    .privacy-desc {
        font-size: 13px;
        color: #64748b;
    }
    
    .privacy-toggle {
        position: relative;
        width: 52px;
        height: 28px;
    }
    
    .privacy-toggle input {
        opacity: 0;
        width: 0;
        height: 0;
    }
    
    .toggle-slider {
        position: absolute;
        cursor: pointer;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: #cbd5e1;
        transition: 0.3s;
        border-radius: 28px;
    }
    
    .toggle-slider:before {
        position: absolute;
        content: "";
        height: 22px;
        width: 22px;
        left: 3px;
        bottom: 3px;
        background-color: white;
        transition: 0.3s;
        border-radius: 50%;
    }
    
    .privacy-toggle input:checked + .toggle-slider {
        background-color: #0088cc;
    }
    
    .privacy-toggle input:checked + .toggle-slider:before {
        transform: translateX(24px);
    }
    
    /* Реакции */
    .reaction-picker {
        background: white;
        border-radius: 25px;
        padding: 8px 12px;
        display: flex;
        gap: 8px;
        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
        animation: scaleIn 0.2s ease;
    }
    
    .reaction-emoji {
        font-size: 24px;
        cursor: pointer;
        transition: transform 0.2s;
    }
    
    .reaction-emoji:hover {
        transform: scale(1.3);
    }
    
    .message-reactions {
        display: flex;
        gap: 6px;
        margin-top: 8px;
        flex-wrap: wrap;
    }
    
    .reaction-item {
        background: rgba(0, 136, 204, 0.1);
        padding: 4px 8px;
        border-radius: 12px;
        font-size: 12px;
    }
    
    @keyframes scaleIn {
        from { transform: scale(0.8); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }
    
    @keyframes slideLeft {
        from { transform: translateX(100%); }
        to { transform: translateX(0); }
    }
`;
document.head.appendChild(additionalStyles);

// Экспортируем функции глобально
window.deleteMessageForSelf = deleteMessageForSelf;
window.deleteMessageForAll = deleteMessageForAll;
window.showMessageActions = showMessageActions;
window.editMessage = editMessage;
window.saveEditMessage = saveEditMessage;
window.cancelEditMessage = cancelEditMessage;
window.forwardMessage = forwardMessage;
window.executeForward = executeForward;
window.addToFavorites = addToFavorites;
window.openFavoritesPanel = openFavoritesPanel;
window.removeFromFavorites = removeFromFavorites;
window.requestNotificationPermission = requestNotificationPermission;
window.sendPushNotification = sendPushNotification;
window.showPrivacySettings = showPrivacySettings;
window.togglePrivacySetting = togglePrivacySetting;
window.showReactionPicker = showReactionPicker;
window.addReaction = addReaction;
window.loadPrivacySettings = loadPrivacySettings;

console.log('✅ Дополнительные функции RuChat загружены');
