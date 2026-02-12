/* ==========================================================
   ВИДЕОСООБЩЕНИЯ
   ========================================================== */

let videoRecorder = null;
let videoChunks = [];
let videoStream = null;
let recordingTimer = null;
let recordingStartTime = 0;
let isRecordingVideo = false;
let isVideoLocked = false;
let recordStartY = 0;
let recordStartX = 0;
let videoRecordCancelled = false;
let lockActivatedAt = 0;
let currentCamera = 'user';

const videoConfig = {
    maxDuration: 60000,
    format: 'webm',
    maxSize: 50 * 1024 * 1024,
    quality: { 
        width: 480, 
        height: 480, 
        frameRate: 30 
    }
};

function initVideoMessages() {
    if (!window.MediaRecorder) {
        console.warn('MediaRecorder не поддерживается в этом браузере');
        return false;
    }
    
    checkCameraPermissions();
    
    return true;
}


async function checkCameraPermissions() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'user' },
            audio: true 
        });
        
        stream.getTracks().forEach(track => track.stop());
        
        return true;
    } catch (error) {
        console.warn('Нет доступа к камере:', error);
        return false;
    }
}

async function startVideoRecording() {
    if (!window.isSecureContext) {
        showError('Для записи нужен HTTPS (безопасный контекст). Откройте сайт по HTTPS.');
        return;
    }
    if (!window.MediaRecorder) {
        showError('MediaRecorder не поддерживается. Используйте прикрепление видеофайла.');
        attachVideo();
        return;
    }
    try {
        document.getElementById('recordTypeMenu').classList.remove('active');
        
        const constraints = {
            video: { 
                facingMode: currentCamera,
                width: { ideal: videoConfig.quality.width },
                height: { ideal: videoConfig.quality.height },
                frameRate: { ideal: videoConfig.quality.frameRate }
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        };
        
        videoStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        const videoPreview = document.getElementById('videoPreview');
        videoPreview.srcObject = videoStream;
        videoPreview.play();
        
        document.getElementById('videoRecordOverlay').style.display = 'flex';
        
        const options = {
            mimeType: 'video/webm;codecs=vp9,opus',
            audioBitsPerSecond: 128000,
            videoBitsPerSecond: 2500000
        };
        
        try {
            videoRecorder = new MediaRecorder(videoStream, options);
        } catch (e) {
            videoRecorder = new MediaRecorder(videoStream);
        }
        
        videoChunks = [];
        
        videoRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                videoChunks.push(event.data);
            }
        };
        
        videoRecorder.onstop = async () => {
            if (videoRecordCancelled) {
                cleanupVideoRecording();
                return;
            }
            const blob = new Blob(videoChunks, { type: 'video/webm' });
            
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Video = reader.result;
                await sendVideoMessage(base64Video);
                cleanupVideoRecording();
            };
            reader.readAsDataURL(blob);
        };
        
    } catch (error) {
        console.error('Ошибка при запуске камеры:', error);
        showError('Не удалось получить доступ к камере. Проверьте разрешения.');
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            const useAudioOnly = confirm('Нет доступа к камере. Записать только аудиосообщение?');
            if (useAudioOnly) {
                startAudioRecording();
            }
        }
    }
}

function updateVideoLockUI(locked) {
    const lock = document.getElementById('videoLockIndicator');
    const hint = document.getElementById('videoLockHint');
    if (!lock) return;
    lock.style.display = isRecordingVideo ? 'flex' : 'none';
    lock.classList.toggle('locked', !!locked);
    lock.classList.toggle('cancel', !!videoRecordCancelled);
    if (hint) {
        if (videoRecordCancelled) hint.textContent = 'Отпустите чтобы отменить';
        else hint.textContent = locked ? 'Запись закреплена' : 'Свайп вверх — закрепить, влево — отмена';
    }
}

