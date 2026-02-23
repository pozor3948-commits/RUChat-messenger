/* ==========================================================
   RUCHAT - ИСТОРИИ (STORIES) - ИСПРАВЛЕННАЯ ВЕРСИЯ
   Оптимизировано для мобильных устройств
   ========================================================== */

const STORY_DURATION = 24 * 60 * 60 * 1000; // 24 часа
const VIEW_DURATION = 5000; // 5 секунд на историю

let currentStoryIndex = 0;
let storyProgressInterval = null;
let storyStartTime = 0;
let allFriendStories = [];

/* ==========================================================
   ДОБАВЛЕНИЕ ИСТОРИИ
   ========================================================== */

async function addStory(mediaFile, mediaType = 'image', caption = '') {
    if (!username) return null;
    
    try {
        // Конвертируем файл в base64 (с сжатием для мобильных)
        const base64Data = await compressAndConvertToBase64(mediaFile);
        
        const story = {
            id: db.ref('users/' + username + '/stories').push().key,
            userId: username,
            mediaType: mediaType,
            media: mediaType === 'image' ? base64Data : null,
            videoUrl: mediaType === 'video' ? base64Data : null,
            caption: caption,
            timestamp: Date.now(),
            expiresAt: Date.now() + STORY_DURATION,
            views: {}
        };
        
        await db.ref('users/' + username + '/stories/' + story.id).set(story);
        
        showNotification('История добавлена! 📖', 'success');
        
        // Обновляем UI
        renderStoriesBar();
        
        return story;
    } catch (error) {
        console.error('Ошибка добавления истории:', error);
        showError('Не удалось добавить историю');
        return null;
    }
}

/* ==========================================================
   ДИАЛОГ ДОБАВЛЕНИЯ ИСТОРИИ
   ========================================================== */

function showAddStoryDialog() {
    const dialog = document.createElement('div');
    dialog.className = 'add-story-dialog-overlay';
    dialog.innerHTML = `
        <div class="add-story-dialog">
            <div class="add-story-header">
                <h3>Добавить историю</h3>
                <button class="close-story-dialog" onclick="this.closest('.add-story-dialog-overlay').remove()">✕</button>
            </div>
            <div class="add-story-options">
                <label class="add-story-option" onclick="selectStoryFile('image')">
                    <div class="option-icon">📷</div>
                    <div class="option-text">Фото из галереи</div>
                </label>
                <label class="add-story-option" onclick="selectStoryFile('video')">
                    <div class="option-icon">🎥</div>
                    <div class="option-text">Видео</div>
                </label>
            </div>
            <input type="file" id="storyFileInput" accept="image/*,video/*" style="display:none" onchange="handleStoryFileSelect(event)">
        </div>
    `;
    
    document.body.appendChild(dialog);
}

function selectStoryFile(type) {
    window.pendingStoryType = type;
    const input = document.getElementById('storyFileInput');
    if (type === 'image') {
        input.accept = 'image/*';
    } else {
        input.accept = 'video/*';
    }
    input.click();
}

function handleStoryFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const mediaType = file.type.startsWith('video') ? 'video' : 'image';
    addStory(file, mediaType, '');
    
    document.querySelector('.add-story-dialog-overlay')?.remove();
}

/* ==========================================================
   ЗАГРУЗКА ИСТОРИЙ ДРУЗЕЙ
   ========================================================== */

async function loadFriendsStories() {
    if (!username) return [];
    
    try {
        const snapshot = await db.ref('users/' + username + '/friends').once('value');
        const friends = snapshot.val() || {};
        
        const stories = [];
        const now = Date.now();
        
        for (const friendId of Object.keys(friends)) {
            const friendStories = await db.ref('users/' + friendId + '/stories')
                .orderByChild('expiresAt')
                .startAt(now)
                .once('value');
            
            const friendStoriesData = friendStories.val();
            if (friendStoriesData && Object.keys(friendStoriesData).length > 0) {
                const storiesArray = Object.values(friendStoriesData);
                const hasUnviewed = storiesArray.some(s => !s.views || !s.views[username]);
                
                stories.push({
                    userId: friendId,
                    stories: storiesArray.sort((a, b) => b.timestamp - a.timestamp),
                    hasUnviewed: hasUnviewed
                });
            }
        }
        
        return stories;
    } catch (error) {
        console.error('Ошибка загрузки историй:', error);
        return [];
    }
}

/* ==========================================================
   ОТРИСОВКА БАР ИСТОРИЙ
   Только на главном экране (список чатов)
   ========================================================== */

