/* ==========================================================
   13. АКТИВНОСТЬ / СЕТЬ / МОБИЛЬНОСТЬ
   ========================================================== */

// Инициализируем глобальные переменные
if (typeof isMobile === 'undefined') {
    isMobile = window.innerWidth <= 768;
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('active');
}

function closeChat() {
    if (!isMobile) return;
    if (typeof clearCurrentChatStatusListener === 'function') clearCurrentChatStatusListener();
    if (typeof detachMessagesScrollListener === 'function') detachMessagesScrollListener();
    currentChatId = null; 
    currentChatPartner = null;
    document.getElementById('chatWith').textContent = 'Выберите чат';
    const chatAvatar = document.getElementById('chatAvatar');
    if (chatAvatar) chatAvatar.style.display = 'none';
    document.getElementById('chatMembers').textContent = '';
    document.getElementById('mobileChatStatus').textContent = 'Выберите чат';
    document.getElementById('messages').innerHTML = '';
    document.getElementById('mobileBackBtn').classList.remove('active');
    if (chatRef) { 
        chatRef.off(); 
        chatRef = null; 
    }
    if (typeof updateGroupManageMenuVisibility === 'function') updateGroupManageMenuVisibility();
    clearMessageSearch();
}

function updateSendButton() {
    const ti = document.getElementById("text");
    const btn = document.getElementById("sendBtn");
    if (ti.value.trim()) {
        btn.classList.add("active");
    } else {
        btn.classList.remove("active");
    }
}

function handleKeyPress(e) {
    if (e.key === "Enter" && !e.shiftKey) { 
        e.preventDefault(); 
        sendMessage(); 
    }
    updateSendButton();
}

function searchChats(q) {
    const needle = (q || '').toLowerCase();
    document.querySelectorAll(".contact-item, .group-item, .request-item.chat-request-item").forEach(it => {
        const titleEl = it.querySelector(".contact-name, .request-name");
        const title = titleEl ? titleEl.textContent.toLowerCase() : '';
        it.style.display = title.includes(needle) ? "flex" : "none";
    });
}

function toggleMessageSearch() {
    const box = document.getElementById('chatSearch');
    if (!box) return;
    box.classList.toggle('active');
    if (box.classList.contains('active')) {
        const input = document.getElementById('chatSearchInput');
        if (input) input.focus();
    } else {
        clearMessageSearch();
    }
}

function toggleChatSettingsMenu() {
    const menu = document.getElementById('chatSettingsMenu');
    if (!menu) return;
    if (typeof updateGroupManageMenuVisibility === 'function') updateGroupManageMenuVisibility();
    const isActive = menu.classList.contains('active');
    if (isActive) menu.classList.remove('active');
    else menu.classList.add('active');
}

window.toggleChatSettingsMenu = toggleChatSettingsMenu;

function clearMessageSearch() {
    const input = document.getElementById('chatSearchInput');
    if (input) input.value = '';
    document.querySelectorAll('.message-text').forEach(el => {
        if (el.dataset.rawText) {
            el.textContent = el.dataset.rawText;
            delete el.dataset.rawText;
        }
    });
    const count = document.getElementById('chatSearchCount');
    if (count) count.textContent = '';
}

function searchMessages(query) {
    const q = (query || '').trim().toLowerCase();
    let found = 0;
    document.querySelectorAll('.message-text').forEach(el => {
        const raw = el.dataset.rawText || el.textContent;
        if (!el.dataset.rawText) el.dataset.rawText = raw;
        if (!q) {
            el.textContent = raw;
            return;
        }
        const idx = raw.toLowerCase().indexOf(q);
        if (idx === -1) {
            el.textContent = raw;
            return;
        }
        found++;
        const before = escapeHtml(raw.slice(0, idx));
        const match = escapeHtml(raw.slice(idx, idx + q.length));
        const after = escapeHtml(raw.slice(idx + q.length));
        el.innerHTML = `${before}<mark class="message-highlight">${match}</mark>${after}`;
    });
    const count = document.getElementById('chatSearchCount');
    if (count) count.textContent = found ? String(found) : '';
}

