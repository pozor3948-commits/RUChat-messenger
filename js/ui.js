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
const THEME_ORDER = ['dark', 'auto', 'blue', 'pink', 'black', 'green', 'purple', 'snow', 'rain', 'leaves', 'birds'];
const THEME_CLASS_MAP = {
    dark: '',
    auto: 'theme-auto',
    blue: 'theme-blue',
    pink: 'theme-pink',
    black: 'theme-black',
    green: 'theme-green',
    purple: 'theme-purple',
    snow: 'theme-snow',
    rain: 'theme-rain',
    leaves: 'theme-leaves',
    birds: 'theme-birds'
};
const THEME_LABELS = {
    dark: 'тёмная',
    auto: 'автоматическая',
    blue: 'голубая',
    pink: 'розовая',
    black: 'чёрная',
    green: 'зелёная',
    purple: 'фиолетовая',
    snow: 'снежная',
    rain: 'дождливая',
    leaves: 'осенняя',
    birds: 'небесная'
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

    // Если дождливая тема, запускаем анимацию дождя
    if (themeName === 'rain') {
        startRaindrops();
    } else {
        stopRaindrops();
    }

    // Если осенняя тема, запускаем анимацию листьев
    if (themeName === 'leaves') {
        startLeaves();
    } else {
        stopLeaves();
    }

    // Если небесная тема, запускаем анимацию птичек
    if (themeName === 'birds') {
        startBirds();
    } else {
        stopBirds();
    }
    
    // Дополнительная очистка - удаляем все контейнеры анимаций если они пустые
    ['snowflakes', 'raindrops', 'leaves', 'birds'].forEach(name => {
        const container = document.getElementById(`${name}-container`);
        if (container && !container.hasChildNodes()) {
            container.remove();
        }
    });
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
    const size = Math.random() * 4 + 2; // 2-6px
    snowflake.style.width = size + 'px';
    snowflake.style.height = size + 'px';

    // Снежинки всегда белые
    snowflake.style.background = 'white';
    snowflake.style.textShadow = '0 0 5px rgba(255, 255, 255, 0.8)';

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
    snowflakesInterval = setInterval(createSnowflake, 100);
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

// ==========================================================
// ДОЖДЬ (тема "rain")
// ==========================================================
let raindropsInterval = null;

function createRaindrop() {
    const raindrop = document.createElement('div');
    raindrop.className = 'raindrop';
    raindrop.style.left = Math.random() * 100 + 'vw';
    raindrop.style.animationDuration = (Math.random() * 0.5 + 0.5) + 's';
    raindrop.style.opacity = Math.random() * 0.5 + 0.3;

    document.getElementById('raindrops-container')?.appendChild(raindrop);

    // Удаляем каплю после окончания анимации
    setTimeout(() => {
        raindrop.remove();
    }, 1500);
}

function startRaindrops() {
    let container = document.getElementById('raindrops-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'raindrops-container';
        document.body.appendChild(container);
    }

    // Создаём капли
    for (let i = 0; i < 30; i++) {
        createRaindrop();
    }
    raindropsInterval = setInterval(createRaindrop, 50);
}

function stopRaindrops() {
    if (raindropsInterval) {
        clearInterval(raindropsInterval);
        raindropsInterval = null;
    }
    const container = document.getElementById('raindrops-container');
    if (container) {
        container.innerHTML = '';
    }
}

// ==========================================================
// ЛИСТЬЯ (тема "leaves")
// ==========================================================
let leavesInterval = null;

function createLeaf() {
    const leaf = document.createElement('div');
    leaf.className = 'falling-leaf';
    leaf.style.left = Math.random() * 100 + 'vw';
    leaf.style.animationDuration = (Math.random() * 5 + 8) + 's';

    document.getElementById('leaves-container')?.appendChild(leaf);

    // Удаляем лист после окончания анимации
    setTimeout(() => {
        leaf.remove();
    }, 13000);
}

function startLeaves() {
    let container = document.getElementById('leaves-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'leaves-container';
        document.body.appendChild(container);
    }

    // Создаём листья
    createLeaf();
    leavesInterval = setInterval(createLeaf, 800);
}

function stopLeaves() {
    if (leavesInterval) {
        clearInterval(leavesInterval);
        leavesInterval = null;
    }
    const container = document.getElementById('leaves-container');
    if (container) {
        container.innerHTML = '';
    }
}

// ==========================================================
// ПТИЧКИ (тема "birds")
// ==========================================================
let birdsInterval = null;

function createBird() {
    const bird = document.createElement('div');
    bird.className = 'flying-bird';
    
    // Птички летят слева направо или справа налево
    const fromLeft = Math.random() > 0.5;
    bird.style.left = fromLeft ? '-60px' : 'calc(100% + 60px)';
    bird.style.top = (Math.random() * 40 + 10) + 'vh';
    
    // Создаём изображение птички
    const birdImg = document.createElement('img');
    birdImg.className = 'flying-bird-img';
    birdImg.src = 'assets/bird.png';
    birdImg.alt = 'bird';
    birdImg.draggable = false;

    // Если изображение не загрузится, используем запасной вариант
    birdImg.onerror = function() {
        // Запасной вариант - emoji птички
        this.style.display = 'none';
        bird.style.fontSize = '40px';
        bird.textContent = '🕊️';
    };
    
    bird.appendChild(birdImg);
    
    // Направление полёта - если справа налево, отражаем
    if (!fromLeft) {
        birdImg.style.transform = 'scaleX(-1)';
    }
    
    bird.style.animationDuration = (Math.random() * 5 + 10) + 's';
    
    document.getElementById('birds-container')?.appendChild(bird);

    // Удаляем птичку после окончания анимации
    setTimeout(() => {
        bird.remove();
    }, 15000);
}

function startBirds() {
    let container = document.getElementById('birds-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'birds-container';
        document.body.appendChild(container);
    }

    // Создаём птичек
    createBird();
    birdsInterval = setInterval(createBird, 3000);
}

function stopBirds() {
    if (birdsInterval) {
        clearInterval(birdsInterval);
        birdsInterval = null;
    }
    const container = document.getElementById('birds-container');
    if (container) {
        container.innerHTML = '';
    }
}

// Экспортируем новые функции глобально
window.startRaindrops = startRaindrops;
window.stopRaindrops = stopRaindrops;
window.startLeaves = startLeaves;
window.stopLeaves = stopLeaves;
window.startBirds = startBirds;
window.stopBirds = stopBirds;

// Функции для применения фона в зависимости от цвета
function applyRainBackground(color) {
    let bgImage = '';
    if (color === 'blue') {
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='rainStreak' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2338bdf8' stop-opacity='0.4'/%3E%3Cstop offset='100%25' stop-color='%2338bdf8' stop-opacity='0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='%230f172a' width='1920' height='1080'/%3E%3Crect fill='url(%23rainStreak)' x='200' y='0' width='1' height='150'/%3E%3Crect fill='url(%23rainStreak)' x='400' y='100' width='1' height='180'/%3E%3Crect fill='url(%23rainStreak)' x='600' y='50' width='1' height='160'/%3E%3Crect fill='url(%23rainStreak)' x='800' y='80' width='1' height='170'/%3E%3Crect fill='url(%23rainStreak)' x='1000' y='30' width='1' height='150'/%3E%3Crect fill='url(%23rainStreak)' x='1200' y='120' width='1' height='180'/%3E%3Crect fill='url(%23rainStreak)' x='1400' y='60' width='1' height='160'/%3E%3Crect fill='url(%23rainStreak)' x='1600' y='90' width='1' height='170'/%3E%3C/svg%3E\")";
    } else if (color === 'green') {
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='rainStreakGreen' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2334d399' stop-opacity='0.4'/%3E%3Cstop offset='100%25' stop-color='%2334d399' stop-opacity='0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='%230f172a' width='1920' height='1080'/%3E%3Crect fill='url(%23rainStreakGreen)' x='200' y='0' width='1' height='150'/%3E%3Crect fill='url(%23rainStreakGreen)' x='400' y='100' width='1' height='180'/%3E%3Crect fill='url(%23rainStreakGreen)' x='600' y='50' width='1' height='160'/%3E%3Crect fill='url(%23rainStreakGreen)' x='800' y='80' width='1' height='170'/%3E%3Crect fill='url(%23rainStreakGreen)' x='1000' y='30' width='1' height='150'/%3E%3Crect fill='url(%23rainStreakGreen)' x='1200' y='120' width='1' height='180'/%3E%3Crect fill='url(%23rainStreakGreen)' x='1400' y='60' width='1' height='160'/%3E%3Crect fill='url(%23rainStreakGreen)' x='1600' y='90' width='1' height='170'/%3E%3C/svg%3E\")";
    } else if (color === 'purple') {
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='rainStreakPurple' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23c084fc' stop-opacity='0.4'/%3E%3Cstop offset='100%25' stop-color='%23c084fc' stop-opacity='0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='%230f172a' width='1920' height='1080'/%3E%3Crect fill='url(%23rainStreakPurple)' x='200' y='0' width='1' height='150'/%3E%3Crect fill='url(%23rainStreakPurple)' x='400' y='100' width='1' height='180'/%3E%3Crect fill='url(%23rainStreakPurple)' x='600' y='50' width='1' height='160'/%3E%3Crect fill='url(%23rainStreakPurple)' x='800' y='80' width='1' height='170'/%3E%3Crect fill='url(%23rainStreakPurple)' x='1000' y='30' width='1' height='150'/%3E%3Crect fill='url(%23rainStreakPurple)' x='1200' y='120' width='1' height='180'/%3E%3Crect fill='url(%23rainStreakPurple)' x='1400' y='60' width='1' height='160'/%3E%3Crect fill='url(%23rainStreakPurple)' x='1600' y='90' width='1' height='170'/%3E%3C/svg%3E\")";
    } else {
        // default
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='rainStreakDefault' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%2394a3b8' stop-opacity='0.3'/%3E%3Cstop offset='100%25' stop-color='%2394a3b8' stop-opacity='0'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='%230f172a' width='1920' height='1080'/%3E%3Crect fill='url(%23rainStreakDefault)' x='200' y='0' width='1' height='150'/%3E%3Crect fill='url(%23rainStreakDefault)' x='400' y='100' width='1' height='180'/%3E%3Crect fill='url(%23rainStreakDefault)' x='600' y='50' width='1' height='160'/%3E%3Crect fill='url(%23rainStreakDefault)' x='800' y='80' width='1' height='170'/%3E%3Crect fill='url(%23rainStreakDefault)' x='1000' y='30' width='1' height='150'/%3E%3Crect fill='url(%23rainStreakDefault)' x='1200' y='120' width='1' height='180'/%3E%3Crect fill='url(%23rainStreakDefault)' x='1400' y='60' width='1' height='160'/%3E%3Crect fill='url(%23rainStreakDefault)' x='1600' y='90' width='1' height='170'/%3E%3C/svg%3E\")";
    }
    document.body.style.backgroundImage = bgImage;
}

function applySnowBackground(color) {
    let bgImage = '';
    if (color === 'blue') {
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3CradialGradient id='snowGlowBlue' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%237dd3fc' stop-opacity='0.4'/%3E%3Cstop offset='100%25' stop-color='%237dd3fc' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect fill='%231e3a5f' width='1920' height='1080'/%3E%3Ccircle fill='url(%23snowGlowBlue)' cx='300' cy='200' r='400'/%3E%3Ccircle fill='url(%23snowGlowBlue)' cx='1600' cy='800' r='500'/%3E%3C/svg%3E\")";
    } else if (color === 'pink') {
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3CradialGradient id='snowGlowPink' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%23f9a8d4' stop-opacity='0.4'/%3E%3Cstop offset='100%25' stop-color='%23f9a8d4' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect fill='%231e3a5f' width='1920' height='1080'/%3E%3Ccircle fill='url(%23snowGlowPink)' cx='300' cy='200' r='400'/%3E%3Ccircle fill='url(%23snowGlowPink)' cx='1600' cy='800' r='500'/%3E%3C/svg%3E\")";
    } else {
        // default
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3CradialGradient id='snowGlowDefault' cx='50%25' cy='50%25' r='50%25'%3E%3Cstop offset='0%25' stop-color='%237dd3fc' stop-opacity='0.3'/%3E%3Cstop offset='100%25' stop-color='%237dd3fc' stop-opacity='0'/%3E%3C/radialGradient%3E%3C/defs%3E%3Crect fill='%231e3a5f' width='1920' height='1080'/%3E%3Ccircle fill='url(%23snowGlowDefault)' cx='300' cy='200' r='400'/%3E%3Ccircle fill='url(%23snowGlowDefault)' cx='1600' cy='800' r='500'/%3E%3C/svg%3E\")";
    }
    document.body.style.backgroundImage = bgImage;
}

function applyBirdsBackground(color) {
    let bgImage = '';
    if (color === 'sunset') {
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='skySunset' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23fdba74'/%3E%3Cstop offset='50%25' stop-color='%23fb923c'/%3E%3Cstop offset='100%25' stop-color='%23f97316'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23skySunset)' width='1920' height='1080'/%3E%3C/svg%3E\")";
    } else if (color === 'dawn') {
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='skyDawn' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23fb92eb'/%3E%3Cstop offset='50%25' stop-color='%23f472b6'/%3E%3Cstop offset='100%25' stop-color='%23ec4899'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23skyDawn)' width='1920' height='1080'/%3E%3C/svg%3E\")";
    } else if (color === 'blue') {
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='skyBlue' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230ea5e9'/%3E%3Cstop offset='50%25' stop-color='%2338bdf8'/%3E%3Cstop offset='100%25' stop-color='%237dd3fc'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23skyBlue)' width='1920' height='1080'/%3E%3C/svg%3E\")";
    } else {
        // default
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='skyDefault' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%230ea5e9'/%3E%3Cstop offset='50%25' stop-color='%2338bdf8'/%3E%3Cstop offset='100%25' stop-color='%237dd3fc'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23skyDefault)' width='1920' height='1080'/%3E%3C/svg%3E\")";
    }
    document.body.style.backgroundImage = bgImage;
}

function applyLeavesBackground(color) {
    let bgImage = '';
    if (color === 'autumn') {
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='autumnBg' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%237c2d12'/%3E%3Cstop offset='50%25' stop-color='%239a3412'/%3E%3Cstop offset='100%25' stop-color='%23c2410c'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23autumnBg)' width='1920' height='1080'/%3E%3C/svg%3E\")";
    } else if (color === 'gold') {
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='goldBg' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23713f12'/%3E%3Cstop offset='50%25' stop-color='%23854d0e'/%3E%3Cstop offset='100%25' stop-color='%23a16207'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23goldBg)' width='1920' height='1080'/%3E%3C/svg%3E\")";
    } else if (color === 'orange') {
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='orangeBg' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%237c2d12'/%3E%3Cstop offset='50%25' stop-color='%239a3412'/%3E%3Cstop offset='100%25' stop-color='%23c2410c'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23orangeBg)' width='1920' height='1080'/%3E%3C/svg%3E\")";
    } else {
        // default
        bgImage = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1920 1080'%3E%3Cdefs%3E%3ClinearGradient id='defaultBg' x1='0%25' y1='0%25' x2='0%25' y2='100%25'%3E%3Cstop offset='0%25' stop-color='%23451a03'/%3E%3Cstop offset='50%25' stop-color='%2378350f'/%3E%3Cstop offset='100%25' stop-color='%2392400e'/%3E%3C/linearGradient%3E%3C/defs%3E%3Crect fill='url(%23defaultBg)' width='1920' height='1080'/%3E%3C/svg%3E\")";
    }
    document.body.style.backgroundImage = bgImage;
}

// Экспортируем функции для применения фона
window.applyRainBackground = applyRainBackground;
window.applySnowBackground = applySnowBackground;
window.applyBirdsBackground = applyBirdsBackground;
window.applyLeavesBackground = applyLeavesBackground;