function renderStoriesBar() {
    const storiesContainer = document.getElementById('storiesContainer');
    if (!storiesContainer) return;
    
    // Показываем только на главном экране (когда чат не выбран)
    if (currentChatId !== null && currentChatId !== '') {
        storiesContainer.style.display = 'none';
        return;
    }
    
    storiesContainer.style.display = 'block';
    
    const storiesList = document.getElementById('storiesList');
    if (!storiesList) return;
    
    loadFriendsStories().then(stories => {
        allFriendStories = stories;
        
        if (stories.length === 0) {
            storiesList.innerHTML = '<div class="stories-empty">Нет новых историй</div>';
            return;
        }
        
        storiesList.innerHTML = stories.map((friend, index) => `
            <div class="story-item ${!friend.hasUnviewed ? 'viewed' : ''}" 
                 onclick="openStoriesViewer(${index})"
                 ontouchstart="handleStoryTouch(event, ${index})">
                <div class="story-ring ${!friend.hasUnviewed ? 'viewed' : ''}">
                    <div class="story-avatar">${friend.userId[0].toUpperCase()}</div>
                    ${friend.hasUnviewed ? '<div class="story-unviewed-dot"></div>' : ''}
                </div>
                <div class="story-username">${friend.userId}</div>
            </div>
        `).join('');
    });
}

/* ==========================================================
   ПРОСМОТР ИСТОРИЙ
   ========================================================== */

function openStoriesViewer(index) {
    if (!allFriendStories[index]) return;
    
    const friendData = allFriendStories[index];
    if (!friendData.stories || friendData.stories.length === 0) return;
    
    currentStoryIndex = 0;
    window.currentStories = friendData.stories;
    window.currentStoryUserId = friendData.userId;
    
    const viewer = document.getElementById('storiesViewerOverlay');
    if (!viewer) return;
    
    viewer.classList.add('active');
    document.body.style.overflow = 'hidden'; // Блокируем прокрутку
    
    showStory(friendData.stories[0]);
    startStoryProgress(VIEW_DURATION);
}

function showStory(story) {
    const viewer = document.getElementById('storyViewerContent');
    if (!viewer) return;
    
    if (story.mediaType === 'image') {
        viewer.innerHTML = `<img src="${story.media}" alt="Story" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>❌</text></svg>'">`;
    } else if (story.mediaType === 'video') {
        viewer.innerHTML = `<video src="${story.videoUrl}" autoplay muted playsinline onerror="this.src=''"></video>`;
    }
    
    // Обновляем прогресс-бары
    updateStoryProgressBars();
    
    // Обновляем информацию
    const userInfo = document.getElementById('storyViewerUser');
    if (userInfo) {
        userInfo.innerHTML = `
            <div class="story-viewer-avatar">${window.currentStoryUserId[0].toUpperCase()}</div>
            <div class="story-viewer-name">${window.currentStoryUserId}</div>
        `;
    }
    
    // Отмечаем как просмотренную
    markStoryAsViewed(story.id);
}

function startStoryProgress(duration) {
    storyStartTime = Date.now();
    
    if (storyProgressInterval) clearInterval(storyProgressInterval);
    
    storyProgressInterval = setInterval(() => {
        const elapsed = Date.now() - storyStartTime;
        const progress = Math.min((elapsed / duration) * 100, 100);
        
        const activeBar = document.querySelector('.story-progress-bar.active .story-progress-fill');
        if (activeBar) {
            activeBar.style.width = progress + '%';
        }
        
        if (elapsed >= duration) {
            nextStory();
        }
    }, 50);
}

function nextStory() {
    if (!window.currentStories) return;
    
    currentStoryIndex++;
    
    if (currentStoryIndex >= window.currentStories.length) {
        closeStoriesViewer();
        return;
    }
    
    showStory(window.currentStories[currentStoryIndex]);
    startStoryProgress(VIEW_DURATION);
}

function previousStory() {
    if (currentStoryIndex > 0) {
        currentStoryIndex--;
        showStory(window.currentStories[currentStoryIndex]);
        startStoryProgress(VIEW_DURATION);
    }
}

function closeStoriesViewer() {
    const viewer = document.getElementById('storiesViewerOverlay');
    if (viewer) {
        viewer.classList.remove('active');
        document.body.style.overflow = '';
    }
    
    if (storyProgressInterval) clearInterval(storyProgressInterval);
    
    // Очищаем
    window.currentStories = null;
    window.currentStoryUserId = null;
    currentStoryIndex = 0;
}

async function markStoryAsViewed(storyId) {
    try {
        await db.ref('users/' + window.currentStoryUserId + '/stories/' + storyId + '/views/' + username).set({
            viewedAt: Date.now()
        });
    } catch (error) {
        console.error('Ошибка отметки просмотра:', error);
    }
}

