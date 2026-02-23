/* ==========================================================
   RUCHAT - КАСТОМИЗАЦИЯ ЧАТОВ И УЛУЧШЕННЫЙ ПОИСК
   ========================================================== */

/* ==========================================================
   1. КАСТОМИЗАЦИЯ ЧАТОВ (ОБОИ, ТЕМЫ)
   ========================================================== */

const chatBackgrounds = {
    default: 'linear-gradient(135deg, #0f172a, #1e293b)',
    ocean: 'linear-gradient(135deg, #0ea5e9, #2563eb)',
    sunset: 'linear-gradient(135deg, #f59e0b, #ef4444)',
    forest: 'linear-gradient(135deg, #10b981, #14b8a6)',
    purple: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
    night: 'linear-gradient(135deg, #1f2937, #111827)',
    galaxy: 'url("https://images.unsplash.com/photo-1534796636912-3b95b3ab5980?auto=format&fit=crop&w=800&q=60")',
    nature: 'url("https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=60")'
};

// Текущие настройки чата
let currentChatSettings = {
    background: 'default',
    theme: 'dark',
    fontSize: 'medium'
};

/* ==========================================================
   СОХРАНЕНИЕ НАСТРОЕК ЧАТА
   ========================================================== */

async function saveChatSettings(chatId, settings) {
    try {
        await db.ref('users/' + username + '/chatSettings/' + chatId).set(settings);
        applyChatSettings(settings);
        showNotification('Настройки сохранены', 'success');
    } catch (error) {
        console.error('Ошибка сохранения настроек:', error);
        showError('Не удалось сохранить настройки');
    }
}

async function loadChatSettings(chatId) {
    try {
        const snapshot = await db.ref('users/' + username + '/chatSettings/' + chatId).once('value');
        const settings = snapshot.val();
        
        if (settings) {
            currentChatSettings = { ...currentChatSettings, ...settings };
            applyChatSettings(currentChatSettings);
        }
        
        return currentChatSettings;
    } catch (error) {
        console.error('Ошибка загрузки настроек:', error);
        return currentChatSettings;
    }
}

function applyChatSettings(settings) {
    const messagesContainer = document.getElementById('messages');
    if (!messagesContainer) return;
    
    // Применяем фон
    if (settings.background && chatBackgrounds[settings.background]) {
        messagesContainer.style.background = chatBackgrounds[settings.background];
        messagesContainer.style.backgroundSize = 'cover';
        messagesContainer.style.backgroundPosition = 'center';
    }
    
    // Применяем размер шрифта
    if (settings.fontSize) {
        const sizeMap = { small: '13px', medium: '15px', large: '17px' };
        messagesContainer.style.fontSize = sizeMap[settings.fontSize] || '15px';
    }
}

/* ==========================================================
   UI ДЛЯ ВЫБОРА ОБОЕВ
   ========================================================== */

