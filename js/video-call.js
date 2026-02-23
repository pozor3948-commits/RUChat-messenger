/* ==========================================================
   RUCHAT - ВИДЕОЗВОНКИ WEBRTC (ИСПРАВЛЕННАЯ ВЕРСИЯ)
   Исправлено: аудио, мобильная версия, кнопка сброса
   ========================================================== */

let localVideoStream = null;
let remoteVideoStream = null;
let videoPeerConnection = null;
let isVideoCallActive = false;
let isVideoMuted = false;
let isCameraOff = false;
let videoCallStartTime = 0;
let videoCallTimer = null;
let currentVideoCallId = null;
let incomingVideoCallData = null;
let isOutgoingCall = false;

// Конфигурация WebRTC для видеозвонков
const videoRtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'openrelayproject'
        }
    ]
};

// Настройки видео и АУДИО
const mediaConstraints = {
    video: {
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 },
        facingMode: 'user'
    },
    audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        echoCancellationType: 'echoCancellation'
    }
};

/* ==========================================================
   ИНИЦИАЦИЯ ВИДЕОЗВОНКА
   ========================================================== */

async function startVideoCall() {
    if (!currentChatId || isVideoCallActive) {
        showError('Выберите чат для звонка или завершите текущий звонок');
        return;
    }
    
    try {
        console.log('📹 Начало видеозвонка пользователю:', currentChatId);
        
        isOutgoingCall = true;
        
        // Показываем UI звонка
        showVideoCallUI('calling');
        
        // Получаем доступ к камере и микрофону СРАЗУ
        await getLocalMedia();
        
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
            callId: currentVideoCallId,
            offer: null
        };
        
        await db.ref('videoCalls/' + currentChatId).set(callData);
        console.log('📞 Вызов отправлен в Firebase');
        
        // Создаем SDP offer
        const offer = await videoPeerConnection.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
        });
        
        await videoPeerConnection.setLocalDescription(offer);
        console.log('✅ Local description установлен');
        
        // Отправляем offer в Firebase
        await db.ref('videoCalls/' + currentChatId).update({
            offer: {
                type: offer.type,
                sdp: offer.sdp
            }
        });
        
        // Слушаем ответ
        listenForVideoCallAnswer();
        
    } catch (error) {
        console.error('❌ Ошибка видеозвонка:', error);
        showError('Не удалось начать видеозвонок: ' + error.message);
        endVideoCall();
    }
}

/* ==========================================================
   ПОЛУЧЕНИЕ МЕДИА (КАМЕРА + МИКРОФОН)
   ========================================================== */

async function getLocalMedia() {
    try {
        console.log('🎤 Запрос доступа к медиа...');
        
        // Для мобильных запрашиваем с правильными настройками
        if (isMobile) {
            mediaConstraints.video.width = { ideal: 480 };
            mediaConstraints.video.height = { ideal: 360 };
        }
        
        localVideoStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        console.log('✅ Медиа получено:', localVideoStream.getTracks().length, 'треков');
        
        // Отображаем локальное видео
        const localVideo = document.getElementById('localVideo');
        if (localVideo) {
            localVideo.srcObject = localVideoStream;
            localVideo.muted = true; // Обязательно! Чтобы не было эха
            localVideo.playsInline = true;
            localVideo.setAttribute('playsinline', '');
            localVideo.setAttribute('webkit-playsinline', '');
            
            // Ждём загрузки видео
            localVideo.onloadedmetadata = () => {
                console.log('✅ Локальное видео загружено');
                localVideo.play().catch(e => console.error('Ошибка play:', e));
            };
        }
        
        return true;
    } catch (error) {
        console.error('❌ Ошибка получения медиа:', error);
        
        if (error.name === 'NotAllowedError') {
            showError('Разрешите доступ к камере и микрофону в настройках браузера');
        } else if (error.name === 'NotFoundError') {
            showError('Камера или микрофон не найдены на устройстве');
        } else if (error.name === 'NotReadableError') {
            showError('Камера или микрофон заняты другим приложением');
        } else {
            showError('Ошибка доступа: ' + error.message);
        }
        
        throw error;
    }
}