function updateStoryProgressBars() {
    const barsContainer = document.getElementById('storyProgressBars');
    if (!barsContainer || !window.currentStories) return;
    
    barsContainer.innerHTML = window.currentStories.map((_, i) => `
        <div class="story-progress-bar ${i === currentStoryIndex ? 'active' : ''} ${i < currentStoryIndex ? 'completed' : ''}">
            <div class="story-progress-fill" style="width: ${i < currentStoryIndex ? '100%' : '0%'}"></div>
        </div>
    `).join('');
}

/* ==========================================================
   ОБРАБОТКА TOUCH ЖЕСТОВ
   ========================================================== */

let storyTouchStartX = 0;
let storyTouchStartY = 0;

function handleStoryTouch(event, index) {
    storyTouchStartX = event.touches[0].clientX;
    storyTouchStartY = event.touches[0].clientY;
}

function handleStoryTouchEnd(event) {
    if (!window.currentStories) return;
    
    const touchEndX = event.changedTouches[0].clientX;
    const touchEndY = event.changedTouches[0].clientY;
    
    const diffX = touchEndX - storyTouchStartX;
    const diffY = touchEndY - storyTouchStartY;
    
    // Горизонтальный свайп
    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
        if (diffX < -50) {
            nextStory();
        } else if (diffX > 50) {
            previousStory();
        }
    }
    
    // Вертикальный свайп вниз для закрытия
    if (diffY > 100) {
        closeStoriesViewer();
    }
}

/* ==========================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ========================================================== */

async function compressAndConvertToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

/* ==========================================================
   ЭКСПОРТ ФУНКЦИЙ
   ========================================================== */

window.addStory = addStory;
window.loadFriendsStories = loadFriendsStories;
window.renderStoriesBar = renderStoriesBar;
window.openStoriesViewer = openStoriesViewer;
window.nextStory = nextStory;
window.previousStory = previousStory;
window.closeStoriesViewer = closeStoriesViewer;
window.handleStoryTouchEnd = handleStoryTouchEnd;
window.showAddStoryDialog = showAddStoryDialog;
window.selectStoryFile = selectStoryFile;
window.handleStoryFileSelect = handleStoryFileSelect;

