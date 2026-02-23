/* ==========================================================
   RUCHAT - ИСТОРИИ (STORIES)
   ========================================================== */

const STORY_DURATION = 24 * 60 * 60 * 1000; // 24 часа
const VIEW_DURATION = 5000; // 5 секунд на историю

let currentStoryIndex = 0;
let storyViewerInterval = null;
let storyProgressInterval = null;
let storyStartTime = 0;

/* ==========================================================
   ДОБАВЛЕНИЕ ИСТОРИИ
   ========================================================== */

async function addStory(mediaFile, mediaType = 'image', caption = '') {
    if (!username) return;
    
    try {
        // Конвертируем файл в base64
        const base64Data = await fileToBase64(mediaFile);
        
        const story = {
            id: db.ref('users/' + username + '/stories').push().key,
            userId: username,
            mediaType: mediaType, // 'image' или 'video'
            media: mediaType === 'image' ? base64Data : null,
            videoUrl: mediaType === 'video' ? base64Data : null,
            caption: caption,
            timestamp: Date.now(),
            expiresAt: Date.now() + STORY_DURATION,
            views: {}
        };
        
        await db.ref('users/' + username + '/stories/' + story.id).set(story);
        
        // Обновляем список историй у друзей
        await updateFriendsStoriesList(username);
        
        showNotification('История добавлена! 📖', 'success');
        
        return story;
    } catch (error) {
        console.error('Ошибка добавления истории:', error);
        showError('Не удалось добавить историю');
    }
}

/* ==========================================================
   ПОЛУЧЕНИЕ ИСТОРИЙ ДРУЗЕЙ
   ========================================================== */

async function loadFriendsStories() {
    if (!username) return [];
    
    try {
        const snapshot = await db.ref('users/' + username + '/friends').once('value');
        const friends = snapshot.val() || {};
        
        const stories = [];
        
        for (const friendId of Object.keys(friends)) {
            const friendStories = await db.ref('users/' + friendId + '/stories')
                .orderByChild('expiresAt')
                .startAt(Date.now())
                .once('value');
            
            const friendStoriesData = friendStories.val();
            if (friendStoriesData && Object.keys(friendStoriesData).length > 0) {
                stories.push({
                    userId: friendId,
                    stories: Object.values(friendStoriesData),
                    viewed: checkIfStoriesViewed(friendStoriesData)
                });
            }
        }
        
        return stories;
    } catch (error) {
        console.error('Ошибка загрузки историй:', error);
        return [];
    }
}

function checkIfStoriesViewed(stories) {
    return Object.values(stories).every(s => s.views && s.views[username]);
}

/* ==========================================================
   ПРОСМОТР ИСТОРИЙ
   ========================================================== */

function showStoriesViewer(userId, stories) {
    if (!stories || stories.length === 0) return;
    
    currentStoryIndex = 0;
    const container = document.getElementById('storiesViewer');
    if (!container) return;
    
    container.classList.add('active');
    
    // Показываем первую историю
    showStory(stories[0]);
    
    // Запускаем прогресс
    startStoryProgress(VIEW_DURATION);
}

function showStory(story) {
    const viewer = document.getElementById('storyViewer');
    if (!viewer) return;
    
    const mediaContainer = viewer.querySelector('.story-media');
    if (!mediaContainer) return;
    
    if (story.mediaType === 'image') {
        mediaContainer.innerHTML = `<img src="${story.media}" alt="Story">`;
    } else if (story.mediaType === 'video') {
        mediaContainer.innerHTML = `<video src="${story.videoUrl}" autoplay muted playsinline></video>`;
    }
    
    // Обновляем информацию
    const userInfo = viewer.querySelector('.story-user-info');
    if (userInfo) {
        userInfo.innerHTML = `
            <div class="story-user-avatar">${story.userId[0].toUpperCase()}</div>
            <div class="story-user-name">${story.userId}</div>
            <div class="story-time">${formatStoryTime(story.timestamp)}</div>
        `;
    }
    
    // Обновляем caption
    const caption = viewer.querySelector('.story-caption');
    if (caption && story.caption) {
        caption.textContent = story.caption;
        caption.style.display = 'block';
    } else if (caption) {
        caption.style.display = 'none';
    }
    
    // Отмечаем как просмотренную
    markStoryAsViewed(story.id);
}

function startStoryProgress(duration) {
    storyStartTime = Date.now();
    const progressBar = document.getElementById('storyProgressBar');
    
    if (storyProgressInterval) clearInterval(storyProgressInterval);
    
    storyProgressInterval = setInterval(() => {
        const elapsed = Date.now() - storyStartTime;
        const progress = (elapsed / duration) * 100;
        
        if (progressBar) {
            progressBar.style.width = progress + '%';
        }
        
        if (elapsed >= duration) {
            nextStory();
        }
    }, 50);
}

