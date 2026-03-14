/* ==========================================================
   RUCHAT EXTENDED FEATURES
   Расширенные функции мессенджера
   Версия: 2026-03-12
   ========================================================== */

/* ==========================================================
   1. ЗАКРЕПЛЕНИЕ ЧАТОВ В СПИСКЕ
   ========================================================== */
let pinnedChats = [];

function loadPinnedChats() {
    try {
        const saved = localStorage.getItem('ruchat_pinned_chats');
        pinnedChats = saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error('Ошибка загрузки закрепленных чатов:', e);
        pinnedChats = [];
    }
}

function savePinnedChats() {
    try {
        localStorage.setItem('ruchat_pinned_chats', JSON.stringify(pinnedChats));
    } catch (e) {
        console.error('Ошибка сохранения закрепленных чатов:', e);
    }
}

function isChatPinned(chatId, isGroup) {
    const key = `${isGroup ? 'g:' : 'p:'}${chatId}`;
    return pinnedChats.includes(key);
}

function togglePinChat(chatId, isGroup) {
    const key = `${isGroup ? 'g:' : 'p:'}${chatId}`;
    const index = pinnedChats.indexOf(key);
    
    if (index >= 0) {
        // Открепить
        pinnedChats.splice(index, 1);
        showNotification('Чат', 'Чат откреплен', 'info');
    } else {
        // Закрепить (максимум 5)
        if (pinnedChats.length >= 5) {
            showError('Можно закрепить не более 5 чатов');
            return false;
        }
        pinnedChats.push(key);
        showNotification('Чат', 'Чат закреплен', 'success');
    }
    
    savePinnedChats();
    renderFriends();
    return true;
}

function getPinnedChatIds() {
    return pinnedChats.map(key => ({
        id: key.substring(2),
        isGroup: key.startsWith('g:')
    }));
}

/* ==========================================================
   2. ИЗБРАННЫЕ СООБЩЕНИЯ (ЗАКЛАДКИ)
   ========================================================== */
let savedMessages = {};

function loadSavedMessages() {
    try {
        const saved = localStorage.getItem('ruchat_saved_messages');
        savedMessages = saved ? JSON.parse(saved) : {};
    } catch (e) {
        console.error('Ошибка загрузки избранных сообщений:', e);
        savedMessages = {};
    }
}

function saveSavedMessages() {
    try {
        localStorage.setItem('ruchat_saved_messages', JSON.stringify(savedMessages));
    } catch (e) {
        console.error('Ошибка сохранения избранных сообщений:', e);
    }
}

function toggleSaveMessage(messageId, chatId, messageData) {
    const key = `${chatId}:${messageId}`;
    
    if (savedMessages[key]) {
        // Удалить из избранных
        delete savedMessages[key];
        showNotification('Избранное', 'Сообщение удалено из избранных', 'info');
    } else {
        // Добавить в избранные
        savedMessages[key] = {
            id: messageId,
            chatId: chatId,
            from: messageData.from,
            text: messageData.text || '',
            time: messageData.time,
            type: messageData.type || 'text',
            photo: messageData.photo || '',
            video: messageData.video || '',
            audio: messageData.audio || '',
            document: messageData.document || ''
        };
        showNotification('Избранное', 'Сообщение сохранено', 'success');
    }
    
    saveSavedMessages();
    return true;
}

function getSavedMessagesList() {
    return Object.values(savedMessages).sort((a, b) => b.time - a.time);
}

function clearSavedMessages() {
    if (confirm('Вы уверены, что хотите очистить все избранные сообщения?')) {
        savedMessages = {};
        saveSavedMessages();
        showNotification('Избранное', 'Все избранные сообщения удалены', 'info');
        return true;
    }
    return false;
}

/* ==========================================================
   3. РЕДАКТИРОВАНИЕ СООБЩЕНИЙ (до 10 минут)
   ========================================================== */
const EDIT_TIME_LIMIT_MS = 10 * 60 * 1000; // 10 минут