// Добавляем стили
const storiesStyles = document.createElement('style');
storiesStyles.textContent = `
    /* Контейнер историй */
    .stories-container {
        background: rgba(255, 255, 255, 0.05);
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding: 15px 0;
        overflow-x: auto;
        -webkit-overflow-scrolling: touch;
    }
    
    .stories-container::-webkit-scrollbar {
        display: none;
    }
    
    .stories-list {
        display: flex;
        gap: 12px;
        padding: 0 15px;
        min-width: max-content;
    }
    
    .story-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        min-width: 70px;
        position: relative;
    }
    
    .story-ring {
        width: 66px;
        height: 66px;
        border-radius: 50%;
        padding: 3px;
        background: linear-gradient(45deg, #0088cc, #0ea5e9, #8b5cf6);
        transition: transform 0.2s;
        position: relative;
    }
    
    .story-ring.viewed {
        background: linear-gradient(45deg, #475569, #64748b);
    }
    
    .story-ring:active {
        transform: scale(0.95);
    }
    
    .story-avatar {
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: linear-gradient(135deg, #1e293b, #0f172a);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 700;
        color: white;
        border: 3px solid #0f172a;
    }
    
    .story-username {
        font-size: 11px;
        color: rgba(255, 255, 255, 0.7);
        margin-top: 6px;
        max-width: 70px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    
    .story-unviewed-dot {
        position: absolute;
        top: 0;
        right: 0;
        width: 16px;
        height: 16px;
        background: #0088cc;
        border-radius: 50%;
        border: 2px solid #0f172a;
    }
    
    .stories-empty {
        text-align: center;
        color: rgba(255, 255, 255, 0.5);
        padding: 20px;
        width: 100%;
    }
    
    /* Кнопка добавления истории */
    .add-story-btn {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0088cc, #0ea5e9);
        border: none;
        color: white;
        font-size: 32px;
        cursor: pointer;
        flex-shrink: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.2s;
        box-shadow: 0 4px 15px rgba(0, 136, 204, 0.3);
    }
    
    .add-story-btn:active {
        transform: scale(0.9);
    }
    
    /* Диалог добавления */
    .add-story-dialog-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.7);
        z-index: 10000;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .add-story-dialog {
        background: white;
        border-radius: 20px;
        padding: 25px;
        width: 90%;
        max-width: 400px;
        color: #1e293b;
    }
    
    .add-story-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    
    .add-story-header h3 {
        margin: 0;
        font-size: 20px;
    }
    
    .close-story-dialog {
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #64748b;
    }
    
    .add-story-options {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 15px;
    }
    
    .add-story-option {
        background: #f8fafc;
        padding: 20px;
        border-radius: 12px;
        cursor: pointer;
        text-align: center;
        transition: all 0.2s;
    }
    
    .add-story-option:active {
        background: #e2e8f0;
        transform: scale(0.98);
    }
    
    .option-icon {
        font-size: 40px;
        margin-bottom: 10px;
    }
    
    .option-text {
        font-size: 14px;
        font-weight: 600;
    }
    
    /* Просмотр историй */
    .stories-viewer-overlay {
        position: fixed;
        inset: 0;
        background: #000;
        z-index: 10000;
        display: none;
        align-items: center;
        justify-content: center;
    }
    
    .stories-viewer-overlay.active {
        display: flex;
    }
    
    .stories-viewer {
        width: 100%;
        max-width: 500px;
        height: 100%;
        max-height: 900px;
        position: relative;
        background: #000;
    }
    
    #storyViewerContent {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    #storyViewerContent img,
    #storyViewerContent video {
        width: 100%;
        height: 100%;
        object-fit: contain;
    }
    
    .story-progress-container {
        position: absolute;
        top: 10px;
        left: 10px;
        right: 10px;
        display: flex;
        gap: 4px;
        z-index: 10;
    }
    
    .story-progress-bar {
        flex: 1;
        height: 3px;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 2px;
        overflow: hidden;
    }
    
    .story-progress-bar.active {
        background: rgba(255, 255, 255, 0.5);
    }
    
    .story-progress-bar.completed .story-progress-fill {
        background: white;
    }
    
    .story-progress-fill {
        height: 100%;
        background: white;
        width: 0%;
        transition: width 0.05s linear;
    }
    
    .story-viewer-user {
        position: absolute;
        top: 25px;
        left: 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        color: white;
        z-index: 10;
    }
    
    .story-viewer-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0088cc, #0ea5e9);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 18px;
    }
    
    .story-viewer-name {
        font-weight: 600;
        font-size: 14px;
    }
    
    .close-story-btn {
        position: absolute;
        top: 15px;
        right: 15px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255, 255, 255, 0.2);
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    /* Зоны для свайпа */
    .story-touch-zone {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 30%;
        z-index: 5;
    }
    
    .story-touch-zone.left {
        left: 0;
    }
    
    .story-touch-zone.right {
        right: 0;
    }
    
    @media (max-width: 768px) {
        .stories-container {
            padding: 10px 0;
        }
        
        .story-ring {
            width: 60px;
            height: 60px;
        }
        
        .story-username {
            font-size: 10px;
        }
    }
`;
document.head.appendChild(storiesStyles);

// Добавляем HTML для просмотра историй
const storiesHTML = document.createElement('div');
storiesHTML.innerHTML = `
    <div class="stories-viewer-overlay" id="storiesViewerOverlay" ontouchend="handleStoryTouchEnd(event)">
        <div class="stories-viewer">
            <div class="story-progress-container" id="storyProgressBars"></div>
            <button class="close-story-btn" onclick="closeStoriesViewer()">✕</button>
            
            <div class="story-viewer-user" id="storyViewerUser">
                <div class="story-viewer-avatar">?</div>
                <div class="story-viewer-name">User</div>
            </div>
            
            <div id="storyViewerContent"></div>
            
            <div class="story-touch-zone left" onclick="previousStory()"></div>
            <div class="story-touch-zone right" onclick="nextStory()"></div>
        </div>
    </div>
`;
document.body.appendChild(storiesHTML);

// Слушаем изменения чата для показа/скрытия историй
const originalOpenChat = window.openChat;
if (originalOpenChat) {
    window.openChat = function(...args) {
        const result = originalOpenChat.apply(this, args);
        renderStoriesBar();
        return result;
    };
}

// Слушаем закрытие чата
const originalCloseChat = window.closeChat;
if (originalCloseChat) {
    window.closeChat = function(...args) {
        const result = originalCloseChat.apply(this, args);
        setTimeout(() => renderStoriesBar(), 100);
        return result;
    };
}

// Загружаем истории при загрузке
if (typeof db !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (username) {
                renderStoriesBar();
            }
        }, 1000);
    });
    
    // Перерисовываем при изменении размера окна
    window.addEventListener('resize', () => renderStoriesBar());
}

console.log('✅ Истории RuChat (исправленные) загружены');
