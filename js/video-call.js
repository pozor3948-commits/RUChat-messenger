/* ==========================================================
   RUCHAT - ВИДЕОЗВОНКИ WEBRTC
   ========================================================== */

let localVideoStream = null;
let remoteVideoStream = null;
let videoPeerConnection = null;
let videoCallChannel = null;
let isVideoCallActive = false;
let isVideoMuted = false;
let isCameraOff = false;
let videoCallStartTime = 0;
let videoCallTimer = null;
let currentVideoCallId = null;

// Конфигурация WebRTC для видеозвонков
const videoRtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// Настройки видео
const videoConstraints = {
    video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user'
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
    }
};

/* ==========================================================
   ИНИЦИАЦИЯ ВИДЕОЗВОНКА
   ========================================================== */

async function startVideoCall() {
    if (!currentChatId || isVideoCallActive) return;
    
    try {
        // Показываем UI звонка
        showVideoCallUI('calling');
        
        // Получаем доступ к камере и микрофону
        await getLocalVideoStream();
        
        // Создаем Peer Connection
        createVideoPeerConnection();
        
        // Генерируем ID звонка
        currentVideoCallId = 'video_' + Date.now() + '_' + username;
        
        // Отправляем вызов через Firebase
        const callData = {
            caller: username,
            callee: currentChatId,
            type: 'video',
            status: 'calling',
            timestamp: Date.now(),
            callId: currentVideoCallId
        };
        
        await db.ref('videoCalls/' + currentChatId).set(callData);
        
        // Слушаем ответ
        listenForVideoCallAnswer();
        
        console.log('✅ Видеозвонок инициирован');
    } catch (error) {
        console.error('Ошибка видеозвонка:', error);
        showError('Не удалось начать видеозвонок. Проверьте доступ к камере.');
        endVideoCall();
    }
}

/* ==========================================================
   ПОЛУЧЕНИЕ ЛОКАЛЬНОГО ВИДЕО
   ========================================================== */

async function getLocalVideoStream() {
    try {
        localVideoStream = await navigator.mediaDevices.getUserMedia(videoConstraints);
        
        // Отображаем локальное видео
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = localVideoStream;
            localVideo.muted = true; // Чтобы не было эха
        }
        
        console.log('✅ Локальное видео получено');
        return true;
    } catch (error) {
        console.error('Ошибка получения видео:', error);
        
        if (error.name === 'NotAllowedError') {
            showError('Разрешите доступ к камере и микрофону');
        } else if (error.name === 'NotFoundError') {
            showError('Камера не найдена');
        } else if (error.name === 'NotReadableError') {
            showError('Камера занята другим приложением');
        }
        
        throw error;
    }
}

/* ==========================================================
   СОЗДАНИЕ PEER CONNECTION
   ========================================================== */

function createVideoPeerConnection() {
    videoPeerConnection = new RTCPeerConnection(videoRtcConfiguration);
    
    // Добавляем локальный стрим
    if (localVideoStream) {
        localVideoStream.getTracks().forEach(track => {
            videoPeerConnection.addTrack(track, localVideoStream);
        });
    }
    
    // Обработка удалённого стрима
    videoPeerConnection.addEventListener('track', (event) => {
        console.log('📹 Получен удалённый трек');
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && event.streams && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            remoteVideo.play().catch(e => console.error('Ошибка воспроизведения:', e));
        }
    });
    
    // Обработка ICE кандидатов
    videoPeerConnection.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            sendIceCandidate(event.candidate);
        }
    });
    
    // Обработка изменений состояния
    videoPeerConnection.addEventListener('connectionstatechange', () => {
        console.log('Состояние соединения:', videoPeerConnection.connectionState);
        
        if (videoPeerConnection.connectionState === 'connected') {
            onVideoCallConnected();
        } else if (videoPeerConnection.connectionState === 'disconnected' || 
                   videoPeerConnection.connectionState === 'failed') {
            endVideoCall();
        }
    });
    
    console.log('✅ Peer Connection создан');
}

