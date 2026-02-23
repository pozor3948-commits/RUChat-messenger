[file name]: stories.js
[file content begin]
/* ==========================================================
   ФУНКЦИИ ДЛЯ ИСТОРИЙ (Instagram-like)
   ========================================================== */

// Глобальные переменные для историй
let currentStoryFile = null;
let currentStoryType = null;
let storyViewerInterval = null;
let currentStoryIndex = 0;
let currentUserStories = [];
let storyProgressInterval = null;
let viewedStories = {};

// Функция для получения текущего пользователя
function getCurrentUser() {
    return window.username || username || '';
}

// ГЛОБАЛЬНАЯ ФУНКЦИЯ loadStories
function loadStories() {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        console.warn("Не удалось загрузить истории: пользователь не авторизован");
        return;
    }
    
    const sl = document.getElementById("storiesList");
    if (!sl) {
        console.error("Элемент storiesList не найден");
        return;
    }
    
    // Очищаем список
    sl.innerHTML = '';
    
    // Добавляем кнопку создания своей истории
    addMyStoryButton(sl);
    
    // Загружаем истории друзей
    db.ref("accounts/" + currentUser + "/friends").once("value").then(snap => {
        if (!snap.exists()) {
            return;
        }
        
        let friendIndex = 0;
        const friends = [];
        snap.forEach(ch => {
            friends.push(ch.key);
        });
        
        // Загружаем истории каждого друга
        friends.forEach(friendName => {
            setTimeout(() => {
                db.ref(`accounts/${friendName}/stories`)
                    .orderByChild('timestamp')
                    .startAt(Date.now() - 24 * 60 * 60 * 1000)
                    .once("value", storiesSnap => {
                        if (storiesSnap.exists() && storiesSnap.numChildren() > 0) {
                            createFriendStoryItem(friendName, storiesSnap);
                        }
                    });
            }, friendIndex * 100);
            friendIndex++;
        });
    });
}

// Показать модальное окно создания истории
function showCreateStoryModal() {
    if (!checkConnection()) return;
    document.getElementById('storyModalOverlay').style.display = 'flex';
}

// Закрыть модальное окно создания истории
function closeStoryModal() {
    document.getElementById('storyModalOverlay').style.display = 'none';
}

// Создать фото-историю
function createPhotoStory() {
    closeStoryModal();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = (e) => handleStoryFileSelected(e.target.files[0], 'photo');
    input.click();
}

// Создать видео-историю
function createVideoStory() {
    closeStoryModal();
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'video/*';
    input.onchange = (e) => handleStoryFileSelected(e.target.files[0], 'video');
    input.click();
}

// Обработка выбранного файла для истории
function handleStoryFileSelected(file, type) {
    if (!file) return;
    
    // Проверка размера файла
    const maxSize = type === 'photo' ? 10 * 1024 * 1024 : 50 * 1024 * 1024;
    if (file.size > maxSize) {
        showError(`Файл слишком большой. Максимальный размер: ${type === 'photo' ? '10MB' : '50MB'}`);
        return;
    }
    
    currentStoryFile = file;
    currentStoryType = type;
    
    // Показать превью
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewContent = document.getElementById('storyPreviewContent');
        previewContent.innerHTML = '';
        
        if (type === 'photo') {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'contain';
            previewContent.appendChild(img);
        } else if (type === 'video') {
            const video = document.createElement('video');
            video.src = e.target.result;
            video.controls = true;
            video.autoplay = true;
            video.muted = true;
            video.style.width = '100%';
            video.style.height = '100%';
            video.style.objectFit = 'contain';
            previewContent.appendChild(video);
        }
        
        document.getElementById('storyPreviewOverlay').style.display = 'flex';
    };
    reader.readAsDataURL(file);
}

// Закрыть превью истории
function closeStoryPreview() {
    document.getElementById('storyPreviewOverlay').style.display = 'none';
    currentStoryFile = null;
    currentStoryType = null;
}

