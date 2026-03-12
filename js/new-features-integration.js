/* ==========================================================
   RUCHAT NEW FEATURES - MESSAGE INTEGRATION
   Интеграция новых типов сообщений в чат
   Версия: 2026-03-12
   ========================================================== */

// Модифицируем addMessageToChat для поддержки новых типов
const advOriginalAddMessageToChat = window.addMessageToChat;

if (advOriginalAddMessageToChat) {
    window.addMessageToChat = function(message, options) {
        const result = advOriginalAddMessageToChat(message, options);
        
        // Сохраняем данные для новых типов сообщений
        setTimeout(() => {
            const messageEl = document.getElementById(`message_${message.id}`);
            if (messageEl) {
                messageEl._messageData = message;
                
                // Сохраняем данные альбома
                if (message.type === 'album') {
                    messageEl._albumData = message;
                }
            }
        }, 100);
        
        return result;
    };
}

// Модифицируем renderMessagesBatched для обработки новых типов
function renderNewMessageTypes(message) {
    const type = message.type || '';
    
    if (type === 'album') {
        return renderAlbumMessage(message.album, message.id);
    }
    
    if (type === 'location') {
        return renderLocationMessage(message.location);
    }
    
    if (type === 'contact') {
        return renderContactMessage(message.contact);
    }
    
    if (type === 'poll') {
        return renderPollMessage(message.poll, message.id);
    }
    
    if (type === 'video_message') {
        return renderVideoMessage(message.video, message.thumbnail, message.duration);
    }
    
    return null;
}

// Интеграция в chat.js (добавляем в конец файла)
document.addEventListener('DOMContentLoaded', () => {
    console.log('[New Features Integration] Загружено');
    
    // Добавляем кнопку для создания опросов в меню
    const attachmentMenu = document.getElementById('attachmentMenu');
    if (attachmentMenu) {
        const pollItem = document.createElement('div');
        pollItem.className = 'attachment-item';
        pollItem.innerHTML = '<div class="icon">📊</div><div class="text">Опрос</div>';
        pollItem.onclick = showCreatePollModal;
        attachmentMenu.appendChild(pollItem);
        
        const albumItem = document.createElement('div');
        albumItem.className = 'attachment-item';
        albumItem.innerHTML = '<div class="icon">🖼️</div><div class="text">Альбом</div>';
        albumItem.onclick = showAlbumCreator;
        attachmentMenu.appendChild(albumItem);
        
        const locationItem = document.createElement('div');
        locationItem.className = 'attachment-item';
        locationItem.innerHTML = '<div class="icon">📍</div><div class="text">Геолокация</div>';
        locationItem.onclick = sendLocation;
        attachmentMenu.appendChild(locationItem);
    }
    
    // Добавляем кнопку 2FA в настройки
    const settingsMenu = document.querySelector('.menu-section');
    if (settingsMenu) {
        const twoFABtn = document.createElement('button');
        twoFABtn.className = 'sidebar-action-btn';
        twoFABtn.textContent = '🔐';
        twoFABtn.title = 'Двухэтапная проверка';
        twoFABtn.onclick = showTwoFactorSetupModal;
        twoFABtn.style.cssText = 'margin-left: 4px;';
        
        const existingBtns = settingsMenu.querySelectorAll('.sidebar-action-btn');
        if (existingBtns.length > 0) {
            existingBtns[existingBtns.length - 1].after(twoFABtn);
        }
    }
});

// Экспорт
window.renderNewMessageTypes = renderNewMessageTypes;
