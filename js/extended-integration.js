/* ==========================================================
   RUCHAT EXTENDED FEATURES - INTEGRATION
   Интеграция расширенных функций с основным кодом
   Версия: 2026-03-12
   ========================================================== */

// Ждем загрузки основного кода
document.addEventListener('DOMContentLoaded', () => {
    // Инициализация расширенных функций
    setTimeout(() => {
        initExtendedFeaturesIntegration();
    }, 1000);
});

function initExtendedFeaturesIntegration() {
    console.log('[Extended Features] Инициализация интеграции...');
    
    // 1. Добавляем контекстное меню для чатов (правый клик)
    initChatContextMenu();
    
    // 2. Добавляем кнопки в меню действий с сообщениями
    initMessageActions();
    
    // 3. Инициализируем папки чатов
    if (typeof renderChatFolders === 'function') {
        renderChatFolders();
    }
    
    console.log('[Extended Features] Интеграция завершена');
}

/* ==========================================================
   1. КОНТЕКСТНОЕ МЕНЮ ДЛЯ ЧАТОВ
   ========================================================== */
function initChatContextMenu() {
    // Личные чаты
    document.addEventListener('contextmenu', (e) => {
        const contactItem = e.target.closest('.contact-item');
        const groupItem = e.target.closest('.group-item');
        
        if (contactItem || groupItem) {
            e.preventDefault();
            const item = contactItem || groupItem;
            const chatId = item.id.replace('contact_', '').replace('group_', '');
            const isGroup = !!groupItem;
            
            showChatContextMenu(e.clientX, e.clientY, chatId, isGroup);
        }
    });
    
    // Закрытие меню при клике
    document.addEventListener('click', () => {
        document.querySelector('.chat-context-menu')?.remove();
    });
}

function showChatContextMenu(x, y, chatId, isGroup) {
    // Удаляем старое меню
    document.querySelector('.chat-context-menu')?.remove();
    
    const isPinned = (typeof isChatPinned === 'function') ? isChatPinned(chatId, isGroup) : false;
    const isArchived = (typeof isChatArchived === 'function') ? isChatArchived(chatId, isGroup) : false;
    
    const menu = document.createElement('div');
    menu.className = 'chat-context-menu';
    menu.style.cssText = `
        position: fixed;
        left: ${Math.min(x, window.innerWidth - 220)}px;
        top: ${Math.min(y, window.innerHeight - 300)}px;
        background: #1e2736;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 12px;
        padding: 8px 0;
        z-index: 10000;
        min-width: 200px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    `;
    
    menu.innerHTML = `
        <div class="context-menu-item" onclick="(function(){ if(typeof togglePinChat==='function') togglePinChat('${chatId}', ${isGroup}); })(); this.closest('.chat-context-menu')?.remove()">
            <span>${isPinned ? '📌' : '📍'}</span> ${isPinned ? 'Открепить' : 'Закрепить'}
        </div>
        <div class="context-menu-item" onclick="(function(){ if(typeof toggleArchiveChat==='function') toggleArchiveChat('${chatId}', ${isGroup}); })(); this.closest('.chat-context-menu')?.remove()">
            <span>📦</span> ${isArchived ? 'Разархивировать' : 'Архивировать'}
        </div>
        <div class="context-menu-item" onclick="(function(){ if(typeof showChatNotifySettings==='function') showChatNotifySettings('${chatId}', ${isGroup}); })(); this.closest('.chat-context-menu')?.remove()">
            <span>🔔</span> Уведомления
        </div>
        <div class="context-menu-item" onclick="(function(){ if(typeof clearCurrentChat==='function') clearCurrentChat(); })(); this.closest('.chat-context-menu')?.remove()">
            <span>🗑️</span> Очистить чат
        </div>
    `;
    
    document.body.appendChild(menu);
}

/* ==========================================================
   2. КНОПКИ ДЕЙСТВИЙ С СООБЩЕНИЯМИ
   ========================================================== */
function initMessageActions() {
    // Добавляем кнопку "Избранное" в действия сообщений
    document.addEventListener('click', (e) => {
        const saveBtn = e.target.closest('[data-action="save-message"]');
        if (saveBtn) {
            const messageId = saveBtn.dataset.messageId;
            const messageEl = document.getElementById(`message_${messageId}`);
            if (messageEl && messageEl._messageData) {
                toggleSaveMessage(messageId, currentChatId, messageEl._messageData);
            }
        }
        
        const editBtn = e.target.closest('[data-action="edit-message"]');
        if (editBtn) {
            const messageId = editBtn.dataset.messageId;
            startEditMessage(messageId);
        }
        
        const deleteBtn = e.target.closest('[data-action="delete-message"]');
        if (deleteBtn) {
            const messageId = deleteBtn.dataset.messageId;
            const forEveryone = deleteBtn.dataset.forEveryone === 'true';
            if (forEveryone) {
                deleteMessageForEveryone(messageId);
            } else {
                deleteMessageForMe(messageId);
            }
        }
    });
}

/* ==========================================================
   3. МОДИФИКАЦИЯ СУЩЕСТВУЮЩИХ ФУНКЦИЙ
   ========================================================== */

// Модифицируем функцию отправки сообщений для поддержки исчезающих
const originalSendMessage = window.sendMessage;
window.sendMessage = function() {
    if (originalSendMessage) {
        originalSendMessage();
    }

    // Добавляем метку времени исчезновения если нужно
    if (typeof currentEphemeralTimer !== 'undefined' && currentEphemeralTimer !== 'off' && currentChatPath) {
        const expiresAt = getEphemeralExpiresAt();
        if (expiresAt) {
            // Последнее сообщение получит метку
            const lastMessage = document.querySelector('#messages .message-wrapper:last-child');
            if (lastMessage) {
                lastMessage.dataset.expiresAt = expiresAt;
            }
        }
    }
};

// Модифицируем отображение сообщений для поддержки редактирования
const originalAddMessageToChat = window.addMessageToChat;
if (originalAddMessageToChat) {
    window.addMessageToChat = function(message, options) {
        const result = originalAddMessageToChat(message, options);
        
        // Сохраняем данные сообщения в элементе
        setTimeout(() => {
            const messageEl = document.getElementById(`message_${message.id}`);
            if (messageEl) {
                messageEl._messageData = message;
                
                // Добавляем класс если сообщение отредактировано
                if (message.edited) {
                    messageEl.classList.add('message-edited');
                }
            }
        }, 100);
        
        return result;
    };
}

/* ==========================================================
   5. СТИЛИ ДЛЯ КОНТЕКСТНОГО МЕНЮ
   ========================================================== */
const contextMenuStyles = document.createElement('style');
contextMenuStyles.textContent = `
    .context-menu-item {
        padding: 10px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
        transition: all 0.2s;
        color: #e2e8f0;
        font-size: 14px;
    }
    
    .context-menu-item:hover {
        background: rgba(255, 255, 255, 0.1);
    }
    
    .context-menu-item.danger {
        color: #ef4444;
    }
    
    .context-menu-item.danger:hover {
        background: rgba(239, 68, 68, 0.2);
    }
`;
document.head.appendChild(contextMenuStyles);

// Экспорт функций
window.showChatContextMenu = showChatContextMenu;
window.initExtendedFeaturesIntegration = initExtendedFeaturesIntegration;
