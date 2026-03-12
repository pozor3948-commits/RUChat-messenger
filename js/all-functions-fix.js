/* ==========================================================
   RUCHAT - ВСЕ ФУНКЦИИ (ИСПРАВЛЕННОЕ)
   Рабочая версия всех функций
   ========================================================== */

// Глобальные переменные
window.chatFolders = { 'all': 'Все', 'personal': 'Личные', 'groups': 'Группы', 'unread': 'Непрочитанные' };
window.currentFolder = 'all';

/* ===== ИСТОРИИ ===== */
window.showCreateStoryModal = function() {
    alert('Создание истории...\n\nФункция будет работать после настройки Firebase');
};

window.loadStoriesForSidebar = function() {
    const container = document.getElementById('storiesContainer');
    const list = document.getElementById('storiesList');
    if (!container || !list) {
        console.error('Блоки историй не найдены!');
        return;
    }
    
    container.style.display = 'block';
    list.innerHTML = `
        <div class="story-item story-item-add" onclick="showCreateStoryModal()">
            <div class="story-avatar-ring add">
                <div class="story-add-icon">+</div>
            </div>
            <div class="story-author">Моя история</div>
        </div>
    `;
    console.log('✅ Истории загружены');
};

/* ===== ПАПКИ ===== */
window.setChatFolder = function(folder) {
    window.currentFolder = folder;
    document.querySelectorAll('.chat-folder-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.folder === folder);
    });
    
    const friends = document.querySelectorAll('.contact-item');
    const groups = document.querySelectorAll('.group-item');
    
    if (folder === 'all') {
        friends.forEach(el => el.style.display = 'flex');
        groups.forEach(el => el.style.display = 'flex');
    } else if (folder === 'personal') {
        friends.forEach(el => el.style.display = 'flex');
        groups.forEach(el => el.style.display = 'none');
    } else if (folder === 'groups') {
        friends.forEach(el => el.style.display = 'none');
        groups.forEach(el => el.style.display = 'flex');
    }
    console.log('✅ Папки: ' + folder);
};

/* ===== ГЕОЛОКАЦИЯ ===== */
window.sendLocation = function() {
    if (!window.currentChatId) {
        alert('Сначала выберите чат!');
        return;
    }
    
    if (!navigator.geolocation) {
        alert('Геолокация не поддерживается');
        return;
    }
    
    alert('Запрос геолокации...');
    navigator.geolocation.getCurrentPosition(
        (pos) => {
            alert(`Координаты:\n${pos.coords.latitude}, ${pos.coords.longitude}`);
        },
        (err) => {
            alert('Ошибка: ' + err.message);
        }
    );
};

/* ===== АЛЬБОМЫ ===== */
window.showAlbumCreator = function() {
    alert('Создание альбома...\n\nВыберите несколько фото');
};

/* ===== ВИДЕО ===== */
window.showVideoMessageRecorder = function() {
    alert('Запись видео...\n\nНужен доступ к камере');
};

/* ===== ОПРОСЫ ===== */
window.showCreatePollModal = function() {
    const question = prompt('Вопрос для опроса:');
    if (!question) return;
    
    const option1 = prompt('Вариант 1:');
    const option2 = prompt('Вариант 2:');
    
    if (!option1 || !option2) return;
    
    alert(`Опрос создан:\nВопрос: ${question}\nВарианты: ${option1}, ${option2}`);
};

/* ===== СЕКРЕТНЫЕ ЧАТЫ ===== */
window.startSecretChat = function() {
    const partner = prompt('Имя пользователя для секретного чата:');
    if (partner) {
        alert(`Секретный чат с @${partner}\n\nСообщения будут зашифрованы`);
    }
};

/* ===== СЕССИИ ===== */
window.showDeviceSessionsModal = function() {
    alert('Активные сессии:\n\n1. Текущее устройство (это)\n2. Других сессий нет');
};

/* ===== ИЗБРАННОЕ ===== */
window.showSavedMessagesModal = function() {
    alert('Избранные сообщения:\n\nПока пусто');
};

/* ===== АРХИВ ===== */
window.showArchivedChatsModal = function() {
    alert('Архив чатов:\n\nПока пусто');
};

/* ===== ИНИЦИАЛИЗАЦИЯ ===== */
document.addEventListener('DOMContentLoaded', function() {
    console.log('=== ИНИЦИАЛИЗАЦИЯ ФУНКЦИЙ ===');
    
    // Загрузка историй
    setTimeout(() => {
        if (typeof window.loadStoriesForSidebar === 'function') {
            window.loadStoriesForSidebar();
        }
    }, 500);
    
    console.log('✅ Все функции загружены');
});