/* ==========================================================
   СИГНАЛИЗАЦИЯ ЧЕРЕЗ FIREBASE
   ========================================================== */

async function listenForVideoCallAnswer() {
    const callRef = db.ref('videoCalls/' + currentChatId);
    
    callRef.on('value', async (snapshot) => {
        const callData = snapshot.val();
        if (!callData) return;
        
        if (callData.status === 'accepted' && callData.callId === currentVideoCallId) {
            // Звонок принят
            console.log('✅ Звонок принят');
            
            if (callData.offer && !videoPeerConnection.currentRemoteDescription) {
                await videoPeerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
            }
            
            if (callData.answer) {
                await videoPeerConnection.setRemoteDescription(new RTCSessionDescription(callData.answer));
            }
            
            if (callData.iceCandidates && callData.iceCandidates.length > 0) {
                for (const candidate of callData.iceCandidates) {
                    await videoPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            }
            
            callRef.off('value');
        } else if (callData.status === 'rejected') {
            // Звонок отклонён
            showError('Абонент отклонил звонок');
            endVideoCall();
            callRef.off('value');
        } else if (callData.status === 'ended') {
            // Звонок завершён
            endVideoCall();
            callRef.off('value');
        }
    });
}

async function sendIceCandidate(candidate) {
    const callRef = db.ref('videoCalls/' + currentChatId);
    await callRef.transaction((callData) => {
        if (callData) {
            callData.iceCandidates = callData.iceCandidates || [];
            callData.iceCandidates.push(candidate);
        }
        return callData;
    });
}

/* ==========================================================
   ПРИЁМ ВХОДЯЩЕГО ВИДЕОЗВОНКА
   ========================================================== */

function listenForIncomingVideoCalls() {
    if (!username) return;
    
    db.ref('videoCalls').orderByChild('callee').equalTo(username).on('child_added', async (snapshot) => {
        const callData = snapshot.val();
        const callKey = snapshot.key;
        
        if (callData && callData.status === 'calling') {
            console.log('📹 Входящий видеозвонок от', callData.caller);
            
            // Сохраняем информацию о звонке
            window.incomingVideoCall = {
                key: callKey,
                caller: callData.caller,
                callId: callData.callId
            };
            
            // Показываем UI входящего звонка
            showIncomingVideoCallUI(callData.caller);
            
            // Проигрываем звук звонка
            playVideoCallRingtone();
        }
    });
}

async function acceptVideoCall() {
    if (!window.incomingVideoCall) return;
    
    try {
        const { key, caller, callId } = window.incomingVideoCall;
        
        // Получаем локальное видео
        await getLocalVideoStream();
        
        // Создаем Peer Connection
        createVideoPeerConnection();
        
        currentChatId = caller;
        currentVideoCallId = callId;
        
        // Создаем ответ
        const answer = await videoPeerConnection.createAnswer();
        await videoPeerConnection.setLocalDescription(answer);
        
        // Обновляем запись о звонке
        const callRef = db.ref('videoCalls/' + key);
        await callRef.update({
            status: 'accepted',
            answer: {
                type: answer.type,
                sdp: answer.sdp
            },
            callee: username
        });
        
        // Слушаем ICE кандидаты
        callRef.on('value', async (snapshot) => {
            const callData = snapshot.val();
            if (callData && callData.iceCandidates) {
                for (const candidate of callData.iceCandidates) {
                    await videoPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                }
            }
        });
        
        // Показываем UI активного звонка
        showVideoCallUI('connected');
        
        // Останавливаем звук звонка
        stopVideoCallRingtone();
        
        window.incomingVideoCall = null;
        
        console.log('✅ Видеозвонок принят');
    } catch (error) {
        console.error('Ошибка приёма звонка:', error);
        rejectVideoCall();
    }
}

async function rejectVideoCall() {
    if (!window.incomingVideoCall) return;
    
    const { key } = window.incomingVideoCall;
    await db.ref('videoCalls/' + key).update({ status: 'rejected' });
    
    stopVideoCallRingtone();
    hideVideoCallUI();
    window.incomingVideoCall = null;
    
    console.log('❌ Видеозвонок отклонён');
}

/* ==========================================================
   УПРАВЛЕНИЕ ВИДЕОЗВОНКОМ
   ========================================================== */

function toggleVideoMute() {
    if (!localVideoStream) return;
    
    const audioTrack = localVideoStream.getAudioTracks()[0];
    if (audioTrack) {
        isVideoMuted = !isVideoMuted;
        audioTrack.enabled = !isVideoMuted;
        
        const muteBtn = document.getElementById('videoMuteBtn');
        if (muteBtn) {
            muteBtn.textContent = isVideoMuted ? '🔇' : '🎤';
        }
        
        console.log(isVideoMuted ? '🔇 Звук выключен' : '🔊 Звук включён');
    }
}

function toggleCamera() {
    if (!localVideoStream) return;
    
    const videoTrack = localVideoStream.getVideoTracks()[0];
    if (videoTrack) {
        isCameraOff = !isCameraOff;
        videoTrack.enabled = !isCameraOff;
        
        const cameraBtn = document.getElementById('videoCameraBtn');
        if (cameraBtn) {
            cameraBtn.textContent = isCameraOff ? '📷❌' : '📷';
        }
        
        console.log(isCameraOff ? '📷 Камера выключена' : '📹 Камера включена');
    }
}

function switchCamera() {
    if (!localVideoStream) return;
    
    const videoTrack = localVideoStream.getVideoTracks()[0];
    if (videoTrack && videoTrack.getSettings) {
        const settings = videoTrack.getSettings();
        const currentMode = settings.facingMode || 'user';
        const newMode = currentMode === 'user' ? 'environment' : 'user';
        
        // Перезапускаем видео с новой камерой
        navigator.mediaDevices.getUserMedia({
            video: { facingMode: newMode },
            audio: false
        }).then(newStream => {
            const newVideoTrack = newStream.getVideoTracks()[0];
            localVideoStream.removeTrack(videoTrack);
            localVideoStream.addTrack(newVideoTrack);
            
            const localVideo = document.getElementById('localVideo');
            if (localVideo) {
                localVideo.srcObject = localVideoStream;
            }
            
            // Отправляем новый трек через PeerConnection
            const sender = videoPeerConnection.getSenders().find(s => s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(newVideoTrack);
            }
            
            console.log('✅ Камера переключена');
        }).catch(e => console.error('Ошибка переключения камеры:', e));
    }
}

function toggleFullScreen() {
    const videoContainer = document.getElementById('videoCallContainer');
    if (videoContainer) {
        if (!document.fullscreenElement) {
            videoContainer.requestFullscreen().catch(e => console.error(e));
        } else {
            document.exitFullscreen();
        }
    }
}

/* ==========================================================
   ЗАВЕРШЕНИЕ ВИДЕОЗВОНКА
   ========================================================== */

async function endVideoCall() {
    console.log('📞 Завершение видеозвонка');
    
    // Останавливаем таймер
    if (videoCallTimer) {
        clearInterval(videoCallTimer);
        videoCallTimer = null;
    }
    
    // Закрываем Peer Connection
    if (videoPeerConnection) {
        videoPeerConnection.close();
        videoPeerConnection = null;
    }
    
    // Останавливаем локальный стрим
    if (localVideoStream) {
        localVideoStream.getTracks().forEach(track => track.stop());
        localVideoStream = null;
    }
    
    // Очищаем Firebase
    if (currentVideoCallId) {
        await db.ref('videoCalls/' + currentChatId).remove();
    }
    
    // Скрываем UI
    hideVideoCallUI();
    
    // Сбрасываем переменные
    isVideoCallActive = false;
    currentVideoCallId = null;
    isVideoMuted = false;
    isCameraOff = false;
    
    console.log('✅ Видеозвонок завершён');
}

function onVideoCallConnected() {
    isVideoCallActive = true;
    videoCallStartTime = Date.now();
    
    // Запускаем таймер
    videoCallTimer = setInterval(updateVideoCallTimer, 1000);
    
    console.log('📹 Видеозвонок подключён');
}

function updateVideoCallTimer() {
    const elapsed = Math.floor((Date.now() - videoCallStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    
    const timerEl = document.getElementById('videoCallTimer');
    if (timerEl) {
        timerEl.textContent = `${minutes}:${seconds}`;
    }
}

/* ==========================================================
   UI ВИДЕОЗВОНКА
   ========================================================== */

function showVideoCallUI(status) {
    const container = document.getElementById('videoCallContainer');
    if (!container) return;
    
    container.classList.add('active');
    
    const statusEl = document.getElementById('videoCallStatus');
    if (statusEl) {
        statusEl.textContent = status === 'calling' ? 'Вызов...' : 'Подключено';
    }
    
    // Показываем кнопки управления
    const controls = document.getElementById('videoCallControls');
    if (controls) {
        controls.style.display = status === 'connected' ? 'flex' : 'none';
    }
}

function showIncomingVideoCallUI(caller) {
    const container = document.getElementById('incomingVideoCallContainer');
    if (!container) return;
    
    container.classList.add('active');
    
    const callerEl = document.getElementById('incomingCallerName');
    if (callerEl) {
        callerEl.textContent = `${caller} звонит вам`;
    }
}

function hideVideoCallUI() {
    document.getElementById('videoCallContainer')?.classList.remove('active');
    document.getElementById('incomingVideoCallContainer')?.classList.remove('active');
}

function playVideoCallRingtone() {
    // Используем существующую функцию звонка или создаём звук
    if (typeof playCallSound === 'function') {
        playCallSound();
    }
}

function stopVideoCallRingtone() {
    if (typeof stopCallSound === 'function') {
        stopCallSound();
    }
}

/* ==========================================================
   ЭКСПОРТ ФУНКЦИЙ
   ========================================================== */

window.startVideoCall = startVideoCall;
window.acceptVideoCall = acceptVideoCall;
window.rejectVideoCall = rejectVideoCall;
window.endVideoCall = endVideoCall;
window.toggleVideoMute = toggleVideoMute;
window.toggleCamera = toggleCamera;
window.switchCamera = switchCamera;
window.toggleFullScreen = toggleFullScreen;
window.listenForIncomingVideoCalls = listenForIncomingVideoCalls;

// Добавляем стили для видеозвонков
const videoCallStyles = document.createElement('style');
videoCallStyles.textContent = `
    /* Контейнер видеозвонка */
    .video-call-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.95);
        z-index: 10000;
        display: none;
        align-items: center;
        justify-content: center;
        animation: fadeIn 0.3s ease;
    }
    
    .video-call-overlay.active {
        display: flex;
    }
    
    .video-call-container {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        position: relative;
    }
    
    /* Видео элементы */
    .video-grid {
        flex: 1;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
        padding: 10px;
    }
    
    .video-wrapper {
        position: relative;
        background: #0f172a;
        border-radius: 16px;
        overflow: hidden;
    }
    
    .video-wrapper video {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }
    
    .video-wrapper.local {
        position: absolute;
        bottom: 100px;
        right: 20px;
        width: 160px;
        height: 120px;
        z-index: 10;
        border: 2px solid rgba(255,255,255,0.3);
    }
    
    .video-label {
        position: absolute;
        bottom: 10px;
        left: 10px;
        background: rgba(0,0,0,0.6);
        color: white;
        padding: 4px 12px;
        border-radius: 20px;
        font-size: 12px;
    }
    
    /* Статус звонка */
    .video-call-status {
        position: absolute;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0,0,0,0.6);
        color: white;
        padding: 10px 20px;
        border-radius: 30px;
        font-size: 14px;
        z-index: 20;
    }
    
    .video-call-timer {
        font-weight: 600;
        color: #4ade80;
    }
    
    /* Кнопки управления */
    .video-call-controls {
        position: absolute;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 15px;
        z-index: 20;
    }
    
    .video-control-btn {
        width: 60px;
        height: 60px;
        border-radius: 50%;
        border: none;
        background: rgba(255,255,255,0.2);
        backdrop-filter: blur(10px);
        color: white;
        font-size: 24px;
        cursor: pointer;
        transition: all 0.3s;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .video-control-btn:hover {
        background: rgba(255,255,255,0.3);
        transform: scale(1.1);
    }
    
    .video-control-btn.end {
        background: #ef4444;
        width: 70px;
        height: 70px;
    }
    
    .video-control-btn.end:hover {
        background: #dc2626;
    }
    
    /* Входящий звонок */
    .incoming-video-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.9);
        z-index: 10001;
        display: none;
        align-items: center;
        justify-content: center;
        animation: pulse 2s infinite;
    }
    
    .incoming-video-overlay.active {
        display: flex;
    }
    
    .incoming-video-content {
        text-align: center;
        color: white;
    }
    
    .incoming-avatar {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: linear-gradient(135deg, #0088cc, #0ea5e9);
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 48px;
        margin: 0 auto 20px;
        animation: bounce 1s infinite;
    }
    
    .incoming-caller-name {
        font-size: 24px;
        font-weight: 700;
        margin-bottom: 30px;
    }
    
    .incoming-actions {
        display: flex;
        gap: 20px;
        justify-content: center;
    }
    
    .incoming-btn {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        border: none;
        font-size: 28px;
        cursor: pointer;
        transition: all 0.3s;
    }
    
    .incoming-btn.accept {
        background: #10b981;
        color: white;
        animation: pulse 1s infinite;
    }
    
    .incoming-btn.reject {
        background: #ef4444;
        color: white;
    }
    
    .incoming-btn:hover {
        transform: scale(1.1);
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`;
document.head.appendChild(videoCallStyles);

// Добавляем HTML для видеозвонков
const videoCallHTML = document.createElement('div');
videoCallHTML.innerHTML = `
    <!-- Активный видеозвонок -->
    <div class="video-call-overlay" id="videoCallContainer">
        <div class="video-call-container">
            <div class="video-call-status">
                <span id="videoCallStatus">Вызов...</span>
                <span class="video-call-timer" id="videoCallTimer">00:00</span>
            </div>
            
            <div class="video-grid">
                <div class="video-wrapper">
                    <video id="remoteVideo" autoplay playsinline></video>
                    <div class="video-label">Собеседник</div>
                </div>
                <div class="video-wrapper local">
                    <video id="localVideo" autoplay muted playsinline></video>
                    <div class="video-label">Вы</div>
                </div>
            </div>
            
            <div class="video-call-controls" id="videoCallControls" style="display:none;">
                <button class="video-control-btn" id="videoMuteBtn" onclick="toggleVideoMute()" title="Микрофон">🎤</button>
                <button class="video-control-btn" id="videoCameraBtn" onclick="toggleCamera()" title="Камера">📷</button>
                <button class="video-control-btn" onclick="switchCamera()" title="Сменить камеру">🔄</button>
                <button class="video-control-btn" onclick="toggleFullScreen()" title="На весь экран">⛶</button>
                <button class="video-control-btn end" onclick="endVideoCall()" title="Завершить">📞</button>
            </div>
        </div>
    </div>
    
    <!-- Входящий видеозвонок -->
    <div class="incoming-video-overlay" id="incomingVideoCallContainer">
        <div class="incoming-video-content">
            <div class="incoming-avatar">📹</div>
            <div class="incoming-caller-name" id="incomingCallerName">Абонент звонит</div>
            <div class="incoming-actions">
                <button class="incoming-btn reject" onclick="rejectVideoCall()" title="Отклонить">📞</button>
                <button class="incoming-btn accept" onclick="acceptVideoCall()" title="Принять">📞</button>
            </div>
        </div>
    </div>
`;
document.body.appendChild(videoCallHTML);

// Слушаем входящие звонки при загрузке
if (typeof db !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
            if (username) {
                listenForIncomingVideoCalls();
            }
        }, 2000);
    });
}

console.log('✅ Видеозвонки RuChat загружены');