// Функция показа/скрытия эмодзи-пикера
function toggleEmojiPicker() {
    const picker = document.getElementById("emojiPicker");
    const isActive = picker.classList.contains("active");
    
    // Скрываем другие меню
    document.getElementById("attachmentMenu").classList.remove("active");
    document.getElementById("recordTypeMenu").classList.remove("active");
    const stickerPanel = document.getElementById("stickerPanel");
    if (stickerPanel) stickerPanel.classList.remove("active");
    
    // Переключаем эмодзи-пикер
    if (isActive) {
        picker.classList.remove("active");
    } else {
        picker.classList.add("active");
        
        // Позиционируем на мобильных
        if (isMobile) {
            positionEmojiPickerForMobile();
        }
    }
}

// Функция показа/скрытия меню прикрепления
function toggleAttachmentMenu() {
    const menu = document.getElementById("attachmentMenu");
    const isActive = menu.classList.contains("active");
    
    // Скрываем другие меню
    document.getElementById("emojiPicker").classList.remove("active");
    document.getElementById("recordTypeMenu").classList.remove("active");
    const stickerPanel = document.getElementById("stickerPanel");
    if (stickerPanel) stickerPanel.classList.remove("active");
    
    // Переключаем меню прикрепления
    if (isActive) {
        menu.classList.remove("active");
    } else {
        menu.classList.add("active");
        
        // Позиционируем на мобильных
        if (isMobile) {
            positionAttachmentMenuForMobile();
        }
    }
}

// Функция показа меню выбора типа записи
function showRecordTypeMenu() {
    const menu = document.getElementById("recordTypeMenu");
    const isActive = menu.classList.contains("active");
    
    // Скрываем другие меню
    document.getElementById("attachmentMenu").classList.remove("active");
    document.getElementById("emojiPicker").classList.remove("active");
    const stickerPanel = document.getElementById("stickerPanel");
    if (stickerPanel) stickerPanel.classList.remove("active");
    
    // Переключаем меню выбора типа записи
    if (isActive) {
        menu.classList.remove("active");
    } else {
        menu.classList.add("active");
        
        // Позиционируем на мобильных
        if (isMobile) {
            positionRecordTypeMenuForMobile();
        }
    }
}

// Позиционирование эмодзи-пикера на мобильных
function positionEmojiPickerForMobile() {
    const picker = document.getElementById("emojiPicker");
    const inputContainer = document.querySelector('.message-input-container');
    
    if (!picker || !inputContainer) return;
    
    const inputRect = inputContainer.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    
    // Размещаем над полем ввода
    picker.style.bottom = `${viewportHeight - inputRect.top + 10}px`;
    picker.style.left = '10px';
    picker.style.right = '10px';
    picker.style.width = 'calc(100% - 20px)';
}

// Позиционирование меню прикрепления на мобильных
function positionAttachmentMenuForMobile() {
    const menu = document.getElementById("attachmentMenu");
    const attachmentBtn = document.querySelector('.attachment-btn');
    
    if (!menu || !attachmentBtn) return;
    
    const btnRect = attachmentBtn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    // Размещаем рядом с кнопкой
    if (btnRect.left < viewportWidth / 2) {
        // Слева
        menu.style.left = '10px';
        menu.style.right = 'auto';
    } else {
        // Справа
        menu.style.left = 'auto';
        menu.style.right = '10px';
    }
    
    menu.style.bottom = '85px';
}

// Позиционирование меню выбора типа записи на мобильных
function positionRecordTypeMenuForMobile() {
    const menu = document.getElementById("recordTypeMenu");
    const recordBtn = document.querySelector('.icon-btn[onclick*="showRecordTypeMenu"]');
    
    if (!menu || !recordBtn) return;
    
    const btnRect = recordBtn.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    // Размещаем рядом с кнопкой
    if (btnRect.left < viewportWidth / 2) {
        // Слева
        menu.style.left = '10px';
        menu.style.right = 'auto';
    } else {
        // Справа
        menu.style.left = 'auto';
        menu.style.right = '10px';
    }
    
    menu.style.bottom = '85px';
}