function handleVideoRecordMove(event) {
    if (!isRecordingVideo || isVideoLocked) return;
    const touch = event.touches && event.touches[0];
    const y = touch ? touch.clientY : event.clientY;
    const x = touch ? touch.clientX : event.clientX;
    if (typeof y !== 'number' || typeof x !== 'number') return;
    if (!recordStartY) recordStartY = y;
    if (!recordStartX) recordStartX = x;
    const dy = recordStartY - y;
    const dx = x - recordStartX;
    if (dy > 60) {
        isVideoLocked = true;
        updateVideoLockUI(true);
    }
    if (dx < -80) {
        videoRecordCancelled = true;
        updateVideoLockUI(false);
    }
    if (event.cancelable) event.preventDefault();
}
function startVideoRecordingAction(event) {
    if (!videoRecorder) return;
    if (isRecordingVideo && isVideoLocked) {
        stopVideoRecordingAction({ forceStop: true });
        return;
    }
    if (isRecordingVideo) return;

    const touch = event && event.touches && event.touches[0];
    recordStartY = touch ? touch.clientY : (event ? event.clientY : 0);
    recordStartX = touch ? touch.clientX : (event ? event.clientX : 0);
    isVideoLocked = false;
    videoRecordCancelled = false;
    updateVideoLockUI(false);

    videoRecorder.start(1000);
    isRecordingVideo = true;
    recordingStartTime = Date.now();

    document.getElementById('recordingIndicator').style.display = 'flex';
    document.getElementById('videoRecordBtn').classList.add('recording');

    recordingTimer = setInterval(updateRecordingTimer, 1000);

    document.addEventListener('mouseup', stopVideoRecordingAction);
    document.addEventListener('touchend', stopVideoRecordingAction);
    document.addEventListener('mousemove', handleVideoRecordMove);
    document.addEventListener('touchmove', handleVideoRecordMove, { passive: false });

    setTimeout(() => {
        if (isRecordingVideo) {
            stopVideoRecordingAction({ forceStop: true });
        }
    }, videoConfig.maxDuration);
}