/* ==========================================================
   СОЗДАНИЕ PEER CONNECTION
   ========================================================== */

function createVideoPeerConnection() {
    console.log('🔧 Создание PeerConnection...');
    
    videoPeerConnection = new RTCPeerConnection(videoRtcConfiguration);
    
    // Добавляем локальный стрим в соединение
    if (localVideoStream) {
        localVideoStream.getTracks().forEach(track => {
            console.log('➕ Добавлен трек:', track.kind, track.label);
            videoPeerConnection.addTrack(track, localVideoStream);
        });
    }
    
    // Обработка удалённого стрима
    videoPeerConnection.addEventListener('track', (event) => {
        console.log('📹 Получен удалённый трек:', event.track.kind);
        
        const remoteVideo = document.getElementById('remoteVideo');
        if (remoteVideo && event.streams && event.streams[0]) {
            remoteVideo.srcObject = event.streams[0];
            remoteVideo.playsInline = true;
            remoteVideo.setAttribute('playsinline', '');
            remoteVideo.setAttribute('webkit-playsinline', '');
            remoteVideo.muted = false; //_remote video should NOT be muted!
            
            remoteVideo.onloadedmetadata = () => {
                console.log('✅ Удалённое видео загружено');
                remoteVideo.play().catch(e => {
                    console.error('❌ Ошибка воспроизведения:', e);
                    showError('Ошибка воспроизведения видео');
                });
            };
        }
    });
    
    // Обработка ICE кандидатов
    videoPeerConnection.addEventListener('icecandidate', (event) => {
        if (event.candidate) {
            console.log('❄️ ICE кандидат:', event.candidate.type);
            sendIceCandidate(event.candidate);
        }
    });
    
    // Обработка изменений состояния
    videoPeerConnection.addEventListener('iceconnectionstatechange', () => {
        console.log('ICE состояние:', videoPeerConnection.iceConnectionState);
        
        if (videoPeerConnection.iceConnectionState === 'connected') {
            onVideoCallConnected();
        } else if (videoPeerConnection.iceConnectionState === 'disconnected' || 
                   videoPeerConnection.iceConnectionState === 'failed') {
            showError('Соединение потеряно');
            endVideoCall();
        }
    });
    
    videoPeerConnection.addEventListener('connectionstatechange', () => {
        console.log('Состояние соединения:', videoPeerConnection.connectionState);
    });
    
    console.log('✅ PeerConnection создан');
}

/* ==========================================================
   СИГНАЛИЗАЦИЯ ЧЕРЕЗ FIREBASE
   ========================================================== */

async function listenForVideoCallAnswer() {
    const callRef = db.ref('videoCalls/' + currentChatId);
    
    callRef.on('value', async (snapshot) => {
        const callData = snapshot.val();
        if (!callData) return;
        
        console.log('📊 Получены данные звонка:', callData.status);
        
        if (callData.status === 'accepted' && callData.callId === currentVideoCallId) {
            console.log('✅ Звонок принят!');
            
            if (callData.answer && !videoPeerConnection.currentRemoteDescription) {
                console.log('📥 Установка remote description...');
                const remoteDesc = new RTCSessionDescription(callData.answer);
                await videoPeerConnection.setRemoteDescription(remoteDesc);
                console.log('✅ Remote description установлен');
            }
            
            if (callData.iceCandidates && callData.iceCandidates.length > 0) {
                console.log('➕ Добавление ICE кандидатов:', callData.iceCandidates.length);
                for (const candidate of callData.iceCandidates) {
                    try {
                        await videoPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.warn('⚠️ Ошибка ICE кандидата:', e);
                    }
                }
            }
            
            callRef.off('value');
        } else if (callData.status === 'rejected') {
            console.log('❌ Звонок отклонён');
            showError('Абонент отклонил звонок');
            endVideoCall();
            callRef.off('value');
        } else if (callData.status === 'ended') {
            console.log('📞 Звонок завершён собеседником');
            endVideoCall();
            callRef.off('value');
        }
    });
}

