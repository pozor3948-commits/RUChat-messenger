/* ==========================================================
   13. АКТИВНОСТЬ / СЕТЬ / МОБИЛЬНОСТЬ
   ========================================================== */
function checkMobile() {
    // Используем глобальную переменную isMobile из utils.js
    isMobile = window.innerWidth <= 768;
    updateCallButtonVisibility();
    updateMobileMenuButton();
    if (isMobile && currentChatId) document.getElementById('mobileBackBtn').classList.add('active');
    else document.getElementById('mobileBackBtn').classList.remove('active');
}

let mobileInputFixInitialized = false;
function setupMobileInputFixes() {
    if (mobileInputFixInitialized) return;
    const textInput = document.getElementById('text');
    if (!textInput) return;
    mobileInputFixInitialized = true;

    const syncInputPaint = () => {
        if (!isMobile) return;
        const isLight = document.body.classList.contains('light');
        textInput.style.color = isLight ? '#0f172a' : '#f8fafc';
        textInput.style.webkitTextFillColor = isLight ? '#0f172a' : '#f8fafc';
        textInput.style.caretColor = '#00a3ff';
    };

    textInput.addEventListener('focus', () => {
        if (!isMobile) return;
        document.body.classList.add('keyboard-open');
        syncInputPaint();
        requestAnimationFrame(() => {
            const messages = document.getElementById('messages');
            if (messages) messages.scrollTop = messages.scrollHeight;
        });
    });

    textInput.addEventListener('blur', () => {
        document.body.classList.remove('keyboard-open');
    });

    textInput.addEventListener('input', syncInputPaint);
    textInput.addEventListener('compositionend', syncInputPaint);
    const inputContainer = document.querySelector('.message-input-container');
    if (inputContainer) {
        inputContainer.addEventListener('click', (event) => {
            if (!isMobile) return;
            if (event.target.closest('button')) return;
            if (document.activeElement !== textInput) textInput.focus();
        });
    }

    if (window.visualViewport) {
        const onViewportResize = () => {
            if (!isMobile) return;
            const keyboardHeight = window.innerHeight - window.visualViewport.height;
            const keyboardOpen = keyboardHeight > 140;
            if (document.activeElement === textInput) {
                document.body.classList.toggle('keyboard-open', keyboardOpen);
            }
        };
        window.visualViewport.addEventListener('resize', onViewportResize);
    }

    syncInputPaint();
}

function updateCallButtonVisibility() {
    const callBtn = document.getElementById('callButton');
    const mobileCallBtn = document.getElementById('mobileCallBtn');
    const shouldShow = !!username && !!currentChatPartner && !isGroupChat;
    if (callBtn) {
        callBtn.classList.toggle('active', shouldShow);
        callBtn.style.display = shouldShow ? "flex" : "none";
    }
    if (mobileCallBtn) {
        mobileCallBtn.classList.toggle('active', shouldShow);
        mobileCallBtn.style.display = shouldShow ? "flex" : "none";
    }
}

// ────────────────────────────────────────────────
//  Дополнение для мобильного поведения (как в Telegram)
// ────────────────────────────────────────────────

function openChatCommon() {
    if (!isMobile) return;

    document.body.classList.add('chat-open');

    // Прячем список чатов
    document.getElementById('sidebar').classList.add('hidden-on-mobile');

    // Показываем чат на весь экран
    document.getElementById('chatContainer').classList.add('active');

    // Показываем кнопку "назад"
    document.getElementById('mobileBackBtn').classList.add('active');

    // Обновляем заголовок мобильного хедера
    const chatTitle = document.getElementById('chatWith').textContent;
    document.getElementById('mobileChatTitle').textContent = chatTitle || 'Чат';

    // Скрываем stories (как в TG)
    document.getElementById('storiesContainer').style.display = 'none';
    updateCallButtonVisibility();
    updateMobileMenuButton();
}