function updateRecordingTimer() {
    if (!isRecordingVideo) return;
    
    const elapsed = Date.now() - recordingStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    document.getElementById('videoTimer').textContent = 
        `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    
    if (elapsed > videoConfig.maxDuration - 10000) {
        document.getElementById('videoTimer').style.color = '#ef4444';
        document.getElementById('videoTimer').style.animation = 'pulse 1s infinite';
    }
}

function stopVideoRecordingAction(event) {
    const forceStop = event && event.forceStop;
    if (videoRecordCancelled) {
        cancelVideoRecording();
        return;
    }
    if (isVideoLocked && !forceStop) return;

    if (event && typeof event.preventDefault === "function") {
        event.preventDefault();
        event.stopPropagation();
    }

    if (!isRecordingVideo || !videoRecorder) return;

    videoRecorder.stop();
    isRecordingVideo = false;
    isVideoLocked = false;
    recordStartY = 0;
    recordStartX = 0;
    videoRecordCancelled = false;

    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }

    document.getElementById('recordingIndicator').style.display = 'none';
    document.getElementById('videoRecordBtn').classList.remove('recording');
    document.getElementById('videoRecordOverlay').style.display = 'none';
    updateVideoLockUI(false);

    document.removeEventListener('mouseup', stopVideoRecordingAction);
    document.removeEventListener('touchend', stopVideoRecordingAction);
    document.removeEventListener('mousemove', handleVideoRecordMove);
    document.removeEventListener('touchmove', handleVideoRecordMove);

    showNotification('Видеосообщение отправляется...', '');
}

async function toggleCamera() {
    if (isRecordingVideo) {
        showError('Остановите запись, чтобы переключить камеру');
        return;
    }

    currentCamera = currentCamera === 'user' ? 'environment' : 'user';

    if (!videoStream) return;

    try {
        videoStream.getTracks().forEach(track => track.stop());
    } catch (e) {}

    const constraints = {
        video: {
            facingMode: currentCamera,
            width: { ideal: videoConfig.quality.width },
            height: { ideal: videoConfig.quality.height },
            frameRate: { ideal: videoConfig.quality.frameRate }
        },
        audio: true
    };

    videoStream = await navigator.mediaDevices.getUserMedia(constraints);

    const videoPreview = document.getElementById('videoPreview');
    if (videoPreview) {
        videoPreview.srcObject = videoStream;
        videoPreview.play();
    }
}

function cleanupVideoRecording() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    
    videoRecorder = null;
    videoChunks = [];
    isRecordingVideo = false;
    isVideoLocked = false;
    recordStartY = 0;
    
    if (recordingTimer) {
        clearInterval(recordingTimer);
        recordingTimer = null;
    }
    
    const videoPreview = document.getElementById('videoPreview');
    if (videoPreview) {
        videoPreview.srcObject = null;
    }
    document.removeEventListener('mouseup', stopVideoRecordingAction);
    document.removeEventListener('touchend', stopVideoRecordingAction);
    document.removeEventListener('mousemove', handleVideoRecordMove);
    document.removeEventListener('touchmove', handleVideoRecordMove);
}

function cancelVideoRecording() {
    videoRecordCancelled = true;
    if (videoRecorder && videoRecorder.state !== 'inactive') {
        videoRecorder.stop();
    }
    
    cleanupVideoRecording();
    document.getElementById('videoRecordOverlay').style.display = 'none';
    updateVideoLockUI(false);
    document.getElementById('recordTypeMenu').classList.remove('active');
}

async function sendVideoMessage(videoData) {
    if (!checkConnection() || !currentChatId || !chatRef) {
        showError('Невозможно отправить сообщение');
        return;
    }
    
    showLoading();
    
    try {
        const message = {
            from: username,
            text: '🎥 Видеосообщение',
            video: videoData,
            time: Date.now(),
            sent: true,
            delivered: false,
            read: false,
            status: 'sent',
            type: 'video_message',
            duration: Math.floor((Date.now() - recordingStartTime) / 1000)
        };
        const expiresAt = typeof getEphemeralExpiresAt === 'function' ? getEphemeralExpiresAt() : null;
        if (expiresAt) message.expiresAt = expiresAt;
        if (typeof replyToMessage !== 'undefined' && replyToMessage) {
            message.replyTo = { id: replyToMessage.id, from: replyToMessage.from, text: replyToMessage.text };
        }
        
        await chatRef.push(message);
        showNotification('Успешно', 'Видеосообщение отправлено!');
        if (typeof clearReply === 'function') clearReply();
        
        if (typeof playSendSound === 'function') {
            playSendSound();
        }
        
    } catch (error) {
        console.error('Ошибка отправки видеосообщения:', error);
        showError('Не удалось отправить видеосообщение', () => sendVideoMessage(videoData));
    } finally {
        hideLoading();
    }
}


function playVideoMessage(videoUrl) {
    const modal = document.createElement('div');
    modal.className = 'video-playback-overlay';
    modal.innerHTML = `
        <div class="video-playback-modal">
            <button class="close-btn" onclick="this.parentElement.parentElement.remove()">✕</button>
            <video src="${videoUrl}" controls autoplay></video>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
}

function initVideoMessagesAfterLogin() {
    setTimeout(() => {
        if (initVideoMessages()) {
            console.log('Video messages initialized');
        }
    }, 500);
}

document.addEventListener('DOMContentLoaded', () => {
    if (typeof username !== 'undefined' && username) {
        setTimeout(initVideoMessages, 1000);
    }
});




document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('videoRecordBtn');
    if (btn) {
        btn.addEventListener('click', () => {
            if (isVideoLocked && isRecordingVideo) {
                stopVideoRecordingAction({ forceStop: true });
            }
        });
    }
});