function showBackgroundPicker() {
    const dialog = document.createElement('div');
    dialog.className = 'background-picker-overlay';
    dialog.innerHTML = `
        <div class="background-picker">
            <div class="picker-header">
                <h3>🎨 Фон чата</h3>
                <button class="close-picker" onclick="this.closest('.background-picker-overlay').remove()">✕</button>
            </div>
            
            <div class="backgrounds-grid">
                ${Object.entries(chatBackgrounds).map(([key, value]) => `
                    <div class="background-option" 
                         style="background: ${value}" 
                         onclick="selectBackground('${key}')">
                        <span class="background-name">${key}</span>
                    </div>
                `).join('')}
            </div>
            
            <div class="picker-actions">
                <button class="btn-upload-bg" onclick="uploadCustomBackground()">📁 Загрузить свой</button>
                <button class="btn-reset-bg" onclick="resetBackground()">Сбросить</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(dialog);
}

function selectBackground(key) {
    if (!currentChatId) return;
    
    currentChatSettings.background = key;
    saveChatSettings(currentChatId, currentChatSettings);
    
    document.querySelector('.background-picker-overlay')?.remove();
}

function uploadCustomBackground() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // Конвертируем в base64
        const reader = new FileReader();
        reader.onload = async (event) => {
            const base64 = event.target.result;
            
            // Сохраняем как кастомный фон
            chatBackgrounds['custom_' + Date.now()] = `url("${base64}")`;
            selectBackground(Object.keys(chatBackgrounds).pop());
        };
        reader.readAsDataURL(file);
    };
    
    input.click();
}

function resetBackground() {
    if (!currentChatId) return;
    
    currentChatSettings.background = 'default';
    saveChatSettings(currentChatId, currentChatSettings);
    
    document.querySelector('.background-picker-overlay')?.remove();
}

/* ==========================================================
   2. УЛУЧШЕННЫЙ ПОИСК ПО ЧАТАМ
   ========================================================== */

let searchIndex = new Map();
let searchResults = [];
let currentSearchQuery = '';

/* ==========================================================
   ИНДЕКСАЦИЯ СООБЩЕНИЙ
   ========================================================== */

function indexMessage(messageId, message) {
    if (!message.text) return;
    
    const words = message.text.toLowerCase().split(/\s+/);
    
    words.forEach(word => {
        if (word.length < 2) return;
        
        if (!searchIndex.has(word)) {
            searchIndex.set(word, new Set());
        }
        
        searchIndex.get(word).add({
            id: messageId,
            chatId: currentChatId,
            text: message.text,
            time: message.time,
            from: message.from
        });
    });
}

function buildSearchIndex(messages) {
    searchIndex.clear();
    
    Object.entries(messages).forEach(([id, message]) => {
        indexMessage(id, message);
    });
    
    console.log('✅ Поисковый индекс построен:', searchIndex.size, 'слов');
}

/* ==========================================================
   ПОИСКОВАЯ ФУНКЦИЯ
   ========================================================== */

function searchMessages(query) {
    if (!query || query.length < 2) {
        clearSearchResults();
        return [];
    }
    
    currentSearchQuery = query.toLowerCase();
    const words = currentSearchQuery.split(/\s+/);
    
    const results = new Map();
    
    words.forEach(word => {
        // Ищем точные совпадения
        for (const [indexWord, messages] of searchIndex.entries()) {
            if (indexWord.includes(word) || word.includes(indexWord)) {
                messages.forEach(msg => {
                    if (!results.has(msg.id)) {
                        results.set(msg.id, {
                            ...msg,
                            relevance: calculateRelevance(msg.text, query)
                        });
                    }
                });
            }
        }
    });
    
    // Сортируем по релевантности
    searchResults = Array.from(results.values())
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, 50); // Ограничиваем 50 результатами
    
    displaySearchResults(searchResults);
    
    return searchResults;
}

function calculateRelevance(text, query) {
    const textLower = text.toLowerCase();
    let score = 0;
    
    // Точное совпадение
    if (textLower.includes(query)) {
        score += 10;
    }
    
    // Все слова запроса
    const queryWords = query.split(/\s+/);
    queryWords.forEach(word => {
        if (textLower.includes(word)) {
            score += 5;
        }
    });
    
    // Позиция вхождения (чем раньше, тем лучше)
    const position = textLower.indexOf(query);
    if (position !== -1) {
        score += Math.max(0, 10 - position / 10);
    }
    
    return score;
}

/* ==========================================================
   ОТОБРАЖЕНИЕ РЕЗУЛЬТАТОВ
   ========================================================== */

function displaySearchResults(results) {
    const searchContainer = document.getElementById('searchResultsContainer');
    if (!searchContainer) return;
    
    searchContainer.classList.add('active');
    
    if (results.length === 0) {
        searchContainer.innerHTML = `
            <div class="search-empty">
                <div class="search-empty-icon">🔍</div>
                <div>Ничего не найдено</div>
            </div>
        `;
        return;
    }
    
    searchContainer.innerHTML = `
        <div class="search-header">
            <span>Найдено: ${results.length}</span>
            <button onclick="clearSearchResults()">✕</button>
        </div>
        <div class="search-results-list">
            ${results.map(result => `
                <div class="search-result-item" onclick="jumpToMessage('${result.id}')">
                    <div class="result-from">${result.from}</div>
                    <div class="result-text">${highlightMatch(result.text, currentSearchQuery)}</div>
                    <div class="result-time">${formatMessageTime(result.time)}</div>
                </div>
            `).join('')}
        </div>
    `;
}

function highlightMatch(text, query) {
    const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

function jumpToMessage(messageId) {
    const messageEl = document.getElementById(`message_${messageId}`);
    if (messageEl) {
        messageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        messageEl.style.animation = 'highlight 2s ease';
        clearSearchResults();
    }
}

function clearSearchResults() {
    const searchContainer = document.getElementById('searchResultsContainer');
    if (searchContainer) {
        searchContainer.classList.remove('active');
        searchContainer.innerHTML = '';
    }
    
    searchResults = [];
    currentSearchQuery = '';
}

/* ==========================================================
   ФИЛЬТРЫ ПОИСКА
   ========================================================== */

function showSearchFilters() {
    const filterDialog = document.createElement('div');
    filterDialog.className = 'search-filters-overlay';
    filterDialog.innerHTML = `
        <div class="search-filters">
            <div class="filters-header">
                <h3>🔎 Фильтры поиска</h3>
                <button onclick="this.closest('.search-filters-overlay').remove()">✕</button>
            </div>
            
            <div class="filter-group">
                <label>Тип сообщений</label>
                <div class="filter-options">
                    <label class="filter-option">
                        <input type="checkbox" checked> Текст
                    </label>
                    <label class="filter-option">
                        <input type="checkbox"> Фото
                    </label>
                    <label class="filter-option">
                        <input type="checkbox"> Видео
                    </label>
                    <label class="filter-option">
                        <input type="checkbox"> Файлы
                    </label>
                    <label class="filter-option">
                        <input type="checkbox"> Голосовые
                    </label>
                </div>
            </div>
            
            <div class="filter-group">
                <label>Период</label>
                <select class="filter-select">
                    <option>За всё время</option>
                    <option>За сегодня</option>
                    <option>За неделю</option>
                    <option>За месяц</option>
                    <option>Свой период...</option>
                </select>
            </div>
            
            <div class="filter-group">
                <label>От кого</label>
                <select class="filter-select">
                    <option>Все пользователи</option>
                    <option>Только я</option>
                    <option>Только другие</option>
                </select>
            </div>
            
            <div class="filter-actions">
                <button class="btn-apply-filters" onclick="applySearchFilters()">Применить</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(filterDialog);
}