function closeChatMobile() {
    if (!isMobile) return;

    document.body.classList.remove('chat-open');

    // Возвращаем список чатов
    document.getElementById('sidebar').classList.remove('hidden-on-mobile');

    // Убираем чат с экрана
    document.getElementById('chatContainer').classList.remove('active');

    // Прячем кнопку назад
    document.getElementById('mobileBackBtn').classList.remove('active');

    // Сбрасываем заголовок
    document.getElementById('mobileChatTitle').textContent = 'Чаты';
    document.getElementById('mobileChatStatus').textContent = 'Выберите чат';

    // Возвращаем stories
    document.getElementById('storiesContainer').style.display = 'block';

    // Очищаем текущий чат
    currentChatId = null;
    currentChatPartner = null;
    if (chatRef) {
        chatRef.off();
        chatRef = null;
    }
    document.getElementById('messages').innerHTML = '';
    updateCallButtonVisibility();
    const mobileAvatar = document.getElementById('mobileChatAvatar');
    if (mobileAvatar) {
        mobileAvatar.style.display = 'none';
        mobileAvatar.src = '';
    }
    const chatSettingsMenu = document.getElementById('chatSettingsMenu');
    if (chatSettingsMenu) chatSettingsMenu.classList.remove('active');
    if (typeof updateGroupManageMenuVisibility === 'function') updateGroupManageMenuVisibility();
    updateMobileMenuButton();
}

function updateMobileMenuButton() {
    const btn = document.getElementById('mobileMenuBtn');
    if (!btn) return;
    if (currentChatId) {
        btn.textContent = '☰';
        btn.dataset.mode = 'chat';
    } else {
        btn.textContent = '⚙️';
        btn.dataset.mode = 'settings';
    }
}

function handleMobileMenuButton() {
    if (currentChatId) {
        if (typeof toggleChatSettingsMenu === 'function') toggleChatSettingsMenu();
    } else {
        if (typeof showSettingsMenu === 'function') showSettingsMenu();
    }
}

window.handleMobileMenuButton = handleMobileMenuButton;
window.setupMobileInputFixes = setupMobileInputFixes;

// Переопределяем существующие функции открытия чата
const originalOpenPrivateChat = openPrivateChat;
openPrivateChat = function(fn) {
    originalOpenPrivateChat(fn);
    openChatCommon();
};

const originalOpenGroupChat = openGroupChat;
openGroupChat = function(g, gid) {
    originalOpenGroupChat(g, gid);
    openChatCommon();
};

// Переопределяем кнопку "назад"
const originalCloseChat = closeChat;
closeChat = function() {
    originalCloseChat();
    closeChatMobile();
};

// Дополнительно — при ресайзе окна
window.addEventListener('resize', () => {
    const wasMobile = isMobile;
    isMobile = window.innerWidth <= 768;

    if (wasMobile !== isMobile && currentChatId) {
        if (isMobile) {
            openChatCommon();
        } else {
            closeChatMobile();
            document.getElementById('sidebar').classList.remove('hidden-on-mobile');
            document.getElementById('chatContainer').classList.remove('active');
        }
    }

    checkMobile();
});

/* ==========================================================
   ИСПРАВЛЕНИЕ ПОЗИЦИОНИРОВАНИЯ МЕНЮ НА МОБИЛЬНЫХ
   ========================================================== */
function adjustMenuPositionForMobile() {
    // Используем глобальную переменную isMobile
    if (!isMobile) return;
    
    const menus = [
        document.getElementById('attachmentMenu'),
        document.getElementById('recordTypeMenu'),
        document.getElementById('emojiPicker'),
        document.getElementById('stickerPanel')
    ];
    
    menus.forEach(menu => {
        if (menu) {
            // Гарантируем, что меню будет поверх чата
            menu.style.zIndex = '1004';
            
            // Принудительное позиционирование
            if (menu.classList.contains('active')) {
                const inputContainer = document.querySelector('.message-input-container');
                if (inputContainer) {
                    const rect = inputContainer.getBoundingClientRect();
                    menu.style.bottom = `${rect.height + 20}px`;
                }
            }
        }
    });
}

// Вызываем при изменениях
window.addEventListener('resize', adjustMenuPositionForMobile);
document.addEventListener('DOMContentLoaded', adjustMenuPositionForMobile);

// Перехватываем открытие меню
const originalToggleAttachmentMenu = window.toggleAttachmentMenu;
window.toggleAttachmentMenu = function() {
    originalToggleAttachmentMenu();
    setTimeout(adjustMenuPositionForMobile, 50);
};

const originalToggleEmojiPicker = window.toggleEmojiPicker;
window.toggleEmojiPicker = function() {
    originalToggleEmojiPicker();
    setTimeout(adjustMenuPositionForMobile, 50);
};

if (typeof window.toggleStickerPanel === 'function') {
    const originalToggleStickerPanel = window.toggleStickerPanel;
    window.toggleStickerPanel = function() {
        originalToggleStickerPanel();
        setTimeout(adjustMenuPositionForMobile, 50);
    };
}