function canEditMessage(messageData) {
    if (!messageData) return false;
    if (messageData.from !== username) return false;
    
    const now = Date.now();
    const messageTime = messageData.time || 0;
    return (now - messageTime) <= EDIT_TIME_LIMIT_MS;
}

function getEditTimeRemaining(messageData) {
    if (!messageData) return 0;
    const now = Date.now();
    const messageTime = messageData.time || 0;
    const remaining = EDIT_TIME_LIMIT_MS - (now - messageTime);
    return Math.max(0, remaining);
}

function startEditMessage(messageId) {
    const messageEl = document.getElementById(`message_${messageId}`);
    if (!messageEl) return;
    
    const messageData = messageEl._messageData;
    if (!messageData) {
        showError('Сообщение не найдено');
        return;
    }
    
    if (!canEditMessage(messageData)) {
        showError('Время для редактирования истекло (10 минут)');
        return;
    }
    
    // Показываем UI редактирования
    const editBar = document.getElementById('editBar');
    const editContent = document.getElementById('editContent');
    
    if (editBar && editContent) {
        editContent.textContent = 'Редактирование сообщения';
        editBar.classList.add('active');
        editBar.dataset.editMessageId = messageId;
        
        // Устанавливаем текст в поле ввода
        const textInput = document.getElementById('text');
        if (textInput) {
            textInput.value = messageData.text || '';
            textInput.focus();
            textInput.dataset.editOriginalText = messageData.text || '';
        }
        
        showNotification('Редактирование', 'Измените текст и нажмите отправить', 'info');
    }
}

function saveEditedMessage(messageId, newText) {
    if (!chatRef || !messageId) return false;
    
    const now = Date.now();
    const updates = {
        text: newText,
        edited: true,
        editedAt: now
    };
    
    chatRef.child(messageId).update(updates)
        .then(() => {
            showNotification('Редактирование', 'Сообщение изменено', 'success');
            
            // Обновляем UI
            const messageEl = document.getElementById(`message_${messageId}`);
            if (messageEl) {
                const textEl = messageEl.querySelector('.message-text');
                if (textEl) {
                    textEl.innerHTML = escapeHtml(newText);
                }
                
                // Добавляем метку "изм."
                const timeEl = messageEl.querySelector('.message-time');
                if (timeEl && !timeEl.textContent.includes('изм.')) {
                    timeEl.textContent = timeEl.textContent.replace(' (изм.)', '') + ' (изм.)';
                }
            }
            
            // Скрываем панель редактирования
            const editBar = document.getElementById('editBar');
            if (editBar) {
                editBar.classList.remove('active');
                delete editBar.dataset.editMessageId;
            }
            
            const textInput = document.getElementById('text');
            if (textInput) {
                textInput.value = '';
                delete textInput.dataset.editOriginalText;
            }
            
            updateSendButton();
        })
        .catch(err => {
            console.error('Ошибка редактирования:', err);
            showError('Не удалось редактировать сообщение');
        });
    
    return true;
}

function cancelEdit() {
    const editBar = document.getElementById('editBar');
    if (editBar) {
        editBar.classList.remove('active');
        delete editBar.dataset.editMessageId;
    }
    
    const textInput = document.getElementById('text');
    if (textInput) {
        textInput.value = '';
        delete textInput.dataset.editOriginalText;
    }
    
    updateSendButton();
}

/* ==========================================================
   4. УДАЛЕНИЕ СООБЩЕНИЙ ДЛЯ ВСЕХ
   ========================================================== */
function deleteMessageForEveryone(messageId) {
    if (!chatRef || !messageId) return false;
    
    if (!confirm('Удалить сообщение для всех участников чата?')) {
        return false;
    }
    
    chatRef.child(messageId).remove()
        .then(() => {
            showNotification('Удаление', 'Сообщение удалено для всех', 'success');
            
            // Удаляем из UI
            const messageEl = document.getElementById(`message_${messageId}`);
            if (messageEl) {
                messageEl.remove();
            }
            
            // Обновляем кеш
            if (currentChatPath) {
                const list = readChatCache(currentChatPath).filter(m => m.id !== messageId);
                writeChatCache(currentChatPath, list);
            }
        })
        .catch(err => {
            console.error('Ошибка удаления:', err);
            showError('Не удалось удалить сообщение');
        });
    
    return true;
}