function applySearchFilters() {
    // Здесь будет логика применения фильтров
    showNotification('Фильтры применяются', 'info');
    document.querySelector('.search-filters-overlay')?.remove();
}

/* ==========================================================
   БЫСТРЫЙ ПОИСК (GLOBAL SEARCH)
   ========================================================== */

function showGlobalSearch() {
    const overlay = document.createElement('div');
    overlay.className = 'global-search-overlay';
    overlay.innerHTML = `
        <div class="global-search">
            <div class="global-search-header">
                <input type="text" 
                       class="global-search-input" 
                       placeholder="Поиск по всем чатам..."
                       autofocus
                       oninput="performGlobalSearch(this.value)">
                <button onclick="closeGlobalSearch()">✕</button>
            </div>
            <div class="global-search-results" id="globalSearchResults"></div>
        </div>
    `;
    
    document.body.appendChild(overlay);
    overlay.querySelector('input').focus();
}

function performGlobalSearch(query) {
    const resultsContainer = document.getElementById('globalSearchResults');
    if (!query || query.length < 2) {
        resultsContainer.innerHTML = '';
        return;
    }
    
    // Ищем по всем чатам
    db.ref('chats').once('value', snapshot => {
        const chats = snapshot.val();
        const allResults = [];
        
        Object.entries(chats).forEach(([chatId, chatData]) => {
            if (chatData.messages) {
                Object.entries(chatData.messages).forEach(([msgId, message]) => {
                    if (message.text && message.text.toLowerCase().includes(query.toLowerCase())) {
                        allResults.push({
                            chatId,
                            messageId: msgId,
                            message,
                            relevance: calculateRelevance(message.text, query)
                        });
                    }
                });
            }
        });
        
        // Сортируем и показываем топ-20
        allResults.sort((a, b) => b.relevance - a.relevance)
            .slice(0, 20)
            .forEach(result => {
                displayGlobalSearchResult(result);
            });
    });
}