function nextStory() {
    currentStoryIndex++;
    
    const stories = window.currentStories || [];
    if (currentStoryIndex >= stories.length) {
        closeStoriesViewer();
        return;
    }
    
    showStory(stories[currentStoryIndex]);
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
    const container = document.getElementById('storiesViewer');
    if (container) {
        container.classList.remove('active');
    }
    
    if (storyProgressInterval) clearInterval(storyProgressInterval);
    if (storyViewerInterval) clearInterval(storyViewerInterval);
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

/* ==========================================================
   UI КОМПОНЕНТЫ
   ========================================================== */

function renderStoriesBar() {
    const container = document.getElementById('storiesBar');
    if (!container) return;
    
    loadFriendsStories().then(stories => {
        if (stories.length === 0) {
            container.innerHTML = '<div class="stories-empty">Нет новых историй</div>';
            return;
        }
        
        container.innerHTML = stories.map((friend, index) => `
            <div class="story-item ${friend.viewed ? 'viewed' : ''}" onclick="openFriendStories('${friend.userId}', ${index})">
                <div class="story-ring ${friend.viewed ? 'viewed' : ''}">
                    <div class="story-avatar">${friend.userId[0].toUpperCase()}</div>
                </div>
                <div class="story-username">${friend.userId}</div>
            </div>
        `).join('');
        
        window.allStories = stories;
    });
}

function openFriendStories(userId, index) {
    window.currentStories = window.allStories[index].stories;
    window.currentStoryUserId = userId;
    showStoriesViewer(userId, window.currentStories);
}

function formatStoryTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 60) return `${minutes} мин назад`;
    if (hours < 24) return `${hours} ч назад`;
    return `${days} дн назад`;
}

/* ==========================================================
   ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
   ========================================================== */

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

async function updateFriendsStoriesList(userId) {
    try {
        const snapshot = await db.ref('users').once('value');
        const users = snapshot.val();
        
        for (const user of Object.keys(users)) {
            if (user !== userId && users[user].friends && users[user].friends[userId]) {
                // У друга есть этот пользователь в друзьях
                renderStoriesBar();
            }
        }
    } catch (error) {
        console.error('Ошибка обновления:', error);
    }
}

/* ==========================================================
   ЭКСПОРТ ФУНКЦИЙ
   ========================================================== */

window.addStory = addStory;
window.loadFriendsStories = loadFriendsStories;
window.showStoriesViewer = showStoriesViewer;
window.openFriendStories = openFriendStories;
window.nextStory = nextStory;
window.previousStory = previousStory;
window.closeStoriesViewer = closeStoriesViewer;
window.renderStoriesBar = renderStoriesBar;

// Добавляем стили
const storiesStyles = document.createElement('style');
storiesStyles.textContent = `
    /* Бар историй */
    .stories-bar {
        display: flex;
        gap: 15px;
        padding: 15px 20px;
        background: rgba(255,255,255,0.05);
        overflow-x: auto;
        border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    
    .story-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        cursor: pointer;
        min-width: 70px;
    }
    
    .story-ring {
        width: 66px;
        height: 66px;
        border-radius: 50%;
        padding: 3px;
        background: linear-gradient(45deg, #0088cc, #0ea5e9, #8b5cf6);
        transition: transform 0.3s;
    }
    
    .story-ring.viewed {
        background: linear-gradient(45deg, #475569, #64748b);
    }
    
    .story-ring:hover {
        transform: scale(1.1);
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
        font-size: 12px;
        color: rgba(255,255,255,0.7);
        margin-top: 5px;
        max-width: 70px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    
    .stories-empty {
        text-align: center;
        color: rgba(255,255,255,0.5);
        padding: 20px;
        width: 100%;
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
    
    .story-media {
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .story-media img,
    .story-media video {
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
        background: rgba(255,255,255,0.3);
        border-radius: 2px;
        overflow: hidden;
    }
    
    .story-progress {
        height: 100%;
        background: white;
        width: 0%;
        transition: width 0.1s linear;
    }
    
    .story-user-info {
        position: absolute;
        top: 30px;
        left: 20px;
        display: flex;
        align-items: center;
        gap: 12px;
        color: white;
        z-index: 10;
    }
    
    .story-user-avatar {
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0088cc, #0ea5e9);
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
    }
    
    .story-user-name {
        font-weight: 600;
        font-size: 14px;
    }
    
    .story-time {
        font-size: 12px;
        opacity: 0.7;
    }
    
    .story-caption {
        position: absolute;
        bottom: 80px;
        left: 20px;
        right: 20px;
        color: white;
        font-size: 14px;
        background: rgba(0,0,0,0.5);
        padding: 10px 15px;
        border-radius: 12px;
        display: none;
    }
    
    .story-controls {
        position: absolute;
        bottom: 20px;
        left: 0;
        right: 0;
        display: flex;
        justify-content: space-between;
        padding: 0 20px;
        z-index: 10;
    }
    
    .story-nav-btn {
        width: 50px;
        height: 50px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        backdrop-filter: blur(10px);
    }
    
    .close-story-btn {
        position: absolute;
        top: 20px;
        right: 20px;
        width: 40px;
        height: 40px;
        border-radius: 50%;
        background: rgba(255,255,255,0.2);
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        z-index: 10;
    }
`;
document.head.appendChild(storiesStyles);

// Добавляем HTML для просмотра историй
const storiesHTML = document.createElement('div');
storiesHTML.innerHTML = `
    <div class="stories-viewer-overlay" id="storiesViewer">
        <div class="stories-viewer">
            <div class="story-progress-container" id="storyProgressContainer"></div>
            <button class="close-story-btn" onclick="closeStoriesViewer()">✕</button>
            
            <div class="story-user-info">
                <div class="story-user-avatar">?</div>
                <div>
                    <div class="story-user-name">User</div>
                    <div class="story-time">0 мин назад</div>
                </div>
            </div>
            
            <div class="story-media" id="storyViewer"></div>
            
            <div class="story-caption"></div>
            
            <div class="story-controls">
                <button class="story-nav-btn" onclick="previousStory()">←</button>
                <button class="story-nav-btn" onclick="nextStory()">→</button>
            </div>
        </div>
    </div>
`;
document.body.appendChild(storiesHTML);

console.log('✅ Истории RuChat загружены');
