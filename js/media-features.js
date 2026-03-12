/* ==========================================================
   RUCHAT MEDIA FEATURES
   Медиа функции: Альбомы, Геолокация, Видеосообщения
   Версия: 2026-03-12
   ========================================================== */

/* ==========================================================
   6. АЛЬБОМЫ ФОТО (несколько фото одним сообщением)
   ========================================================== */
let photoAlbumBuffer = [];
const MAX_ALBUM_PHOTOS = 10;

function showAlbumCreator() {
    const modal = document.createElement('div');
    modal.className = 'album-create-modal-overlay';
    modal.innerHTML = `
        <div class="album-create-modal">
            <div class="album-create-header">
                <h2>Альбом фото</h2>
                <button class="close-btn" onclick="closeAlbumCreator()">✕</button>
            </div>
            <div class="album-create-body">
                <div class="album-preview" id="albumPreview"></div>
                <div class="album-actions-top">
                    <button class="login-btn" onclick="selectAlbumPhotos()">
                        📷 Добавить фото (0/${MAX_ALBUM_PHOTOS})
                    </button>
                    <input type="file" id="albumFileInput" multiple accept="image/*" 
                           style="display:none" onchange="handleAlbumFiles(this.files)"
                           max="${MAX_ALBUM_PHOTOS}">
                </div>
                <input type="text" class="album-caption-input" id="albumCaption" 
                       placeholder="Добавить подпись к альбому..." maxlength="1024">
            </div>
            <div class="album-create-actions">
                <button class="login-btn" onclick="sendAlbum()" id="sendAlbumBtn" disabled>
                    Отправить альбом
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    photoAlbumBuffer = [];
    updateAlbumPreview();
}

function selectAlbumPhotos() {
    document.getElementById('albumFileInput').click();
}

function handleAlbumFiles(files) {
    const remaining = MAX_ALBUM_PHOTOS - photoAlbumBuffer.length;
    const toAdd = Math.min(files.length, remaining);
    
    for (let i = 0; i < toAdd; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            photoAlbumBuffer.push({
                data: e.target.result,
                file: file
            });
            updateAlbumPreview();
        };
        reader.readAsDataURL(file);
    }
    
    // Очищаем input для повторного выбора
    document.getElementById('albumFileInput').value = '';
}

function updateAlbumPreview() {
    const preview = document.getElementById('albumPreview');
    if (!preview) return;
    
    if (photoAlbumBuffer.length === 0) {
        preview.innerHTML = '<div class="album-empty">Выберите фото для альбома</div>';
        document.getElementById('sendAlbumBtn').disabled = true;
        return;
    }
    
    document.getElementById('sendAlbumBtn').disabled = false;
    
    let html = '<div class="album-thumbnails">';
    photoAlbumBuffer.forEach((photo, idx) => {
        html += `
            <div class="album-thumbnail">
                <img src="${photo.data}" alt="Фото ${idx + 1}">
                <button class="album-remove-btn" onclick="removeAlbumPhoto(${idx})">✕</button>
                <div class="album-number">${idx + 1}</div>
            </div>
        `;
    });
    html += '</div>';
    
    preview.innerHTML = html;
    
    // Обновляем кнопку
    const btn = document.querySelector('.album-actions-top .login-btn');
    if (btn) {
        btn.textContent = `📷 Добавить фото (${photoAlbumBuffer.length}/${MAX_ALBUM_PHOTOS})`;
    }
}

function removeAlbumPhoto(index) {
    photoAlbumBuffer.splice(index, 1);
    updateAlbumPreview();
}

function closeAlbumCreator() {
    photoAlbumBuffer = [];
    document.querySelector('.album-create-modal-overlay')?.remove();
}

async function sendAlbum() {
    if (photoAlbumBuffer.length === 0) return;
    if (!chatRef) {
        showError('Выберите чат для отправки');
        return;
    }
    
    showLoading();
    
    const caption = document.getElementById('albumCaption').value.trim();
    const albumId = `album_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
    const albumData = {
        from: username,
        time: Date.now(),
        type: 'album',
        album: {
            id: albumId,
            caption: caption,
            photos: photoAlbumBuffer.map(p => ({
                data: p.data,
                size: p.file.size,
                name: p.file.name
            })),
            count: photoAlbumBuffer.length
        }
    };
    
    try {
        await chatRef.push(albumData);
        showNotification('Альбом', `Отправлено ${photoAlbumBuffer.length} фото`, 'success');
        closeAlbumCreator();
    } catch (e) {
        console.error('Ошибка отправки альбома:', e);
        showError('Не удалось отправить альбом');
    } finally {
        hideLoading();
    }
}