function deleteMessageForMe(messageId) {
    if (!chatRef || !messageId) return false;
    
    if (!confirm('Удалить сообщение только для себя?')) {
        return false;
    }
    
    // Помечаем как удаленное для текущего пользователя
    const updates = {};
    updates[`deletedFor.${username}`] = true;
    
    chatRef.child(messageId).update(updates)
        .then(() => {
            showNotification('Удаление', 'Сообщение удалено для вас', 'success');
            
            const messageEl = document.getElementById(`message_${messageId}`);
            if (messageEl) {
                messageEl.style.display = 'none';
            }
        })
        .catch(err => {
            console.error('Ошибка удаления:', err);
            showError('Не удалось удалить сообщение');
        });
    
    return true;
}

/* ==========================================================
   5. АРХИВАЦИЯ ЧАТОВ
   ========================================================== */
let archivedChats = [];

function loadArchivedChats() {
    try {
        const saved = localStorage.getItem('ruchat_archived_chats');
        archivedChats = saved ? JSON.parse(saved) : [];
    } catch (e) {
        console.error('Ошибка загрузки архива:', e);
        archivedChats = [];
    }
}

function saveArchivedChats() {
    try {
        localStorage.setItem('ruchat_archived_chats', JSON.stringify(archivedChats));
    } catch (e) {
        console.error('Ошибка сохранения архива:', e);
    }
}

function isChatArchived(chatId, isGroup) {
    const key = `${isGroup ? 'g:' : 'p:'}${chatId}`;
    return archivedChats.includes(key);
}

function toggleArchiveChat(chatId, isGroup) {
    const key = `${isGroup ? 'g:' : 'p:'}${chatId}`;
    const index = archivedChats.indexOf(key);
    
    if (index >= 0) {
        // Разархивировать
        archivedChats.splice(index, 1);
        showNotification('Архив', 'Чат возвращен из архива', 'info');
    } else {
        // Архивировать
        archivedChats.push(key);
        showNotification('Архив', 'Чат архивирован', 'info');
        
        // Если это текущий чат - закрываем его
        if (currentChatId === chatId) {
            closeChat();
        }
    }
    
    saveArchivedChats();
    renderFriends();
    return true;
}

function getArchivedChatIds() {
    return archivedChats.map(key => ({
        id: key.substring(2),
        isGroup: key.startsWith('g:')
    }));
}

