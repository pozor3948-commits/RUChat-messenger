/* ==========================================================
   RUCHAT STORIES
   Истории - 24-часовые истории как в Instagram/Telegram
   Версия: 2026-03-12
   ========================================================== */

let currentStoryView = null;
let storyViewInterval = null;

/* ==========================================================
   СОЗДАНИЕ ИСТОРИИ
   ========================================================== */
function showCreateStoryModal() {
    const modal = document.createElement('div');
    modal.className = 'story-create-modal-overlay';
    modal.innerHTML = `
        <div class="story-create-modal">
            <div class="story-create-header">
                <h2>Новая история</h2>
                <button class="close-btn" onclick="this.closest('.story-create-modal-overlay').remove()">✕</button>
            </div>
            <div class="story-create-body">
                <div class="story-preview" id="storyPreview">
                    <div class="story-preview-placeholder">
                        📷
                        <div>Добавьте фото или видео</div>
                    </div>
                </div>
                <div class="story-create-actions">
                    <button class="login-btn" onclick="selectStoryMedia()">
                        📷 Выбрать фото/видео
                    </button>
                    <button class="login-btn secondary" onclick="takeStoryPhoto()">
                        📸 Сделать фото
                    </button>
                    <input type="file" id="storyFileInput" accept="image/*,video/*" 
                           style="display:none" onchange="handleStoryFile(this.files)">
                </div>
                <textarea class="story-caption-input" id="storyCaption" 
                          placeholder="Добавить подпись..." maxlength="200" rows="3"></textarea>
                <div class="story-options">
                    <label class="story-checkbox">
                        <input type="checkbox" id="storyPrivate">
                        <span>Только для друзей</span>
                    </label>
                </div>
            </div>
            <div class="story-create-footer">
                <button class="login-btn" onclick="publishStory()" id="publishStoryBtn" disabled>
                    Опубликовать (24 часа)
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
}

function selectStoryMedia() {
    document.getElementById('storyFileInput').click();
}

function handleStoryFile(files) {
    if (!files || files.length === 0) return;
    
    const file = files[0];
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const mediaData = e.target.result;
        const isVideo = file.type.startsWith('video/');
        
        showStoryPreview(mediaData, isVideo);
    };
    
    reader.readAsDataURL(file);
}

async function takeStoryPhoto() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' },
            audio: false 
        });
        
        const modal = document.createElement('div');
        modal.className = 'story-camera-modal-overlay';
        modal.innerHTML = `
            <div class="story-camera-modal">
                <video id="storyCameraVideo" autoplay playsinline></video>
                <div class="story-camera-controls">
                    <button class="story-camera-btn" onclick="captureStoryPhoto()">
                        <div class="story-camera-shutter"></div>
                    </button>
                    <button class="story-camera-btn cancel" onclick="this.closest('.story-camera-modal-overlay').remove()">
                        ✕
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const video = document.getElementById('storyCameraVideo');
        video.srcObject = stream;
        
        window.storyCameraStream = stream;
    } catch (e) {
        console.error('Ошибка камеры:', e);
        showError('Не удалось получить доступ к камере');
    }
}

window.captureStoryPhoto = function() {
    const video = document.getElementById('storyCameraVideo');
    if (!video) return;
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    
    // Останавливаем камеру
    if (window.storyCameraStream) {
        window.storyCameraStream.getTracks().forEach(track => track.stop());
    }
    
    // Закрываем камеру
    document.querySelector('.story-camera-modal-overlay')?.remove();
    
    // Показываем превью
    showStoryPreview(dataUrl, false);
};

function showStoryPreview(mediaData, isVideo) {
    const preview = document.getElementById('storyPreview');
    if (!preview) return;
    
    window.currentStoryMedia = {
        data: mediaData,
        isVideo: isVideo
    };
    
    if (isVideo) {
        preview.innerHTML = `
            <video src="${mediaData}" class="story-preview-media" autoplay muted loop></video>
            <div class="story-duration-indicator">
                <div class="story-progress-bar"></div>
            </div>
        `;
    } else {
        preview.innerHTML = `
            <img src="${mediaData}" class="story-preview-media">
        `;
    }
    
    document.getElementById('publishStoryBtn').disabled = false;
}

async function publishStory() {
    if (!window.currentStoryMedia || !username) return;
    
    showLoading();
    
    const caption = document.getElementById('storyCaption').value.trim();
    const isPrivate = document.getElementById('storyPrivate').checked;
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 часа
    
    const storyData = {
        author: username,
        media: window.currentStoryMedia.data,
        isVideo: window.currentStoryMedia.isVideo,
        caption: caption,
        createdAt: Date.now(),
        expiresAt: expiresAt,
        private: isPrivate,
        views: []
    };
    
    try {
        const storyId = await db.ref(`stories/${username}`).push(storyData);
        
        // Обновляем индекс историй
        await db.ref(`storiesIndex/${username}`).update({
            hasStories: true,
            lastStoryAt: Date.now(),
            storyCount: db.ref(`stories/${username}`).once('value').then(s => s.numChildren())
        });
        
        showNotification('История', 'История опубликована!', 'success');
        document.querySelector('.story-create-modal-overlay')?.remove();
        
        // Обновляем UI историй
        loadStories();
        
    } catch (e) {
        console.error('Ошибка публикации:', e);
        showError('Не удалось опубликовать историю');
    } finally {
        hideLoading();
    }
}