function renderAlbumMessage(albumData, messageId) {
    const { caption, photos, count } = albumData.album || {};
    
    if (!photos || photos.length === 0) return '';
    
    // Показываем первые 4 фото в сетке
    const displayPhotos = photos.slice(0, 4);
    const remaining = count - 4;
    
    let gridClass = 'album-grid-1';
    if (count === 2) gridClass = 'album-grid-2';
    else if (count === 3 || count === 4) gridClass = 'album-grid-3';
    else gridClass = 'album-grid-4';
    
    let html = `
        <div class="album-message" onclick="openAlbumViewer('${messageId}')">
            <div class="album-grid ${gridClass}">
    `;
    
    displayPhotos.forEach((photo, idx) => {
        html += `<img src="${photo.data}" alt="Фото ${idx + 1}" class="album-photo" loading="lazy">`;
    });
    
    if (remaining > 0) {
        html += `<div class="album-more">+${remaining}</div>`;
    }
    
    html += `</div>`;
    
    if (caption) {
        html += `<div class="album-caption">${escapeHtml(caption)}</div>`;
    }
    
    html += `<div class="album-footer">📷 ${count} фото</div>`;
    
    return html;
}

function openAlbumViewer(messageId) {
    // Находим сообщение с альбомом
    const messageEl = document.getElementById(`message_${messageId}`);
    if (!messageEl || !messageEl._albumData) return;
    
    const album = messageEl._albumData.album;
    
    const modal = document.createElement('div');
    modal.className = 'album-viewer-overlay';
    modal.innerHTML = `
        <div class="album-viewer">
            <div class="album-viewer-header">
                <button class="close-btn" onclick="this.closest('.album-viewer-overlay').remove()">←</button>
                <span>${album.photos.length} фото</span>
                <button class="icon-btn" onclick="downloadAlbum('${messageId}')">⬇</button>
            </div>
            <div class="album-viewer-content" id="albumViewerContent"></div>
        </div>
    `;
    
    document.body.appendChild(modal);
    renderAlbumViewer(album.photos);
}

function renderAlbumViewer(photos) {
    const content = document.getElementById('albumViewerContent');
    if (!content) return;
    
    let html = '<div class="album-photos-scroll">';
    photos.forEach((photo, idx) => {
        html += `
            <div class="album-photo-full">
                <img src="${photo.data}" alt="Фото ${idx + 1}" loading="lazy">
            </div>
        `;
    });
    html += '</div>';
    
    content.innerHTML = html;
}

/* ==========================================================
   7. ГЕОЛОКАЦИЯ
   ========================================================== */
function sendLocation() {
    if (!navigator.geolocation) {
        showError('Геолокация не поддерживается браузером');
        return;
    }
    
    if (!currentChatId) {
        showError('Сначала выберите чат');
        return;
    }
    
    showLoading();
    
    navigator.geolocation.getCurrentPosition(
        (position) => {
            hideLoading();
            const locationData = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy
            };
            sendLocationToChat(locationData.latitude, locationData.longitude);
        },
        (error) => {
            hideLoading();
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    showError('Разрешите доступ к геолокации в настройках браузера');
                    break;
                case error.POSITION_UNAVAILABLE:
                    showError('Информация о местоположении недоступна');
                    break;
                case error.TIMEOUT:
                    showError('Превышено время ожидания геолокации');
                    break;
                default:
                    showError('Ошибка определения местоположения');
            }
        },
        {
            enableHighAccuracy: false,
            timeout: 15000,
            maximumAge: 300000
        }
    );
}

function showLocationPreview(location) {
    const modal = document.createElement('div');
    modal.className = 'location-preview-modal-overlay';
    modal.innerHTML = `
        <div class="location-preview-modal">
            <div class="location-preview-header">
                <h2>Отправить местоположение</h2>
                <button class="close-btn" onclick="this.closest('.location-preview-modal-overlay').remove()">✕</button>
            </div>
            <div class="location-preview-body">
                <div class="location-map" id="locationMap">
                    <div class="location-map-placeholder">
                        📍
                        <div>${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}</div>
                        <div class="location-accuracy">Точность: ~${Math.round(location.accuracy)}м</div>
                    </div>
                </div>
                <a href="https://www.google.com/maps?q=${location.latitude},${location.longitude}" 
                   target="_blank" class="location-link">
                    Открыть в Google Maps ↗
                </a>
            </div>
            <div class="location-preview-actions">
                <button class="login-btn" onclick="sendLocationToChat(${location.latitude}, ${location.longitude})">
                    Отправить
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    window.currentLocationPreview = location;
}

function sendLocationToChat(lat, lng) {
    if (!chatRef) {
        showError('Выберите чат для отправки');
        return;
    }
    
    const locationData = {
        from: username,
        time: Date.now(),
        type: 'location',
        location: {
            latitude: lat,
            longitude: lng,
            mapUrl: `https://www.google.com/maps?q=${lat},${lng}`
        }
    };
    
    chatRef.push(locationData)
        .then(() => {
            showNotification('Геолокация', 'Местоположение отправлено', 'success');
        })
        .catch(() => {
            showError('Не удалось отправить местоположение');
        });
}

