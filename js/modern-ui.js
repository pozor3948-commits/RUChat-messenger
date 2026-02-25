/* =====================================================
   MODERN UI - RuChat 2026
   Функции для современного интерфейса
   ===================================================== */

let currentModernTab = 'chats';
let modernSwipeState = {
    tracking: false,
    startX: 0,
    dx: 0
};

// ========== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК ==========
function switchTab(tab) {
    currentModernTab = tab;
    
    // Обновляем активный класс навигации
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    document.getElementById('nav' + tab.charAt(0).toUpperCase() + tab.slice(1)).classList.add('active');
    
    // Показываем нужный экран
    document.querySelectorAll('.chats-screen, .settings-screen, .chat-screen').forEach(screen => {
        if (screen.id !== 'chatScreen') {
            screen.style.display = 'none';
        }
    });
    
    if (tab === 'chats') {
        document.getElementById('chatsScreen').style.display = 'flex';
        renderModernChatsList();
    } else if (tab === 'settings') {
        document.getElementById('settingsScreen').style.display = 'flex';
        updateSettingsScreen();
    } else if (tab === 'calls') {
        // Заглушка для звонков
        showNotification('Звонки', 'Раздел в разработке');
    }
}

// ========== ОТРИСОВКА СПИСКА ЧАТОВ ==========
function renderModernChatsList() {
    const container = document.getElementById('modernChatsList');
    if (!container) return;
    
    // Получаем данные из существующих списков
    const friendList = document.getElementById('friendList');
    const groupList = document.getElementById('groupList');
    
    if ((!friendList || friendList.children.length === 0) && 
        (!groupList || groupList.children.length === 0)) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-title">Нет чатов</div>
                <div class="empty-state-text">Начните общение, добавив друзей</div>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    // Добавляем друзей
    if (friendList) {
        const contacts = friendList.querySelectorAll('.contact-item');
        contacts.forEach(contact => {
            const avatar = contact.querySelector('.contact-avatar');
            const nameEl = contact.querySelector('.contact-name');
            const lastMessage = contact.querySelector('.last-message');
            const lastSeen = contact.querySelector('.last-seen');
            const unread = contact.querySelector('.unread-badge');
            
            const name = nameEl ? nameEl.textContent : 'Контакт';
            const avatarSrc = avatar && avatar.src ? avatar.src : 
                'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=0088cc&color=fff&size=56';
            const isOnline = avatar && avatar.parentElement && 
                avatar.parentElement.querySelector('.online-dot:not(.offline)');
            
            html += `
                <div class="chat-item" onclick="openModernChat('${name.replace(/'/g, "\\'")}', '${avatarSrc}', '${isOnline ? 'В сети' : 'Не в сети'}')">
                    <img src="${avatarSrc}" alt="Avatar" class="chat-item-avatar ${isOnline ? 'avatar-online' : 'avatar-offline'}">
                    <div class="chat-item-content">
                        <div class="chat-item-top">
                            <div class="chat-item-name">${name}</div>
                            <div class="chat-item-time">${lastSeen ? lastSeen.textContent : ''}</div>
                        </div>
                        <div class="chat-item-preview">
                            <div class="chat-item-message">${lastMessage ? lastMessage.textContent : 'Нет сообщений'}</div>
                            ${unread ? `<div class="chat-item-unread">${unread.textContent}</div>` : ''}
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    // Добавляем группы
    if (groupList) {
        const groups = groupList.querySelectorAll('.group-item');
        groups.forEach(group => {
            const avatar = group.querySelector('.group-avatar');
            const nameEl = group.querySelector('.group-name');
            const lastMessage = group.querySelector('.last-message');
            
            const name = nameEl ? nameEl.textContent : 'Группа';
            const avatarSrc = avatar && avatar.src ? avatar.src : 
                'https://ui-avatars.com/api/?name=' + encodeURIComponent(name) + '&background=0088cc&color=fff&size=56';
            
            html += `
                <div class="chat-item" onclick="openModernChat('${name.replace(/'/g, "\\'")}', '${avatarSrc}', 'online')">
                    <img src="${avatarSrc}" alt="Avatar" class="chat-item-avatar avatar-online">
                    <div class="chat-item-content">
                        <div class="chat-item-top">
                            <div class="chat-item-name">${name}</div>
                        </div>
                        <div class="chat-item-preview">
                            <div class="chat-item-message">${lastMessage ? lastMessage.textContent : 'Групповой чат'}</div>
                        </div>
                    </div>
                </div>
            `;
        });
    }
    
    container.innerHTML = html || `
        <div class="empty-state">
            <div class="empty-state-icon">💬</div>
            <div class="empty-state-title">Нет чатов</div>
            <div class="empty-state-text">Начните общение, добавив друзей</div>
        </div>
    `;
}

// ========== ОТКРЫТИЕ ЧАТА ==========
function openModernChat(name, avatar, status) {
    const chatScreen = document.getElementById('chatScreen');
    const chatName = document.getElementById('chatScreenName');
    const chatAvatar = document.getElementById('chatScreenAvatar');
    const chatStatus = document.getElementById('chatScreenStatus');
    
    chatName.textContent = name;
    chatAvatar.src = avatar;
    chatStatus.textContent = status;
    
    chatScreen.classList.add('active');
    chatScreen.style.display = 'flex';
    
    // Скрываем навигацию
    document.querySelector('.bottom-nav').style.display = 'none';
    
    // Загружаем сообщения
    setTimeout(() => {
        loadModernMessages(name);
    }, 100);
    
    // Инициализируем свайп
    initModernSwipe();
}

// ========== ЗАГРУЗКА СООБЩЕНИЙ ==========
function loadModernMessages(chatName) {
    const container = document.getElementById('modernMessages');
    if (!container) return;
    
    // Копируем сообщения из старого контейнера
    const oldMessages = document.getElementById('messages');
    if (oldMessages) {
        container.innerHTML = oldMessages.innerHTML;
        
        // Добавляем классы для нового стиля
        container.querySelectorAll('.message').forEach(msg => {
            // Проверяем, является ли сообщение входящим или исходящим
            const wrapper = msg.closest('.message-wrapper');
            if (wrapper) {
                if (wrapper.classList.contains('me')) {
                    msg.classList.add('outgoing');
                    msg.classList.remove('incoming');
                } else {
                    msg.classList.add('incoming');
                    msg.classList.remove('outgoing');
                }
            } else {
                // Если нет wrapper, считаем исходящим
                msg.classList.add('outgoing');
            }
        });
    }
    
    // Прокрутка вниз
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

// ========== ОТПРАВКА СООБЩЕНИЙ ==========
function sendModernMessage() {
    const input = document.getElementById('modernMessageInput');
    if (!input) return;
    
    const text = input.value.trim();
    if (!text) return;
    
    // Используем существующую функцию sendMessage
    if (typeof sendMessage === 'function') {
        // Временно переключаем input
        const oldInput = document.getElementById('text');
        if (oldInput) {
            const oldText = oldInput.value;
            oldInput.value = text;
            sendMessage();
            oldInput.value = oldText;
        }
        input.value = '';
    }
    
    updateModernSendButton();
}

function handleModernKeyPress(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendModernMessage();
    }
}

function updateModernSendButton() {
    const input = document.getElementById('modernMessageInput');
    const btn = document.getElementById('modernSendBtn');
    if (!input || !btn) return;
    
    if (input.value.trim()) {
        btn.style.opacity = '1';
        btn.style.pointerEvents = 'auto';
        btn.style.transform = 'scale(1)';
    } else {
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
        btn.style.transform = 'scale(1)';
    }
}

// ========== ЗАКРЫТИЕ ЧАТА ==========
function closeChatFromScreen() {
    const chatScreen = document.getElementById('chatScreen');
    
    chatScreen.classList.remove('active');
    
    setTimeout(() => {
        chatScreen.style.display = 'none';
        document.querySelector('.bottom-nav').style.display = 'flex';
        
        // Возвращаемся на вкладку чатов
        switchTab('chats');
    }, 300);
}

// ========== СВАЙП ДЛЯ ВЫХОДА ИЗ ЧАТА ==========
function initModernSwipe() {
    const chatScreen = document.getElementById('chatScreen');
    if (!chatScreen) return;
    
    // Удаляем старые обработчики
    chatScreen.removeEventListener('touchstart', handleSwipeStart);
    chatScreen.removeEventListener('touchmove', handleSwipeMove);
    chatScreen.removeEventListener('touchend', handleSwipeEnd);
    
    // Добавляем новые
    chatScreen.addEventListener('touchstart', handleSwipeStart, { passive: true });
    chatScreen.addEventListener('touchmove', handleSwipeMove, { passive: false });
    chatScreen.addEventListener('touchend', handleSwipeEnd, { passive: true });
}

function handleSwipeStart(e) {
    if (e.touches.length !== 1) return;
    
    const touch = e.touches[0];
    // Проверяем, что свайп начинается с левого края (до 50px)
    if (touch.clientX > 50) return;
    
    modernSwipeState.tracking = true;
    modernSwipeState.startX = touch.clientX;
    modernSwipeState.dx = 0;
    
    const chatScreen = document.getElementById('chatScreen');
    chatScreen.classList.add('swiping');
}

function handleSwipeMove(e) {
    if (!modernSwipeState.tracking) return;
    
    const touch = e.touches[0];
    const dx = touch.clientX - modernSwipeState.startX;
    
    // Игнорируем движение вправо
    if (dx <= 0) return;
    
    modernSwipeState.dx = Math.min(dx, window.innerWidth * 0.8);
    
    const chatScreen = document.getElementById('chatScreen');
    chatScreen.style.transform = `translateX(${modernSwipeState.dx}px)`;
    chatScreen.style.opacity = 1 - (modernSwipeState.dx / window.innerWidth) * 0.5;
    
    e.preventDefault();
}

function handleSwipeEnd() {
    if (!modernSwipeState.tracking) return;
    
    const chatScreen = document.getElementById('chatScreen');
    const threshold = window.innerWidth * 0.3;
    
    chatScreen.classList.remove('swiping');
    
    if (modernSwipeState.dx >= threshold) {
        // Свайп завершён - закрываем чат
        chatScreen.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        chatScreen.style.transform = 'translateX(100%)';
        chatScreen.style.opacity = '0';
        
        setTimeout(() => {
            closeChatFromScreen();
            chatScreen.style.removeProperty('transform');
            chatScreen.style.removeProperty('opacity');
            chatScreen.style.removeProperty('transition');
        }, 300);
    } else {
        // Возвращаем на место
        chatScreen.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        chatScreen.style.transform = 'translateX(0)';
        chatScreen.style.opacity = '1';
        
        setTimeout(() => {
            chatScreen.style.removeProperty('transition');
        }, 300);
    }
    
    modernSwipeState.tracking = false;
    modernSwipeState.startX = 0;
    modernSwipeState.dx = 0;
}

// ========== НАСТРОЙКИ ==========
function updateSettingsScreen() {
    const avatar = document.getElementById('settingsAvatar');
    const username = document.getElementById('settingsUsername');
    const status = document.getElementById('settingsStatus');
    
    // Получаем данные из существующего UI
    const oldAvatar = document.getElementById('userAvatar');
    const oldName = document.getElementById('userName');
    const oldStatus = document.getElementById('userStatus');
    
    if (oldAvatar && oldAvatar.src) {
        avatar.src = oldAvatar.src;
    }
    if (oldName && oldName.textContent) {
        username.textContent = oldName.textContent;
    }
    if (oldStatus && oldStatus.textContent) {
        status.textContent = oldStatus.textContent;
    }
}

function toggleSwitch(element) {
    element.classList.toggle('active');
}

function toggleThemeSwitch() {
    const toggle = document.getElementById('darkModeToggle');
    toggle.classList.toggle('active');
    
    // Вызываем существующую функцию смены темы
    if (typeof toggleTheme === 'function') {
        toggleTheme();
    }
}

// ========== УВЕДОМЛЕНИЯ ==========
function showNotification(title, text) {
    const notification = document.getElementById('notification');
    const notifTitle = document.getElementById('notificationTitle');
    const notifText = document.getElementById('notificationText');
    
    if (notification && notifTitle && notifText) {
        notifTitle.textContent = title;
        notifText.textContent = text;
        notification.classList.add('active');
        
        setTimeout(() => {
            notification.classList.remove('active');
        }, 3000);
    }
}

// ========== ИНТЕГРАЦИЯ СО СТАРЫМ UI ==========
// Обновляем существующие функции для работы с новым UI

if (!window._modernUiInitialized) {
    window._modernUiInitialized = true;
    
    const originalOpenPrivateChat = window.openPrivateChat || function() {};
    window.openPrivateChat = function(fn) {
        originalOpenPrivateChat(fn);
        
        // Обновляем новый UI
        setTimeout(() => {
            renderModernChatsList();
        }, 100);
    };
    
    const originalOpenGroupChat = window.openGroupChat || function() {};
    window.openGroupChat = function(g, gid) {
        originalOpenGroupChat(g, gid);
        
        // Обновляем новый UI
        setTimeout(() => {
            renderModernChatsList();
        }, 100);
    };
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
document.addEventListener('DOMContentLoaded', function() {
    // Инициализация при загрузке
    console.log('Modern UI initialized');
    
    // Обновляем список чатов
    if (typeof renderModernChatsList === 'function') {
        setTimeout(renderModernChatsList, 500);
    }
});

// Экспортируем функции глобально
window.switchTab = switchTab;
window.openModernChat = openModernChat;
window.closeChatFromScreen = closeChatFromScreen;
window.sendModernMessage = sendModernMessage;
window.handleModernKeyPress = handleModernKeyPress;
window.updateModernSendButton = updateModernSendButton;
window.toggleSwitch = toggleSwitch;
window.toggleThemeSwitch = toggleThemeSwitch;
window.showNotification = showNotification;