// Опубликовать историю
async function publishStory() {
    if (!currentStoryFile || !currentStoryType) return;
    
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showError("Пользователь не авторизован");
        return;
    }
    
    showLoading();
    
    try {
        const reader = new FileReader();
        reader.onload = async (e) => {
            const storyData = {
                type: currentStoryType,
                url: e.target.result,
                timestamp: Date.now(),
                duration: currentStoryType === 'video' ? await getVideoDuration(currentStoryFile) : 0,
                views: {}
            };
            
            // Сохраняем историю в Firebase
            const storyKey = `story_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            await db.ref(`accounts/${currentUser}/stories/${storyKey}`).set(storyData);
            
            // Помечаем историю как просмотренную самим пользователем
            await db.ref(`accounts/${currentUser}/stories/${storyKey}/views/${currentUser}`).set(true);
            
            showNotification('Успешно', 'История опубликована!');
            closeStoryPreview();
            
            // Перезагружаем истории
            loadStories();
            
            // Воспроизводим звук успеха
            if (typeof playSendSound === 'function') {
                playSendSound();
            }
        };
        reader.readAsDataURL(currentStoryFile);
    } catch (error) {
        console.error('Ошибка при публикации истории:', error);
        showError('Не удалось опубликовать историю');
    } finally {
        hideLoading();
    }
}

// Получить длительность видео
function getVideoDuration(file) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.onloadedmetadata = function() {
            window.URL.revokeObjectURL(video.src);
            resolve(Math.round(video.duration));
        };
        video.src = URL.createObjectURL(file);
    });
}

// Добавить кнопку своей истории
function addMyStoryButton(container) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const myStoryItem = document.createElement("div");
    myStoryItem.className = "story-item story-add-btn";
    myStoryItem.onclick = showCreateStoryModal;
    
    // Получаем URL своего аватара
    const myAvatar = document.getElementById('userAvatar');
    const avatarUrl = myAvatar && myAvatar.src ? myAvatar.src : `https://ui-avatars.com/api/?name=${encodeURIComponent(currentUser)}&background=0088cc&color=fff&size=60`;
    
    myStoryItem.innerHTML = `
        <div class="story-avatar-container">
            <img class="story-avatar" src="${avatarUrl}" alt="${currentUser}">
            <div class="story-add-icon">+</div>
        </div>
        <div class="story-name">Ваша история</div>
    `;
    
    container.appendChild(myStoryItem);
}

// Создать элемент истории друга
function createFriendStoryItem(friendName, storiesSnap) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const sl = document.getElementById("storiesList");
    if (!sl) return;
    
    // Проверяем, есть ли непросмотренные истории
    let hasUnviewed = false;
    let latestStoryTime = 0;
    
    storiesSnap.forEach(storySnap => {
        const story = storySnap.val();
        if (story.timestamp > latestStoryTime) {
            latestStoryTime = story.timestamp;
        }
        if (!story.views || !story.views[currentUser]) {
            hasUnviewed = true;
        }
    });
    
    // Показываем только истории младше 24 часов
    if (Date.now() - latestStoryTime > 24 * 60 * 60 * 1000) {
        return;
    }
    
    const storyItem = document.createElement("div");
    storyItem.className = `story-item ${hasUnviewed ? 'unviewed' : 'viewed'}`;
    storyItem.onclick = () => viewFriendStories(friendName);
    
    // Получаем аватар друга
    const friendAvatar = document.getElementById(`avatar_${friendName}`);
    const avatarUrl = friendAvatar && friendAvatar.src ? friendAvatar.src : `https://ui-avatars.com/api/?name=${encodeURIComponent(friendName)}&background=0088cc&color=fff&size=60`;
    
    storyItem.innerHTML = `
        <img class="story-avatar" src="${avatarUrl}" alt="${friendName}">
        <div class="story-name">${friendName}</div>
    `;
    
    sl.appendChild(storyItem);
}

// Просмотр историй друга
async function viewFriendStories(friendName) {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        showError("Пользователь не авторизован");
        return;
    }
    
    showLoading();
    
    try {
        const storiesSnap = await db.ref(`accounts/${friendName}/stories`)
            .orderByChild('timestamp')
            .startAt(Date.now() - 24 * 60 * 60 * 1000)
            .once("value");
        
        if (!storiesSnap.exists()) {
            showNotification('Истории', 'У пользователя нет активных историй');
            return;
        }
        
        currentUserStories = [];
        storiesSnap.forEach(storySnap => {
            const story = storySnap.val();
            story.key = storySnap.key;
            story.author = friendName;
            currentUserStories.push(story);
        });
        
        // Сортируем по времени (от старых к новым)
        currentUserStories.sort((a, b) => a.timestamp - b.timestamp);
        
        if (currentUserStories.length > 0) {
            currentStoryIndex = 0;
            showStoryViewer();
            
            // Отмечаем как просмотренную
            await markStoryAsViewed(friendName, currentUserStories[currentStoryIndex].key);
        }
    } catch (error) {
        console.error('Ошибка при загрузке историй:', error);
        showError('Не удалось загрузить истории');
    } finally {
        hideLoading();
    }
}