// Функция для голосового звонка
function startVoiceCall() {
    if (!currentChatId) {
        showError("Выберите чат для звонка!");
        return;
    }
    if (typeof startAudioCall === "function") {
        startAudioCall();
    } else {
        showError("Модуль звонков не загружен");
    }
}

// Темы интерфейса
const THEME_ORDER = ['dark', 'auto', 'blue', 'pink', 'black', 'green', 'purple', 'snow'];
const THEME_CLASS_MAP = {
    dark: '',
    auto: 'theme-auto',
    blue: 'theme-blue',
    pink: 'theme-pink',
    black: 'theme-black',
    green: 'theme-green',
    purple: 'theme-purple',
    snow: 'theme-snow'
};
const THEME_LABELS = {
    dark: 'тёмная',
    auto: 'автоматическая',
    blue: 'голубая',
    pink: 'розовая',
    black: 'чёрная',
    green: 'зелёная',
    purple: 'фиолетовая',
    snow: 'снежная'
};

// Автоматическая тема в зависимости от времени суток
function getAutoThemeClass() {
    const hour = new Date().getHours();
    // Утро (6-12) - солнечный жёлтый
    if (hour >= 6 && hour < 12) {
        return 'theme-auto-morning';
    }
    // День (12-17) - голубой
    if (hour >= 12 && hour < 17) {
        return 'theme-auto-day';
    }
    // Закат (17-21) - оранжевый
    if (hour >= 17 && hour < 21) {
        return 'theme-auto-sunset';
    }
    // Ночь (21-6) - тёмный
    return 'theme-auto-night';
}

function normalizeThemeName(value) {
    const theme = String(value || '').trim().toLowerCase();
    return THEME_ORDER.includes(theme) ? theme : 'dark';
}

function applyThemeClasses(themeName) {
    const body = document.body;
    if (!body) return;
    Object.values(THEME_CLASS_MAP).forEach(cls => {
        if (cls) body.classList.remove(cls);
    });
    // Удаляем классы авто-темы
    body.classList.remove('theme-auto-morning', 'theme-auto-day', 'theme-auto-sunset', 'theme-auto-night');
    
    const cls = THEME_CLASS_MAP[themeName];
    if (cls) body.classList.add(cls);
    
    // Если авто-тема, добавляем класс в зависимости от времени суток
    if (themeName === 'auto') {
        const autoClass = getAutoThemeClass();
        body.classList.add(autoClass);
    }
    
    // Если снежная тема, запускаем анимацию снежинок
    if (themeName === 'snow') {
        startSnowflakes();
    } else {
        stopSnowflakes();
    }
}

function getCurrentTheme() {
    return normalizeThemeName(localStorage.getItem('ruchat_theme') || 'dark');
}

function setTheme(themeName, options = {}) {
    const safeTheme = normalizeThemeName(themeName);
    applyThemeClasses(safeTheme);
    localStorage.setItem('ruchat_theme', safeTheme);

    if (!options || options.silent !== true) {
        const label = THEME_LABELS[safeTheme] || safeTheme;
        showNotification('Тема', `Включена ${label} тема`, 'info');
    }

    return safeTheme;
}

// Быстрое переключение тем (кнопка в шапке)
function toggleTheme() {
    const current = getCurrentTheme();
    const currentIndex = THEME_ORDER.indexOf(current);
    const nextTheme = THEME_ORDER[(currentIndex + 1) % THEME_ORDER.length];
    setTheme(nextTheme);
}

window.getCurrentTheme = getCurrentTheme;
window.setTheme = setTheme;