function displayGlobalSearchResult(result) {
    const container = document.getElementById('globalSearchResults');
    if (!container) return;
    
    const item = document.createElement('div');
    item.className = 'global-search-item';
    item.innerHTML = `
        <div class="search-chat-name">${result.chatId}</div>
        <div class="search-message-text">${highlightMatch(result.message.text, currentSearchQuery)}</div>
        <div class="search-message-time">${formatMessageTime(result.message.time)}</div>
    `;
    
    item.onclick = () => {
        closeGlobalSearch();
        // Переход к чату и сообщению
        jumpToMessage(result.messageId);
    };
    
    container.appendChild(item);
}

function closeGlobalSearch() {
    document.querySelector('.global-search-overlay')?.remove();
}

function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Только что';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} мин назад`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} ч назад`;
    
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
}

/* ==========================================================
   ЭКСПОРТ ФУНКЦИЙ
   ========================================================== */

window.saveChatSettings = saveChatSettings;
window.loadChatSettings = loadChatSettings;
window.showBackgroundPicker = showBackgroundPicker;
window.selectBackground = selectBackground;
window.uploadCustomBackground = uploadCustomBackground;
window.resetBackground = resetBackground;
window.searchMessages = searchMessages;
window.clearSearchResults = clearSearchResults;
window.jumpToMessage = jumpToMessage;
window.showSearchFilters = showSearchFilters;
window.applySearchFilters = applySearchFilters;
window.showGlobalSearch = showGlobalSearch;
window.closeGlobalSearch = closeGlobalSearch;
window.buildSearchIndex = buildSearchIndex;
window.indexMessage = indexMessage;