async function sendIceCandidate(candidate) {
    const callRef = db.ref('videoCalls/' + currentChatId);
    try {
        await callRef.transaction((callData) => {
            if (callData) {
                callData.iceCandidates = callData.iceCandidates || [];
                callData.iceCandidates.push(candidate);
            }
            return callData;
        });
    } catch (e) {
        console.warn('⚠️ Ошибка отправки ICE:', e);
    }
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
            
            incomingVideoCallData = {
                key: callKey,
                caller: callData.caller,
                callId: callData.callId,
                offer: callData.offer
            };
            
            showIncomingVideoCallUI(callData.caller);
            playVideoCallRingtone();
        }
    });
}

async function acceptVideoCall() {
    if (!incomingVideoCallData) return;
    
    try {
        console.log('✅ Принятие звонка от', incomingVideoCallData.caller);
        
        const { key, caller, callId, offer } = incomingVideoCallData;
        
        isOutgoingCall = false;
        currentChatId = caller;
        currentVideoCallId = callId;
        
        // Получаем медиа
        await getLocalMedia();
        
        // Создаем Peer Connection
        createVideoPeerConnection();
        
        // Устанавливаем remote description из offer
        if (offer) {
            await videoPeerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            console.log('✅ Remote description (offer) установлен');
        }
        
        // Создаем answer
        const answer = await videoPeerConnection.createAnswer();
        await videoPeerConnection.setLocalDescription(answer);
        console.log('✅ Local description (answer) установлен');
        
        // Отправляем answer в Firebase
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
                    try {
                        await videoPeerConnection.addIceCandidate(new RTCIceCandidate(candidate));
                    } catch (e) {
                        console.warn('⚠️ Ошибка ICE:', e);
                    }
                }
            }
        });
        
        // Показываем UI активного звонка
        showVideoCallUI('connected');
        stopVideoCallRingtone();
        
        incomingVideoCallData = null;
        
        console.log('✅ Звонок принят и подключён');
    } catch (error) {
        console.error('❌ Ошибка приёма звонка:', error);
        showError('Ошибка приёма звонка: ' + error.message);
        rejectVideoCall();
    }
}

async function rejectVideoCall() {
    if (!incomingVideoCallData) return;
    
    const { key } = incomingVideoCallData;
    try {
        await db.ref('videoCalls/' + key).update({ status: 'rejected' });
    } catch (e) {}
    
    stopVideoCallRingtone();
    hideVideoCallUI();
    incomingVideoCallData = null;
    console.log('❌ Звонок отклонён');
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
            muteBtn.classList.toggle('active', isVideoMuted);
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
            cameraBtn.classList.toggle('active', isCameraOff);
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
            
            const sender = videoPeerConnection.getSenders().find(s => s.track.kind === 'video');
            if (sender) {
                sender.replaceTrack(newVideoTrack);
            }
            
            console.log('✅ Камера переключена');
        }).catch(e => console.error('❌ Ошибка переключения камеры:', e));
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
    console.log('📞 Завершение видеозвонка...');
    
    // Останавливаем таймер
    if (videoCallTimer) {
        clearInterval(videoCallTimer);
        videoCallTimer = null;
    }
    
    // Закрываем Peer Connection
    if (videoPeerConnection) {
        videoPeerConnection.close();
        videoPeerConnection = null;
        console.log('✅ PeerConnection закрыт');
    }
    
    // Останавливаем локальный стрим
    if (localVideoStream) {
        localVideoStream.getTracks().forEach(track => {
            track.stop();
            console.log('⏹️ Трек остановлен:', track.kind);
        });
        localVideoStream = null;
    }
    
    // Очищаем Firebase
    if (currentVideoCallId) {
        try {
            const targetChat = isOutgoingCall ? currentChatId : (incomingVideoCallData?.caller || currentChatId);
            await db.ref('videoCalls/' + targetChat).remove();
            console.log('✅ Firebase очищен');
        } catch (e) {}
    }
    
    // Скрываем UI
    hideVideoCallUI();
    
    // Сбрасываем переменные
    isVideoCallActive = false;
    currentVideoCallId = null;
    incomingVideoCallData = null;
    isVideoMuted = false;
    isCameraOff = false;
    isOutgoingCall = false;
    
    console.log('✅ Видеозвонок завершён');
}

