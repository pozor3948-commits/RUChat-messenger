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
let mobileSwipeBackInitialized = false;
const MOBILE_SWIPE_EDGE_PX = 56;
const MOBILE_SWIPE_TRIGGER_PX = 80;
const mobileSwipeState = {
    tracking: false,
    startX: 0,
    startY: 0,
    dx: 0,
    lockedAxis: ''
};

function resetMobileSwipeState(chatContainer) {
    mobileSwipeState.tracking = false;
    mobileSwipeState.startX = 0;
    mobileSwipeState.startY = 0;
    mobileSwipeState.dx = 0;
    mobileSwipeState.lockedAxis = '';
    if (chatContainer) {
        chatContainer.classList.remove('swipe-back-active');
        chatContainer.style.removeProperty('transition');
        chatContainer.style.removeProperty('transform');
    }
}

function isSwipeBlockedTarget(target) {
    if (!target || typeof target.closest !== 'function') return false;
    return !!target.closest(
        'button, a, input, textarea, select, video, audio, .emoji-picker, .attachment-menu, .record-type-menu, .sticker-panel, .chat-settings-menu, .media-library-overlay, .group-admin-overlay'
    );
}

function setupMobileSwipeBack() {
    if (mobileSwipeBackInitialized) return;
    const chatContainer = document.getElementById('chatContainer');
    if (!chatContainer) return;
    mobileSwipeBackInitialized = true;

    chatContainer.addEventListener('touchstart', (event) => {
        if (!isMobile || !currentChatId || !chatContainer.classList.contains('active')) return;
        if (event.touches.length !== 1) return;
        if (isSwipeBlockedTarget(event.target)) return;
        const touch = event.touches[0];
        if (touch.clientX > MOBILE_SWIPE_EDGE_PX) return;

        mobileSwipeState.tracking = true;
        mobileSwipeState.startX = touch.clientX;
        mobileSwipeState.startY = touch.clientY;
        mobileSwipeState.dx = 0;
        mobileSwipeState.lockedAxis = '';
        chatContainer.classList.add('swipe-back-active');
    }, { passive: true });

    chatContainer.addEventListener('touchmove', (event) => {
        if (!mobileSwipeState.tracking) return;
        const touch = event.touches[0];
        const dx = touch.clientX - mobileSwipeState.startX;
        const dy = Math.abs(touch.clientY - mobileSwipeState.startY);

        if (!mobileSwipeState.lockedAxis) {
            if (Math.abs(dx) < 8 && dy < 8) return;
            mobileSwipeState.lockedAxis = Math.abs(dx) > dy ? 'x' : 'y';
        }

        if (mobileSwipeState.lockedAxis !== 'x') {
            mobileSwipeState.tracking = false;
            resetMobileSwipeState(chatContainer);
            return;
        }

        if (dx <= 0) return;

        mobileSwipeState.dx = Math.min(dx, window.innerWidth * 0.9);
        chatContainer.style.transition = 'none';
        chatContainer.style.transform = `translateX(${mobileSwipeState.dx}px)`;
        event.preventDefault();
    }, { passive: false });

    const finishSwipe = () => {
        if (!mobileSwipeState.tracking && mobileSwipeState.dx === 0) return;
        const distance = mobileSwipeState.dx;
        const threshold = Math.max(MOBILE_SWIPE_TRIGGER_PX, window.innerWidth * 0.24);
        chatContainer.style.transition = 'transform 0.18s cubic-bezier(.22,.61,.36,1)';

        if (distance >= threshold && currentChatId && isMobile) {
            chatContainer.style.transform = 'translateX(100%)';
            setTimeout(() => {
                resetMobileSwipeState(chatContainer);
                closeChat();
            }, 180);
            return;
        }

        chatContainer.style.transform = 'translateX(0)';
        setTimeout(() => resetMobileSwipeState(chatContainer), 180);
    };

    chatContainer.addEventListener('touchend', finishSwipe, { passive: true });
    chatContainer.addEventListener('touchcancel', finishSwipe, { passive: true });
}

function setupMobileInputFixes() {
    if (mobileInputFixInitialized) return;
    const textInput = document.getElementById('text');
    if (!textInput) return;
    mobileInputFixInitialized = true;

    textInput.addEventListener('focus', () => {
        if (!isMobile) return;
        document.body.classList.add('keyboard-open');
        requestAnimationFrame(() => {
            const messages = document.getElementById('messages');
            if (messages) messages.scrollTop = messages.scrollHeight;
        });
    });

    textInput.addEventListener('blur', () => {
        document.body.classList.remove('keyboard-open');
    });
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
    const chatContainer = document.getElementById('chatContainer');
    chatContainer.classList.add('active');
    resetMobileSwipeState(chatContainer);

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
    const chatContainer = document.getElementById('chatContainer');
    resetMobileSwipeState(chatContainer);

    // Возвращаем список чатов
    document.getElementById('sidebar').classList.remove('hidden-on-mobile');

    // Убираем чат с экрана
    chatContainer.classList.remove('active');

    // Прячем кнопку назад
    document.getElementById('mobileBackBtn').classList.remove('active');

    // Сбрасываем заголовок
    document.getElementById('mobileChatTitle').textContent = 'Чаты';
    document.getElementById('mobileChatStatus').textContent = 'Выберите чат';
    const chatAvatar = document.getElementById('chatAvatar');
    if (chatAvatar) chatAvatar.style.display = 'none';

    // Возвращаем stories
    document.getElementById('storiesContainer').style.display = 'block';

    // Очищаем текущий чат
    currentChatId = null;
    currentChatPartner = null;
    if (typeof clearCurrentChatStatusListener === 'function') clearCurrentChatStatusListener();
    if (typeof detachMessagesScrollListener === 'function') detachMessagesScrollListener();
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
document.addEventListener('DOMContentLoaded', () => {
    adjustMenuPositionForMobile();
    setupMobileSwipeBack();
});

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