// Показать просмотрщик историй
function showStoryViewer() {
    if (currentUserStories.length === 0) return;
    
    const story = currentUserStories[currentStoryIndex];
    const currentUser = getCurrentUser();
    
    // Устанавливаем информацию о авторе
    document.getElementById('storyViewerName').textContent = story.author;
    document.getElementById('storyViewerTime').textContent = formatStoryTime(story.timestamp);
    
    // Устанавливаем аватар
    const friendAvatar = document.getElementById(`avatar_${story.author}`);
    const avatarUrl = friendAvatar && friendAvatar.src ? friendAvatar.src : `https://ui-avatars.com/api/?name=${encodeURIComponent(story.author)}&background=0088cc&color=fff&size=40`;
    const avatarImg = document.getElementById('storyViewerAvatar');
    avatarImg.src = avatarUrl;
    avatarImg.onerror = function() {
        this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(story.author)}&background=0088cc&color=fff&size=40`;
    };
    
    // Отображаем контент
    const contentDiv = document.getElementById('storyViewerContent');
    contentDiv.innerHTML = '';
    
    if (story.type === 'photo') {
        const img = document.createElement('img');
        img.src = story.url;
        img.alt = 'История';
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'contain';
        contentDiv.appendChild(img);
    } else if (story.type === 'video') {
        const video = document.createElement('video');
        video.src = story.url;
        video.controls = true;
        video.autoplay = true;
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.objectFit = 'contain';
        video.onended = nextStory;
        contentDiv.appendChild(video);
    }
    
    // Показываем прогресс бар
    showStoryProgress();
    
    // Показываем просмотрщик
    document.getElementById('storyViewerOverlay').style.display = 'flex';
    
    // Автоматическое переключение через 5 секунд для фото
    if (story.type === 'photo') {
        startStoryTimer(5000);
    }
    
    // Добавляем обработчики жестов
    setupStoryGestures();
}

// Показать прогресс бар
function showStoryProgress() {
    const progressBar = document.getElementById('storyProgressBar');
    progressBar.innerHTML = '';
    
    for (let i = 0; i < currentUserStories.length; i++) {
        const segment = document.createElement('div');
        segment.className = 'story-progress-segment';
        segment.style.flex = '1';
        segment.style.height = '4px';
        segment.style.margin = '0 2px';
        segment.style.backgroundColor = i < currentStoryIndex ? 'white' : 'rgba(255,255,255,.3)';
        segment.style.borderRadius = '2px';
        segment.style.overflow = 'hidden';
        progressBar.appendChild(segment);
        
        if (i === currentStoryIndex) {
            const fill = document.createElement('div');
            fill.style.width = '0%';
            fill.style.height = '100%';
            fill.style.backgroundColor = 'white';
            fill.style.transition = `width ${currentUserStories[i].type === 'photo' ? 5 : currentUserStories[i].duration || 10}s linear`;
            segment.appendChild(fill);
            
            // Запускаем анимацию
            setTimeout(() => {
                fill.style.width = '100%';
            }, 10);
        }
    }
}

// Запустить таймер для истории
function startStoryTimer(duration) {
    if (storyViewerInterval) clearInterval(storyViewerInterval);
    storyViewerInterval = setTimeout(nextStory, duration);
}

// Следующая история
function nextStory() {
    if (currentStoryIndex < currentUserStories.length - 1) {
        currentStoryIndex++;
        showStoryViewer();
        
        // Отмечаем как просмотренную
        markStoryAsViewed(currentUserStories[currentStoryIndex].author, currentUserStories[currentStoryIndex].key);
    } else {
        closeStoryViewer();
    }
}

// Предыдущая история
function prevStory() {
    if (currentStoryIndex > 0) {
        currentStoryIndex--;
        showStoryViewer();
    }
}

// Закрыть просмотрщик историй
function closeStoryViewer() {
    document.getElementById('storyViewerOverlay').style.display = 'none';
    if (storyViewerInterval) clearInterval(storyViewerInterval);
    storyViewerInterval = null;
    currentUserStories = [];
    currentStoryIndex = 0;
}

// Отметить историю как просмотренную
async function markStoryAsViewed(author, storyKey) {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    try {
        await db.ref(`accounts/${author}/stories/${storyKey}/views/${currentUser}`).set(true);
        
        // Обновляем отображение историй
        const storyItems = document.querySelectorAll('.story-item');
        storyItems.forEach(item => {
            if (item.onclick && item.onclick.toString().includes(author)) {
                item.classList.remove('unviewed');
                item.classList.add('viewed');
            }
        });
    } catch (error) {
        console.error('Ошибка при отметке истории:', error);
    }
}

// Форматирование времени истории
function formatStoryTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) {
        return 'только что';
    } else if (diff < 3600000) {
        const minutes = Math.floor(diff / 60000);
        return `${minutes} ${getMinutesText(minutes)} назад`;
    } else if (diff < 86400000) {
        const hours = Math.floor(diff / 3600000);
        return `${hours} ${getHoursText(hours)} назад`;
    } else {
        const date = new Date(timestamp);
        return date.toLocaleDateString('ru-RU', {
            hour: '2-digit',
            minute: '2-digit'
        });
    }
}

function getMinutesText(minutes) {
    if (minutes % 10 === 1 && minutes % 100 !== 11) return 'минуту';
    if ([2, 3, 4].includes(minutes % 10) && ![12, 13, 14].includes(minutes % 100)) return 'минуты';
    return 'минут';
}

function getHoursText(hours) {
    if (hours % 10 === 1 && hours % 100 !== 11) return 'час';
    if ([2, 3, 4].includes(hours % 10) && ![12, 13, 14].includes(hours % 100)) return 'часа';
    return 'часов';
}

// Настройка жестов для просмотра историй
function setupStoryGestures() {
    const viewer = document.getElementById('storyViewerOverlay');
    let startX = 0;
    let startY = 0;
    
    viewer.addEventListener('touchstart', (e) => {
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
    });
    
    viewer.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        
        const diffX = endX - startX;
        const diffY = endY - startY;
        
        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (diffX > 50) {
                prevStory();
            } else if (diffX < -50) {
                nextStory();
            }
        } else if (diffY > 50) {
            closeStoryViewer();
        }
    });
    
    // Обработка кликов для десктопа
    viewer.addEventListener('click', (e) => {
        const rect = viewer.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        
        if (x < width / 3) {
            prevStory();
        } else if (x > width * 2 / 3) {
            nextStory();
        } else if (x > width / 3 && x < width * 2 / 3) {
            nextStory();
        }
    });
}

// Очистка старых историй (старше 24 часов)
async function cleanupOldStories() {
    const currentUser = getCurrentUser();
    if (!currentUser) return;
    
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000;
    
    try {
        const storiesSnap = await db.ref(`accounts/${currentUser}/stories`).once("value");
        if (!storiesSnap.exists()) return;
        
        const updates = {};
        storiesSnap.forEach(storySnap => {
            const story = storySnap.val();
            if (story.timestamp < cutoffTime) {
                updates[`accounts/${currentUser}/stories/${storySnap.key}`] = null;
            }
        });
        
        if (Object.keys(updates).length > 0) {
            await db.ref().update(updates);
        }
    } catch (error) {
        console.error('Ошибка при очистке старых историй:', error);
    }
}

// Инициализация историй после входа
function initStoriesAfterLogin() {
    // Даем время на загрузку друзей
    setTimeout(() => {
        // Загружаем истории
        loadStories();
        
        // Очищаем старые истории
        cleanupOldStories();
        
        // Периодическая очистка старых историй (каждый час)
        setInterval(cleanupOldStories, 60 * 60 * 1000);
        
        // Периодическое обновление историй (каждые 30 секунд)
        setInterval(loadStories, 30000);
    }, 2000);
}
[file content end]