function onVideoCallConnected() {
    console.log('🎉 Видеозвонок подключён!');
    isVideoCallActive = true;
    videoCallStartTime = Date.now();
    
    if (videoCallTimer) clearInterval(videoCallTimer);
    videoCallTimer = setInterval(updateVideoCallTimer, 1000);
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
    if (!container) {
        console.error('❌ videoCallContainer не найден!');
        return;
    }
    
    container.classList.add('active');
    
    const statusEl = document.getElementById('videoCallStatus');
    if (statusEl) {
        statusEl.textContent = status === 'calling' ? 'Вызов...' : 'Подключено';
    }
    
    const controls = document.getElementById('videoCallControls');
    if (controls) {
        controls.style.display = status === 'connected' ? 'flex' : 'none';
    }
    
    console.log('✅ UI звонка показан:', status);
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
    const incomingContainer = document.getElementById('incomingVideoCallContainer');
    if (incomingContainer) {
        incomingContainer.classList.remove('active');
    }
    // Не скрываем основной контейнер при endVideoCall - он скроется сам
}

function playVideoCallRingtone() {
    if (typeof playCallSound === 'function') {
        playCallSound();
    } else {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.value = 800;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.3;
            
            oscillator.start();
            setTimeout(() => oscillator.stop(), 500);
        } catch (e) {}
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
        bottom: 120px;
        right: 20px;
        width: 120px;
        height: 160px;
        z-index: 10;
        border: 2px solid rgba(255,255,255,0.3);
        border-radius: 12px;
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
        display: flex;
        gap: 15px;
        align-items: center;
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
        gap: 12px;
        z-index: 20;
        flex-wrap: wrap;
        justify-content: center;
        padding: 0 20px;
    }
    
    .video-control-btn {
        width: 56px;
        height: 56px;
        border-radius: 50%;
        border: none;
        background: rgba(255,255,255,0.2);
        backdrop-filter: blur(10px);
        color: white;
        font-size: 24px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }
    
    .video-control-btn:active {
        transform: scale(0.9);
    }
    
    .video-control-btn.active {
        background: rgba(239, 68, 68, 0.8);
    }
    
    .video-control-btn.end {
        background: #ef4444;
        width: 64px;
        height: 64px;
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
    }
    
    .incoming-video-overlay.active {
        display: flex;
    }
    
    .incoming-video-content {
        text-align: center;
        color: white;
        padding: 20px;
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
        animation: pulse 1.5s infinite;
    }
    
    .incoming-caller-name {
        font-size: 22px;
        font-weight: 700;
        margin-bottom: 30px;
    }
    
    .incoming-actions {
        display: flex;
        gap: 30px;
        justify-content: center;
    }
    
    .incoming-btn {
        width: 70px;
        height: 70px;
        border-radius: 50%;
        border: none;
        font-size: 28px;
        cursor: pointer;
        transition: all 0.2s;
    }
    
    .incoming-btn:active {
        transform: scale(0.9);
    }
    
    .incoming-btn.accept {
        background: #10b981;
        color: white;
    }
    
    .incoming-btn.reject {
        background: #ef4444;
        color: white;
    }
    
    @keyframes pulse {
        0%, 100% { transform: scale(1); }
        50% { transform: scale(1.05); }
    }
    
    /* Мобильная адаптация */
    @media (max-width: 768px) {
        .video-grid {
            grid-template-columns: 1fr;
        }
        
        .video-wrapper.local {
            width: 100px;
            height: 133px;
            bottom: 140px;
            right: 15px;
        }
        
        .video-call-controls {
            bottom: 20px;
            gap: 10px;
        }
        
        .video-control-btn {
            width: 50px;
            height: 50px;
            font-size: 20px;
        }
        
        .video-control-btn.end {
            width: 56px;
            height: 56px;
        }
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
                    <video id="remoteVideo" autoplay playsinline webkit-playsinline muted></video>
                    <div class="video-label">Собеседник</div>
                </div>
                <div class="video-wrapper local">
                    <video id="localVideo" autoplay muted playsinline webkit-playsinline></video>
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
        }, 1500);
    });
}

console.log('✅ Видеозвонки RuChat (исправленные) загружены');