// Добавляем стили
const customizationStyles = document.createElement('style');
customizationStyles.textContent = `
    /* Выбор фона */
    .background-picker-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .background-picker {
        background: white;
        border-radius: 20px;
        padding: 25px;
        width: 90%;
        max-width: 600px;
        max-height: 80vh;
        overflow-y: auto;
        color: #1e293b;
    }
    
    .picker-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    
    .picker-header h3 {
        margin: 0;
        font-size: 20px;
    }
    
    .close-picker {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #64748b;
    }
    
    .backgrounds-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
    }
    
    .background-option {
        height: 100px;
        border-radius: 12px;
        cursor: pointer;
        transition: transform 0.2s, box-shadow 0.2s;
        position: relative;
        overflow: hidden;
    }
    
    .background-option:hover {
        transform: scale(1.05);
        box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
    
    .background-name {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        background: rgba(0,0,0,0.6);
        color: white;
        padding: 8px;
        font-size: 12px;
        text-align: center;
        text-transform: capitalize;
    }
    
    .picker-actions {
        display: flex;
        gap: 10px;
    }
    
    .btn-upload-bg,
    .btn-reset-bg {
        flex: 1;
        padding: 12px;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
    }
    
    .btn-upload-bg {
        background: linear-gradient(135deg, #0088cc, #0ea5e9);
        color: white;
    }
    
    .btn-reset-bg {
        background: #f1f5f9;
        color: #64748b;
    }
    
    /* Результаты поиска */
    .search-results-container {
        position: absolute;
        top: 60px;
        left: 20px;
        right: 20px;
        background: white;
        border-radius: 16px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.3);
        z-index: 1000;
        display: none;
        max-height: 500px;
        overflow-y: auto;
        color: #1e293b;
    }
    
    .search-results-container.active {
        display: block;
    }
    
    .search-header {
        display: flex;
        justify-content: space-between;
        padding: 15px 20px;
        border-bottom: 1px solid #e2e8f0;
        font-weight: 600;
    }
    
    .search-results-list {
        padding: 10px;
    }
    
    .search-result-item {
        padding: 15px;
        border-radius: 10px;
        cursor: pointer;
        transition: background 0.2s;
    }
    
    .search-result-item:hover {
        background: #f1f5f9;
    }
    
    .result-from {
        font-weight: 600;
        color: #0088cc;
        margin-bottom: 5px;
    }
    
    .result-text {
        color: #64748b;
        margin-bottom: 5px;
    }
    
    .result-text mark {
        background: #fef08a;
        padding: 2px 4px;
        border-radius: 3px;
    }
    
    .result-time {
        font-size: 12px;
        color: #94a3b8;
    }
    
    .search-empty {
        text-align: center;
        padding: 40px;
        color: #94a3b8;
    }
    
    .search-empty-icon {
        font-size: 48px;
        margin-bottom: 10px;
    }
    
    /* Глобальный поиск */
    .global-search-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.8);
        z-index: 10001;
        display: flex;
        align-items: flex-start;
        justify-content: center;
        padding-top: 100px;
    }
    
    .global-search {
        background: white;
        border-radius: 16px;
        width: 90%;
        max-width: 600px;
        max-height: 70vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        color: #1e293b;
    }
    
    .global-search-header {
        display: flex;
        align-items: center;
        padding: 20px;
        border-bottom: 1px solid #e2e8f0;
    }
    
    .global-search-input {
        flex: 1;
        border: none;
        font-size: 18px;
        outline: none;
    }
    
    .global-search-header button {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #64748b;
    }
    
    .global-search-results {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
    }
    
    .global-search-item {
        padding: 15px;
        border-radius: 10px;
        cursor: pointer;
        border-bottom: 1px solid #f1f5f9;
    }
    
    .global-search-item:hover {
        background: #f8fafc;
    }
    
    .search-chat-name {
        font-weight: 600;
        color: #0088cc;
        margin-bottom: 5px;
    }
    
    .search-message-text {
        color: #64748b;
        margin-bottom: 5px;
    }
    
    .search-message-time {
        font-size: 12px;
        color: #94a3b8;
    }
    
    /* Фильтры поиска */
    .search-filters-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .search-filters {
        background: white;
        border-radius: 16px;
        padding: 25px;
        width: 90%;
        max-width: 450px;
        color: #1e293b;
    }
    
    .filters-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    
    .filter-group {
        margin-bottom: 20px;
    }
    
    .filter-group label {
        display: block;
        font-weight: 600;
        margin-bottom: 10px;
    }
    
    .filter-options {
        display: flex;
        flex-direction: column;
        gap: 10px;
    }
    
    .filter-option {
        display: flex;
        align-items: center;
        gap: 10px;
        cursor: pointer;
    }
    
    .filter-select {
        width: 100%;
        padding: 12px;
        border: 2px solid #e2e8f0;
        border-radius: 10px;
        font-size: 15px;
    }
    
    .filter-actions {
        margin-top: 25px;
    }
    
    .btn-apply-filters {
        width: 100%;
        padding: 14px;
        background: linear-gradient(135deg, #0088cc, #0ea5e9);
        color: white;
        border: none;
        border-radius: 12px;
        font-weight: 600;
        cursor: pointer;
    }
    
    @keyframes highlight {
        0%, 100% { background: transparent; }
        50% { background: rgba(255, 255, 0, 0.3); }
    }
`;
document.head.appendChild(customizationStyles);

// Добавляем контейнер для результатов поиска
const searchContainer = document.createElement('div');
searchContainer.id = 'searchResultsContainer';
searchContainer.className = 'search-results-container';
document.body.appendChild(searchContainer);

console.log('✅ Кастомизация и поиск RuChat загружены');