function showSavedMessagesModal() {
    const saved = getSavedMessagesList();
    
    if (saved.length === 0) {
        showNotification('Избранное', 'Список избранного пуст', 'info');
        return;
    }
    
    let html = '<div class="saved-list">';
    saved.forEach(msg => {
        const date = new Date(msg.time).toLocaleDateString('ru-RU');
        const preview = msg.text || msg.type || 'Медиа';
        html += `
            <div class="saved-item" onclick="jumpToSavedMessage('${msg.chatId}', '${msg.id}')">
                <div class="saved-item-text">${escapeHtml(preview)}</div>
                <div class="saved-item-meta">
                    <span>${date}</span>
                    <span>${msg.from}</span>
                </div>
            </div>
        `;
    });
    html += '</div>';
    
    const modal = document.createElement('div');
    modal.className = 'saved-modal-overlay';
    modal.innerHTML = `
        <div class="saved-modal">
            <div class="saved-header">
                <h2>Избранные сообщения</h2>
                <button class="close-btn" onclick="this.closest('.saved-modal-overlay').remove()">✕</button>
            </div>
            ${html}
            <div class="saved-actions">
                <button class="login-btn secondary" onclick="clearSavedMessages()">Очистить все</button>
                <button class="login-btn" onclick="this.closest('.saved-modal-overlay').remove()">Закрыть</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function jumpToSavedMessage(chatId, messageId) {
    // Закрываем модальное окно
    document.querySelector('.saved-modal-overlay')?.remove();
    
    // Переходим к чату
    if (currentChatId !== chatId) {
        // Нужно найти чат и открыть его
        const parts = chatId.split('_');
        if (parts.length === 2) {
            const otherUser = parts.find(p => p !== username);
            if (otherUser) {
                openPrivateChat(otherUser);
            }
        }
    }
    
    // Прокручиваем к сообщению
    setTimeout(() => {
        const messageEl = document.getElementById(`message_${messageId}`);
        if (messageEl) {
            messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            messageEl.style.background = 'rgba(0, 136, 204, 0.3)';
            setTimeout(() => {
                messageEl.style.background = '';
            }, 2000);
        }
    }, 500);
}

/* ==========================================================
   7. ГЛОБАЛЬНЫЙ ПОИСК
   ========================================================== */
let globalSearchIndex = [];

function buildGlobalSearchIndex() {
    globalSearchIndex = [];
    
    // Индексируем чаты
    Object.keys(friendsCache || {}).forEach(friend => {
        if (!blockedCache[friend]) {
            globalSearchIndex.push({
                type: 'chat',
                id: friend,
                isGroup: false,
                title: resolveUserLabel(friend),
                lastMessage: ''
            });
        }
    });
    
    // Индексируем группы
    const groups = document.querySelectorAll('.group-item');
    groups.forEach(group => {
        const groupId = group.id.replace('group_', '');
        const title = group.querySelector('.group-name')?.textContent || '';
        globalSearchIndex.push({
            type: 'chat',
            id: groupId,
            isGroup: true,
            title: title,
            lastMessage: ''
        });
    });
}

function showGlobalSearch() {
    buildGlobalSearchIndex();
    
    const overlay = document.createElement('div');
    overlay.className = 'global-search-overlay';
    overlay.id = 'globalSearchOverlay';
    overlay.innerHTML = `
        <div class="global-search-header">
            <input type="text" class="global-search-input" id="globalSearchInput" 
                   placeholder="Поиск по чатам и сообщениям..." 
                   oninput="performGlobalSearch(this.value)">
            <button class="global-search-close" onclick="closeGlobalSearch()">✕</button>
        </div>
        <div class="global-search-results" id="globalSearchResults"></div>
    `;
    
    document.body.appendChild(overlay);
    document.getElementById('globalSearchInput').focus();
}

function closeGlobalSearch() {
    document.getElementById('globalSearchOverlay')?.remove();
}

function performGlobalSearch(query) {
    const resultsContainer = document.getElementById('globalSearchResults');
    if (!resultsContainer) return;
    
    const q = (query || '').toLowerCase().trim();
    if (q.length < 2) {
        resultsContainer.innerHTML = '<div class="empty-state"><div class="icon">🔍</div><div class="title">Введите минимум 2 символа</div></div>';
        return;
    }
    
    const chatResults = globalSearchIndex.filter(item => 
        item.title.toLowerCase().includes(q)
    ).slice(0, 20);
    
    let html = '';
    
    if (chatResults.length > 0) {
        html += `
            <div class="global-search-section">
                <div class="global-search-section-title">Чаты</div>
        `;
        
        chatResults.forEach(result => {
            html += `
                <div class="global-search-result-item" onclick="openGlobalSearchResult('${result.id}', ${result.isGroup})">
                    <div class="global-search-result-chat">${escapeHtml(result.title)}</div>
                    <div class="global-search-result-text">${result.isGroup ? 'Группа' : 'Личный чат'}</div>
                </div>
            `;
        });
        
        html += '</div>';
    }
    
    if (chatResults.length === 0) {
        html += '<div class="empty-state"><div class="icon">🔍</div><div class="title">Ничего не найдено</div></div>';
    }
    
    resultsContainer.innerHTML = html;
}

function openGlobalSearchResult(id, isGroup) {
    closeGlobalSearch();
    
    if (isGroup) {
        // Открыть группу
        const groupEl = document.getElementById(`group_${id}`);
        if (groupEl) {
            groupEl.click();
        }
    } else {
        // Открыть личный чат
        openPrivateChat(id);
    }
}

/* ==========================================================
   8. ПАПКИ ДЛЯ ЧАТОВ
   ========================================================== */
let chatFolders = {
    'all': 'Все',
    'personal': 'Личные',
    'groups': 'Группы',
    'unread': 'Непрочитанные'
};

let currentFolder = 'all';

function setChatFolder(folder) {
    currentFolder = folder;
    
    // Обновляем UI
    document.querySelectorAll('.chat-folder-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.folder === folder);
    });
    
    // Фильтрация
    filterChatsByFolder(folder);
}

function filterChatsByFolder(folder) {
    const friendList = document.getElementById('friendList');
    const groupList = document.getElementById('groupList');
    
    if (!friendList || !groupList) return;
    
    const friends = friendList.querySelectorAll('.contact-item');
    const groups = groupList.querySelectorAll('.group-item');
    
    if (folder === 'all') {
        friends.forEach(el => el.style.display = 'flex');
        groups.forEach(el => el.style.display = 'flex');
    } else if (folder === 'personal') {
        friends.forEach(el => el.style.display = 'flex');
        groups.forEach(el => el.style.display = 'none');
    } else if (folder === 'groups') {
        friends.forEach(el => el.style.display = 'none');
        groups.forEach(el => el.style.display = 'flex');
    } else if (folder === 'unread') {
        friends.forEach(el => {
            const hasUnread = el.classList.contains('has-unread');
            el.style.display = hasUnread ? 'flex' : 'none';
        });
        groups.forEach(el => {
            const hasUnread = el.classList.contains('has-unread');
            el.style.display = hasUnread ? 'flex' : 'none';
        });
    }
}

// Экспорт
window.setChatFolder = setChatFolder;
window.filterChatsByFolder = filterChatsByFolder;
window.showGlobalSearch = showGlobalSearch;
window.showSavedMessagesModal = showSavedMessagesModal;
window.showArchivedChatsModal = showArchivedChatsModal;

function unarchiveChat(chatId, isGroup) {
    toggleArchiveChat(chatId, isGroup);
    document.querySelector('.archived-modal-overlay')?.remove();
}

function showArchivedChatsModal() {
    const archived = getArchivedChatIds();
    
    if (archived.length === 0) {
        showNotification('Архив', 'Архив пуст', 'info');
        return;
    }
    
    let html = '<div class="archived-list">';
    archived.forEach(chat => {
        const name = chat.isGroup ? 'Группа' : chat.id;
        html += `
            <div class="archived-item" onclick="unarchiveChat('${chat.id}', ${chat.isGroup})">
                <span>${name}</span>
                <button class="unarchive-btn">Вернуть</button>
            </div>
        `;
    });
    html += '</div>';
    
    const modal = document.createElement('div');
    modal.className = 'archived-modal-overlay';
    modal.innerHTML = `
        <div class="archived-modal">
            <div class="archived-header">
                <h2>Архив чатов</h2>
                <button class="close-btn" onclick="this.closest('.archived-modal-overlay').remove()">✕</button>
            </div>
            ${html}
            <div class="archived-actions">
                <button class="clear-archive-btn" onclick="clearAllArchived()">Очистить архив</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function clearAllArchived() {
    if (confirm('Очистить весь архив? Чаты будут возвращены в общий список.')) {
        archivedChats = [];
        saveArchivedChats();
        renderFriends();
        document.querySelector('.archived-modal-overlay')?.remove();
        showNotification('Архив', 'Архив очищен', 'success');
    }
}

/* ==========================================================
   6. ИСЧЕЗАЮЩИЕ СООБЩЕНИЯ
   ========================================================== */
const EPHEMERAL_TIMERS = {
    'off': 0,
    '1min': 60 * 1000,
    '5min': 5 * 60 * 1000,
    '1hour': 60 * 60 * 1000,
    '1day': 24 * 60 * 60 * 1000,
    '1week': 7 * 24 * 60 * 60 * 1000
};

let currentEphemeralTimer = 'off';

function setEphemeralTimer(timer) {
    currentEphemeralTimer = timer;
    localStorage.setItem('ruchat_ephemeral_timer', timer);
    
    const labels = {
        'off': 'выключены',
        '1min': '1 минуту',
        '5min': '5 минут',
        '1hour': '1 час',
        '1day': '1 день',
        '1week': '1 неделю'
    };
    
    showNotification('Исчезающие сообщения', `Таймер установлен на ${labels[timer] || 'выкл'}`, 'info');
    updateEphemeralUI();
}

function loadEphemeralTimer() {
    const saved = localStorage.getItem('ruchat_ephemeral_timer');
    currentEphemeralTimer = saved || 'off';
    updateEphemeralUI();
}

function updateEphemeralUI() {
    const btn = document.getElementById('ephemeralBtn');
    if (btn) {
        btn.classList.toggle('active', currentEphemeralTimer !== 'off');
        btn.title = currentEphemeralTimer !== 'off' 
            ? `Исчезают через ${currentEphemeralTimer}` 
            : 'Исчезающие сообщения выключены';
    }
}

function getEphemeralExpiresAt() {
    if (currentEphemeralTimer === 'off') return null;
    return Date.now() + EPHEMERAL_TIMERS[currentEphemeralTimer];
}

function setupEphemeralCleanup() {
    // Проверяем каждые 10 секунд
    setInterval(() => {
        const now = Date.now();
        
        // Проверяем сообщения в текущем чате
        if (currentChatPath) {
            const messages = document.querySelectorAll('.message-wrapper');
            messages.forEach(msg => {
                const expiresAt = msg.dataset.expiresAt;
                if (expiresAt && parseInt(expiresAt) < now) {
                    msg.remove();
                }
            });
        }
    }, 10000);
}

function showEphemeralMenu() {
    const menu = document.createElement('div');
    menu.className = 'ephemeral-menu-overlay';
    menu.innerHTML = `
        <div class="ephemeral-menu">
            <div class="ephemeral-header">
                <h3>Исчезающие сообщения</h3>
                <button class="close-btn" onclick="this.closest('.ephemeral-menu-overlay').remove()">✕</button>
            </div>
            <div class="ephemeral-options">
                <button class="ephemeral-option ${currentEphemeralTimer === 'off' ? 'active' : ''}" onclick="setEphemeralTimer('off')">
                    <span>🔓</span> Выключены
                </button>
                <button class="ephemeral-option ${currentEphemeralTimer === '1min' ? 'active' : ''}" onclick="setEphemeralTimer('1min')">
                    <span>⏱️</span> 1 минута
                </button>
                <button class="ephemeral-option ${currentEphemeralTimer === '5min' ? 'active' : ''}" onclick="setEphemeralTimer('5min')">
                    <span>⏱️</span> 5 минут
                </button>
                <button class="ephemeral-option ${currentEphemeralTimer === '1hour' ? 'active' : ''}" onclick="setEphemeralTimer('1hour')">
                    <span>⏱️</span> 1 час
                </button>
                <button class="ephemeral-option ${currentEphemeralTimer === '1day' ? 'active' : ''}" onclick="setEphemeralTimer('1day')">
                    <span>⏱️</span> 1 день
                </button>
                <button class="ephemeral-option ${currentEphemeralTimer === '1week' ? 'active' : ''}" onclick="setEphemeralTimer('1week')">
                    <span>⏱️</span> 1 неделя
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(menu);
}

/* ==========================================================
   7. СКРЫТИЕ ОНЛАЙН СТАТУСА
   ========================================================== */
function getPrivacySettings() {
    return {
        showOnline: localStorage.getItem('ruchat_privacy_online') !== 'false',
        showLastSeen: localStorage.getItem('ruchat_privacy_lastseen') !== 'false',
        showAvatar: localStorage.getItem('ruchat_privacy_avatar') !== 'false',
        readReceipts: localStorage.getItem('ruchat_privacy_readreceipts') !== 'false'
    };
}

function setPrivacySetting(key, value) {
    localStorage.setItem(`ruchat_privacy_${key}`, value ? 'true' : 'false');
    
    // Обновляем настройки в Firebase
    if (username) {
        db.ref(`accounts/${username}/privacy`).update({
            [`show${key.charAt(0).toUpperCase() + key.slice(1)}`]: value ? 'everyone' : 'nobody'
        }).catch(err => console.error('Ошибка обновления приватности:', err));
    }
    
    showNotification('Приватность', 'Настройки сохранены', 'success');
}

function shouldShowOnlineStatus(targetUsername) {
    if (targetUsername === username) return true;
    
    const privacy = getPrivacySettings();
    return privacy.showOnline;
}

function shouldShowLastSeen(targetUsername) {
    if (targetUsername === username) return true;
    
    const privacy = getPrivacySettings();
    return privacy.showLastSeen;
}

function showPrivacySettingsModal() {
    const privacy = getPrivacySettings();
    
    const modal = document.createElement('div');
    modal.className = 'privacy-modal-overlay';
    modal.innerHTML = `
        <div class="privacy-modal">
            <div class="privacy-header">
                <h2>Приватность</h2>
                <button class="close-btn" onclick="this.closest('.privacy-modal-overlay').remove()">✕</button>
            </div>
            <div class="privacy-settings">
                <div class="privacy-setting">
                    <label>
                        <input type="checkbox" ${privacy.showOnline ? 'checked' : ''} 
                               onchange="setPrivacySetting('Online', this.checked)">
                        <span>Показывать мой онлайн статус</span>
                    </label>
                </div>
                <div class="privacy-setting">
                    <label>
                        <input type="checkbox" ${privacy.showLastSeen ? 'checked' : ''} 
                               onchange="setPrivacySetting('LastSeen', this.checked)">
                        <span>Показывать время посещения</span>
                    </label>
                </div>
                <div class="privacy-setting">
                    <label>
                        <input type="checkbox" ${privacy.showAvatar ? 'checked' : ''} 
                               onchange="setPrivacySetting('Avatar', this.checked)">
                        <span>Показывать мой аватар</span>
                    </label>
                </div>
                <div class="privacy-setting">
                    <label>
                        <input type="checkbox" ${privacy.readReceipts ? 'checked' : ''} 
                               onchange="setPrivacySetting('ReadReceipts', this.checked)">
                        <span>Показывать прочтение сообщений</span>
                    </label>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

/* ==========================================================
   ИНИЦИАЛИЗАЦИЯ
   ========================================================== */
document.addEventListener('DOMContentLoaded', () => {
    loadPinnedChats();
    loadSavedMessages();
    loadArchivedChats();
    loadEphemeralTimer();
    setupEphemeralCleanup();
    
    console.log('[Extended Features] Загружено');
});

// Экспорт функций глобально
window.togglePinChat = togglePinChat;
window.isChatPinned = isChatPinned;
window.toggleSaveMessage = toggleSaveMessage;
window.getSavedMessagesList = getSavedMessagesList;
window.clearSavedMessages = clearSavedMessages;
window.startEditMessage = startEditMessage;
window.saveEditedMessage = saveEditedMessage;
window.cancelEdit = cancelEdit;
window.canEditMessage = canEditMessage;
window.deleteMessageForEveryone = deleteMessageForEveryone;
window.deleteMessageForMe = deleteMessageForMe;
window.toggleArchiveChat = toggleArchiveChat;
window.showArchivedChatsModal = showArchivedChatsModal;
window.setEphemeralTimer = setEphemeralTimer;
window.showEphemeralMenu = showEphemeralMenu;
window.showPrivacySettingsModal = showPrivacySettingsModal;
window.setPrivacySetting = setPrivacySetting;
window.shouldShowOnlineStatus = shouldShowOnlineStatus;
window.shouldShowLastSeen = shouldShowLastSeen;