/* ==========================================================
   ПРОСМОТР ИСТОРИЙ
   ========================================================== */
function viewUserStories(storyAuthor) {
    db.ref(`stories/${storyAuthor}`).once('value', snap => {
        if (!snap.exists()) {
            showError('У пользователя нет историй');
            return;
        }
        
        const stories = [];
        snap.forEach(child => {
            const story = child.val();
            story.id = child.key;
            
            // Проверяем не истекла ли история
            if (story.expiresAt > Date.now()) {
                stories.push(story);
            }
        });
        
        if (stories.length === 0) {
            showNotification('Истории', 'Нет доступных историй', 'info');
            return;
        }
        
        showStoryViewer(stories, 0, storyAuthor);
    });
}

function showStoryViewer(stories, startIndex, author) {
    const modal = document.createElement('div');
    modal.className = 'story-viewer-overlay';
    modal.innerHTML = `
        <div class="story-viewer">
            <div class="story-progress-container" id="storyProgress">
                ${stories.map((_, i) => `<div class="story-progress-segment ${i === 0 ? 'active' : ''}"><div class="story-progress-fill"></div></div>`).join('')}
            </div>
            <div class="story-viewer-header">
                <div class="story-viewer-author">
                    <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=0088cc&color=fff&size=32" 
                         class="story-viewer-avatar">
                    <span class="story-viewer-name">${author}</span>
                    <span class="story-viewer-time" id="storyTime"></span>
                </div>
                <button class="close-btn" onclick="closeStoryViewer()">✕</button>
            </div>
            <div class="story-viewer-content" id="storyViewerContent"></div>
            <div class="story-viewer-caption" id="storyViewerCaption"></div>
            <div class="story-viewer-navigation">
                <button class="story-nav-btn prev" onclick="prevStory()">◀</button>
                <button class="story-nav-btn next" onclick="nextStory()">▶</button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    currentStoryView = {
        stories: stories,
        currentIndex: startIndex,
        author: author,
        startTime: Date.now()
    };
    
    showCurrentStory();
}

function showCurrentStory() {
    if (!currentStoryView) return;
    
    const { stories, currentIndex } = currentStoryView;
    const story = stories[currentIndex];
    
    if (!story) return;
    
    const content = document.getElementById('storyViewerContent');
    const caption = document.getElementById('storyViewerCaption');
    const time = document.getElementById('storyTime');
    
    if (!content) return;
    
    // Обновляем прогресс бары
    updateStoryProgress();
    
    // Показываем контент
    if (story.isVideo) {
        content.innerHTML = `
            <video src="${story.media}" autoplay playsinline onloadstart="this.play()"></video>
        `;
        
        // Автопереключение после видео
        const video = content.querySelector('video');
        if (video) {
            video.onended = () => nextStory();
        }
    } else {
        content.innerHTML = `<img src="${story.media}" onload="startStoryTimer(${story.isVideo ? 'true' : 'false'})">`;
    }
    
    // Подпись
    if (caption) {
        caption.textContent = story.caption || '';
        caption.style.display = story.caption ? 'block' : 'none';
    }
    
    // Время
    if (time) {
        const hoursAgo = Math.floor((Date.now() - story.createdAt) / (60 * 60 * 1000));
        time.textContent = hoursAgo < 1 ? 'Только что' : `${hoursAgo}ч назад`;
    }
    
    // Отмечаем просмотр
    markStoryViewed(story.id);
}

function startStoryTimer(isVideo) {
    if (storyViewInterval) clearInterval(storyViewInterval);
    
    if (!isVideo) {
        storyViewInterval = setInterval(() => {
            nextStory();
        }, 5000); // 5 секунд на фото
    }
}

function updateStoryProgress() {
    if (!currentStoryView) return;
    
    const segments = document.querySelectorAll('.story-progress-segment');
    segments.forEach((seg, i) => {
        const fill = seg.querySelector('.story-progress-fill');
        if (i < currentStoryView.currentIndex) {
            fill.style.width = '100%';
            seg.classList.remove('active');
        } else if (i === currentStoryView.currentIndex) {
            seg.classList.add('active');
            fill.style.width = '0%';
            
            // Анимация прогресса
            setTimeout(() => {
                if (currentStoryView && currentStoryView.currentIndex === i) {
                    fill.style.transition = 'width 5s linear';
                    fill.style.width = '100%';
                }
            }, 50);
        } else {
            fill.style.width = '0%';
            seg.classList.remove('active');
        }
    });
}

function markStoryViewed(storyId) {
    if (!currentStoryView || !username) return;
    
    db.ref(`stories/${currentStoryView.author}/${storyId}/views`).once('value', snap => {
        const views = snap.val() || {};
        if (!views[username]) {
            views[username] = Date.now();
            db.ref(`stories/${currentStoryView.author}/${storyId}/views`).update(views);
        }
    });
}

window.nextStory = function() {
    if (!currentStoryView) return;
    
    if (storyViewInterval) clearInterval(storyViewInterval);
    
    currentStoryView.currentIndex++;
    
    if (currentStoryView.currentIndex >= currentStoryView.stories.length) {
        closeStoryViewer();
    } else {
        showCurrentStory();
    }
};

window.prevStory = function() {
    if (!currentStoryView) return;
    
    if (storyViewInterval) clearInterval(storyViewInterval);
    
    if (currentStoryView.currentIndex > 0) {
        currentStoryView.currentIndex--;
        showCurrentStory();
    } else {
        // Возврат к предыдущей истории
        currentStoryView.currentIndex = 0;
        showCurrentStory();
    }
};

window.closeStoryViewer = function() {
    if (storyViewInterval) clearInterval(storyViewInterval);
    currentStoryView = null;
    document.querySelector('.story-viewer-overlay')?.remove();
};

/* ==========================================================
   ОТОБРАЖЕНИЕ ИСТОРИЙ В САЙДБАРЕ
   ========================================================== */
function loadStoriesForSidebar() {
    // Проверяем что db доступен
    const db = window.db || (typeof firebase !== 'undefined' ? firebase.database() : null);
    if (!db) {
        console.error('[Stories] Firebase database не доступен');
        return;
    }
    
    const container = document.getElementById('storiesContainer');
    if (!container) {
        console.log('[Stories] storiesContainer не найден');
        return;
    }

    const list = document.getElementById('storiesList');
    if (!list) {
        console.log('[Stories] storiesList не найден');
        return;
    }

    // Показываем контейнер
    container.style.display = 'block';

    // Загружаем истории из Firebase
    db.ref('storiesIndex').once('value', snap => {
        if (!snap.exists()) {
            // Нет историй - показываем только кнопку создания
            list.innerHTML = `
                <div class="story-item story-item-add" onclick="showCreateStoryModal()">
                    <div class="story-avatar-ring add">
                        <div class="story-add-icon">+</div>
                    </div>
                    <div class="story-author">Моя история</div>
                </div>
            `;
            return;
        }
        
        const storiesIndex = snap.val();
        
        let html = '';
        
        // Моя история (кнопка создания)
        html += `
            <div class="story-item story-item-add" onclick="showCreateStoryModal()">
                <div class="story-avatar-ring add">
                    <div class="story-add-icon">+</div>
                </div>
                <div class="story-author">Моя история</div>
            </div>
        `;
        
        // Истории других пользователей
        Object.keys(storiesIndex).forEach(author => {
            const data = storiesIndex[author];
            if (data.hasStories && author !== username) {
                html += `
                    <div class="story-item" onclick="viewUserStories('${author}')">
                        <div class="story-avatar-ring">
                            <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=0088cc&color=fff&size=56" 
                                 class="story-avatar">
                        </div>
                        <div class="story-author">${author}</div>
                    </div>
                `;
            }
        });
        
        list.innerHTML = html;
    }).catch(err => {
        console.error('[Stories] Ошибка загрузки:', err);
    });
}

window.loadStoriesForSidebar = loadStoriesForSidebar;

/* ==========================================================
   ЭКСПОРТ ФУНКЦИЙ
   ========================================================== */
window.showCreateStoryModal = showCreateStoryModal;
window.viewUserStories = viewUserStories;
window.closeStoryViewer = closeStoryViewer;
window.nextStory = nextStory;
window.prevStory = prevStory;
window.loadStoriesForSidebar = loadStoriesForSidebar;
window.selectStoryMedia = selectStoryMedia;
window.takeStoryPhoto = takeStoryPhoto;
window.publishStory = publishStory;

console.log('[Stories] Все функции экспортированы');

// Автоочистка историй
setInterval(() => {
    const now = Date.now();
    db.ref('stories').once('value', snap => {
        snap.forEach(userSnap => {
            const author = userSnap.key;
            userSnap.forEach(storySnap => {
                const story = storySnap.val();
                if (story.expiresAt && story.expiresAt < now) {
                    db.ref(`stories/${author}/${storySnap.key}`).remove();
                }
            });
        });
    });
}, 60000); // Проверяем каждую минуту

// Загрузка при старте
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Stories] Модуль загружен, инициализация...');
    // Не вызываем loadStoriesForSidebar здесь - это будет сделано из index.html
    // Обновляем каждые 30 секунд
    setInterval(() => {
        if (typeof loadStoriesForSidebar === 'function') {
            loadStoriesForSidebar();
        }
    }, 30000);
});