function renderLocationMessage(locationData) {
    const { latitude, longitude, mapUrl } = locationData.location || {};
    
    return `
        <div class="location-message" onclick="window.open('${escapeHtml(mapUrl)}', '_blank')">
            <div class="location-map-preview">
                <img src="https://maps.googleapis.com/maps/api/staticmap?center=${latitude},${longitude}&zoom=13&size=400x200&markers=${latitude},${longitude}&key=YOUR_API_KEY" 
                     alt="Карта" 
                     class="location-map-img"
                     onerror="this.style.display='none'; this.nextElementSibling.style.display='flex'">
                <div class="location-map-fallback" style="display:none">
                    📍 Карта
                </div>
            </div>
            <div class="location-info">
                <div class="location-name">📍 Местоположение</div>
                <div class="location-coords">${latitude.toFixed(6)}, ${longitude.toFixed(6)}</div>
            </div>
            <div class="location-action">↗</div>
        </div>
    `;
}

/* ==========================================================
   8. ВИДЕОСООБЩЕНИЯ (Кружочки как в Telegram)
   ========================================================== */
let videoMessageRecorder = null;
let videoMessageStream = null;
let videoMessageChunks = [];
const MAX_VIDEO_MESSAGE_DURATION = 60; // секунд
const MAX_VIDEO_MESSAGE_SIZE = 10 * 1024 * 1024; // 10MB