// Функция показа информации о чате
function showChatInfo() {
    if (isGroupChat && currentChatId) {
        db.ref("groups/" + currentChatId).once("value").then(s => {
            if (s.exists()) {
                const g = s.val();
                const groupName = typeof normalizeText === 'function' ? normalizeText(g.name) : g.name;
                const createdBy = typeof normalizeText === 'function' ? normalizeText(g.createdBy) : g.createdBy;
                const memberCount = Object.keys(g.members || {}).length;
                const info = `
Информация о группе:
─────────────────
Название: ${groupName}
Участников: ${memberCount}
Создана: ${new Date(g.createdAt).toLocaleDateString()}
Создатель: ${createdBy}
                `;
                alert(info);
            }
        });
    } else if (currentChatPartner) {
        const status = userStatuses[currentChatPartner];
        let statusText = "Был(а) недавно";
        if (status) {
            if (status.online) {
                statusText = status.idle ? "Неактивен" : "В сети";
            } else if (status.lastSeen) {
                statusText = "Был(а) " + new Date(status.lastSeen).toLocaleString();
            }
        }
        db.ref("accounts/" + currentChatPartner).get().then(s => {
            const data = s.exists() ? (s.val() || {}) : {};
            const displayName = typeof normalizeText === 'function' ? normalizeText(data.displayName || currentChatPartner) : (data.displayName || currentChatPartner);
            const about = typeof normalizeText === 'function' ? normalizeText(data.about || '') : (data.about || '');
            const info = `
Информация о пользователе:
────────────────────────
Имя: ${displayName}
Логин: ${currentChatPartner}
О себе: ${about || '—'}
Статус: ${statusText}
            `;
            alert(info);
        });
    } else {
        showError("Выберите чат для просмотра информации");
    }
}

// Загружаем сохраненную тему при загрузке
document.addEventListener('DOMContentLoaded', function() {
    setTheme(localStorage.getItem('ruchat_theme') || 'dark', { silent: true });
    
    // Обновляем автоматическую тему каждый час
    setInterval(() => {
        const currentTheme = getCurrentTheme();
        if (currentTheme === 'auto') {
            const body = document.body;
            if (!body) return;
            // Удаляем все классы авто-темы
            body.classList.remove('theme-auto-morning', 'theme-auto-day', 'theme-auto-sunset', 'theme-auto-night');
            // Добавляем новый класс в зависимости от времени
            const autoClass = getAutoThemeClass();
            body.classList.add(autoClass);
        }
    }, 60000); // Проверяем каждый час
});

// ==========================================================
// СНЕЖИНКИ (тема "snow")
// ==========================================================
let snowflakesInterval = null;

function createSnowflake() {
    const snowflake = document.createElement('div');
    snowflake.className = 'snowflake';
    snowflake.style.left = Math.random() * 100 + 'vw';
    snowflake.style.animationDuration = (Math.random() * 3 + 5) + 's';
    snowflake.style.opacity = Math.random() * 0.7 + 0.3;
    snowflake.style.fontSize = (Math.random() * 10 + 10) + 'px';
    document.getElementById('snowflakes-container')?.appendChild(snowflake);
    
    // Удаляем снежинку после окончания анимации
    setTimeout(() => {
        snowflake.remove();
    }, 8000);
}

function startSnowflakes() {
    let container = document.getElementById('snowflakes-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'snowflakes-container';
        document.body.appendChild(container);
    }
    
    // Создаём снежинки
    createSnowflake();
    snowflakesInterval = setInterval(createSnowflake, 200);
}

function stopSnowflakes() {
    if (snowflakesInterval) {
        clearInterval(snowflakesInterval);
        snowflakesInterval = null;
    }
    const container = document.getElementById('snowflakes-container');
    if (container) {
        container.innerHTML = '';
    }
}

// Экспортируем функции глобально для использования в settings.js
window.startSnowflakes = startSnowflakes;
window.stopSnowflakes = stopSnowflakes;
window.getAutoThemeClass = getAutoThemeClass;
