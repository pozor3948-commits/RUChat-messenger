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
    currentChatId = null; 
    currentChatPartner = null;
    document.getElementById('chatWith').textContent = 'Выберите чат';
    document.getElementById('chatMembers').textContent = '';
    document.getElementById('mobileChatStatus').textContent = 'Выберите чат';
    document.getElementById('messages').innerHTML = '';
    document.getElementById('mobileBackBtn').classList.remove('active');
    if (chatRef) { 
        chatRef.off(); 
        chatRef = null; 
    }
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
    document.querySelectorAll(".contact-item, .group-item").forEach(it => {
        const n = it.querySelector(".contact-name").textContent.toLowerCase();
        it.style.display = n.includes(q.toLowerCase()) ? "flex" : "none";
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

// Функция переключения темы
function toggleTheme() {
    const body = document.body;
    const isLight = body.classList.toggle('light');
    localStorage.setItem('ruchat_theme', isLight ? 'light' : 'dark');
    showNotification("Успешно", isLight ? "Включена светлая тема" : "Включена тёмная тема", 'info');
}

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
    const savedTheme = localStorage.getItem('ruchat_theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light');
    }
});