function showVideoMessageRecorder() {
    const modal = document.createElement('div');
    modal.className = 'video-message-modal-overlay';
    modal.innerHTML = `
        <div class="video-message-modal">
            <video id="videoMessagePreview" class="video-message-preview" 
                   autoplay muted playsinline></video>
            <div class="video-message-controls">
                <button class="video-message-btn record" id="videoMessageRecordBtn" 
                        ontouchstart="startVideoMessageRecording(event)" 
                        onmousedown="startVideoMessageRecording(event)">
                    ●
                </button>
                <button class="video-message-btn switch" onclick="switchVideoMessageCamera()">
                    🔄
                </button>
                <button class="video-message-btn cancel" onclick="closeVideoMessageRecorder()">
                    ✕
                </button>
            </div>
            <div class="video-message-timer" id="videoMessageTimer">00:00</div>
            <div class="video-message-hint">
                Удерживайте для записи • Свайп вверх для блокировки
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    startVideoMessagePreview();
}

async function startVideoMessagePreview() {
    try {
        videoMessageStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 640 }
            },
            audio: true
        });
        
        const video = document.getElementById('videoMessagePreview');
        if (video) {
            video.srcObject = videoMessageStream;
        }
    } catch (e) {
        console.error('Ошибка доступа к камере:', e);
        showError('Не удалось получить доступ к камере');
        closeVideoMessageRecorder();
    }
}

let videoMessageRecordingInterval = null;
let videoMessageRecordingTime = 0;
let videoMessageLocked = false;

function startVideoMessageRecording(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    videoMessageChunks = [];
    videoMessageRecordingTime = 0;
    videoMessageLocked = false;
    
    const btn = document.getElementById('videoMessageRecordBtn');
    if (btn) {
        btn.classList.add('recording');
    }
    
    // Запускаем запись
    const stream = videoMessageStream;
    if (!stream) return;
    
    const mimeType = getSupportedVideoMimeType();
    const options = mimeType ? { mimeType: mimeType } : {};
    
    try {
        videoMessageRecorder = new MediaRecorder(stream, options);
        
        videoMessageRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                videoMessageChunks.push(e.data);
            }
        };
        
        videoMessageRecorder.onstop = sendVideoMessage;
        
        videoMessageRecorder.start(1000);
        
        // Запускаем таймер
        videoMessageRecordingInterval = setInterval(() => {
            videoMessageRecordingTime++;
            updateVideoMessageTimer();
            
            if (videoMessageRecordingTime >= MAX_VIDEO_MESSAGE_DURATION) {
                stopVideoMessageRecording();
            }
        }, 1000);
        
    } catch (e) {
        console.error('Ошибка записи видео:', e);
        showError('Не удалось начать запись');
    }
}

function stopVideoMessageRecording() {
    if (videoMessageRecorder && videoMessageRecorder.state === 'recording') {
        videoMessageRecorder.stop();
    }
    
    if (videoMessageRecordingInterval) {
        clearInterval(videoMessageRecordingInterval);
        videoMessageRecordingInterval = null;
    }
    
    const btn = document.getElementById('videoMessageRecordBtn');
    if (btn) {
        btn.classList.remove('recording');
    }
}

function updateVideoMessageTimer() {
    const timer = document.getElementById('videoMessageTimer');
    if (!timer) return;
    
    const minutes = Math.floor(videoMessageRecordingTime / 60);
    const seconds = videoMessageRecordingTime % 60;
    timer.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function getSupportedVideoMimeType() {
    const types = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4'
    ];
    
    for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    
    return '';
}

async function switchVideoMessageCamera() {
    if (!videoMessageStream) return;
    
    // Останавливаем текущий поток
    videoMessageStream.getTracks().forEach(track => track.stop());
    
    // Определяем текущую камеру
    const currentTrack = videoMessageStream.getVideoTracks()[0];
    const constraints = currentTrack.getSettings();
    const facingMode = constraints.facingMode === 'user' ? 'environment' : 'user';
    
    try {
        videoMessageStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: facingMode,
                width: { ideal: 640 },
                height: { ideal: 640 }
            },
            audio: true
        });
        
        const video = document.getElementById('videoMessagePreview');
        if (video) {
            video.srcObject = videoMessageStream;
        }
    } catch (e) {
        console.error('Ошибка переключения камеры:', e);
    }
}

function closeVideoMessageRecorder() {
    stopVideoMessageRecording();
    
    if (videoMessageStream) {
        videoMessageStream.getTracks().forEach(track => track.stop());
        videoMessageStream = null;
    }
    
    document.querySelector('.video-message-modal-overlay')?.remove();
}

async function sendVideoMessage() {
    if (videoMessageChunks.length === 0) {
        closeVideoMessageRecorder();
        return;
    }
    
    const blob = new Blob(videoMessageChunks, { type: 'video/webm' });
    
    if (blob.size > MAX_VIDEO_MESSAGE_SIZE) {
        showError('Видеосообщение слишком большое');
        closeVideoMessageRecorder();
        return;
    }
    
    showLoading();
    
    const reader = new FileReader();
    reader.onload = async () => {
        const videoData = reader.result;
        
        const videoMessageData = {
            from: username,
            time: Date.now(),
            type: 'video_message',
            video: videoData,
            duration: videoMessageRecordingTime,
            thumbnail: await captureVideoThumbnail(videoMessageStream)
        };
        
        if (chatRef) {
            await chatRef.push(videoMessageData);
            showNotification('Видео', 'Видеосообщение отправлено', 'success');
        }
        
        closeVideoMessageRecorder();
        hideLoading();
    };
    
    reader.onerror = () => {
        hideLoading();
        showError('Ошибка обработки видео');
    };
    
    reader.readAsDataURL(blob);
}

async function captureVideoThumbnail(stream) {
    return new Promise((resolve) => {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.onloadeddata = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 320;
            canvas.height = 320;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, 320, 320);
            resolve(canvas.toDataURL('image/jpeg', 0.7));
        };
        video.play();
    });
}

function renderVideoMessage(videoData, thumbnail, duration) {
    const durationStr = formatVideoDuration(duration);
    
    return `
        <div class="video-message-bubble">
            <div class="video-message-wrapper" onclick="playVideoMessage(this)">
                ${thumbnail ? `<img src="${thumbnail}" class="video-message-thumbnail">` : ''}
                <video src="${videoData}" class="video-message-video" 
                       preload="metadata" playsinline webkit-playsinline></video>
                <div class="video-message-play-btn">▶</div>
                <div class="video-message-duration">${durationStr}</div>
            </div>
        </div>
    `;
}

function formatVideoDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

window.playVideoMessage = function(element) {
    const video = element.querySelector('video');
    const playBtn = element.querySelector('.video-message-play-btn');
    const thumbnail = element.querySelector('.video-message-thumbnail');
    
    if (video.paused) {
        video.play();
        if (playBtn) playBtn.style.display = 'none';
        if (thumbnail) thumbnail.style.display = 'none';
    } else {
        video.pause();
        if (playBtn) playBtn.style.display = 'flex';
        if (thumbnail) thumbnail.style.display = 'block';
    }
};

/* ==========================================================
   ЭКСПОРТ ФУНКЦИЙ
   ========================================================== */
window.showAlbumCreator = showAlbumCreator;
window.sendLocation = sendLocation;
window.showVideoMessageRecorder = showVideoMessageRecorder;
window.openAlbumViewer = openAlbumViewer;
window.downloadAlbum = function(messageId) {
    showNotification('Альбом', 'Скачивание...', 'info');
};

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    console.log('[Media Features] Загружено');
});
