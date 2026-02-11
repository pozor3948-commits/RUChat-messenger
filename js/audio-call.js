/* ==========================================================
   АУДИОЗВОНКИ (НОВАЯ ФУНКЦИЯ)
   ========================================================== */

// Глобальные переменные для звонков
let peerConnection = null;
let localStream = null;
let callTimer = null;
let callDuration = 0;
let isMuted = false;
let isSpeakerOn = true;
let currentCall = null;
let incomingListenerActive = false;
let pendingIncomingCall = null;
let pendingIncomingCallId = null;
const incomingHandledById = {};
let callAnswerRef = null;
let callCandidatesRef = null;

// Конфигурация STUN/TURN серверов
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
    ]
};

// Инициировать аудиозвонок
async function startAudioCall() {
    if (isGroupChat) {
        showNotification('Ошибка', 'Групповые звонки пока не поддерживаются', 'warning');
        return;
    }
    if (!currentChatId || !currentChatPartner) {
        showNotification('Ошибка', 'Выберите контакт для звонка', 'error');
        return;
    }

    try {
        // Показываем UI звонка
        showCallUI(currentChatPartner, 'outgoing');
        
        // Получаем доступ к микрофону
        localStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });

        // Создаем PeerConnection
        peerConnection = new RTCPeerConnection(rtcConfiguration);

        // Добавляем локальный поток
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Обработка удаленного потока
        peerConnection.ontrack = (event) => {
            const remoteAudio = document.createElement('audio');
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.autoplay = true;
            document.body.appendChild(remoteAudio);
        };

        // Обработка ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Отправляем candidate собеседнику через Firebase
                db.ref(`calls/${currentChatId}/candidates`).push({
                    candidate: event.candidate,
                    from: username
                });
            }
        };

        // Создаем offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Сохраняем информацию о звонке в Firebase
        const callData = {
            from: username,
            to: currentChatPartner,
            offer: {
                type: offer.type,
                sdp: offer.sdp
            },
            status: 'calling',
            timestamp: Date.now()
        };

        await db.ref(`calls/${currentChatId}`).set(callData);
        
        // Слушаем ответ
        listenForCallAnswer();
        
        // Воспроизводим звук вызова
        playCallSound();
        
    } catch (error) {
        console.error('Ошибка при инициации звонка:', error);
        
        if (error.name === 'NotAllowedError') {
            showNotification('Ошибка', 'Разрешите доступ к микрофону', 'error');
        } else {
            showNotification('Ошибка', 'Не удалось начать звонок', 'error');
        }
        
        endCall();
    }
}

// Показать UI звонка
function showCallUI(name, type) {
    const callOverlay = document.getElementById('callOverlay');
    const callAvatar = document.getElementById('callAvatar');
    const callName = document.getElementById('callName');
    const callStatus = document.getElementById('callStatus');
    const callControls = document.querySelector('.call-controls');
    const incomingControls = document.getElementById('callIncomingControls');
    
    callAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0088cc&color=fff&size=120`;
    callName.textContent = name;
    
    if (type === 'outgoing') {
        callStatus.textContent = 'Звоним...';
        if (incomingControls) incomingControls.classList.remove('active');
        if (callControls) callControls.style.display = 'flex';
    } else {
        callStatus.textContent = 'Входящий звонок...';
        if (incomingControls) incomingControls.classList.add('active');
        if (callControls) callControls.style.display = 'none';
    }
    
    callOverlay.classList.add('active');
}

// Скрыть UI звонка
function hideCallUI() {
    const callOverlay = document.getElementById('callOverlay');
    callOverlay.classList.remove('active');
    
    const callTimer = document.getElementById('callTimer');
    callTimer.style.display = 'none';
    callTimer.textContent = '00:00';
    const callControls = document.querySelector('.call-controls');
    const incomingControls = document.getElementById('callIncomingControls');
    if (callControls) callControls.style.display = 'flex';
    if (incomingControls) incomingControls.classList.remove('active');
}

// Слушать ответ на звонок
function listenForCallAnswer() {
    callAnswerRef = db.ref(`calls/${currentChatId}`);
    callAnswerRef.on('value', async (snapshot) => {
        const callData = snapshot.val();
        
        if (!callData) return;
        
        if (callData.answer && callData.status === 'connected') {
            // Собеседник ответил
            const answer = new RTCSessionDescription(callData.answer);
            await peerConnection.setRemoteDescription(answer);
            
            // Запускаем таймер
            startCallTimer();
            
            document.getElementById('callStatus').textContent = 'Соединено';
            const callControls = document.querySelector('.call-controls');
            if (callControls) callControls.style.display = 'flex';
            
            // Останавливаем звук вызова
            stopCallSound();
        } else if (callData.status === 'rejected') {
            showNotification('Звонок', 'Собеседник отклонил звонок', 'warning');
            endCall();
        } else if (callData.status === 'ended') {
            endCall();
        }
    });
    
    // Слушаем ICE candidates
    callCandidatesRef = db.ref(`calls/${currentChatId}/candidates`);
    callCandidatesRef.on('child_added', async (snapshot) => {
        const candidateData = snapshot.val();
        if (!candidateData || !candidateData.candidate) return;
        const c = candidateData.candidate;
        if (c.sdpMid == null && c.sdpMLineIndex == null) return;
        
        if (candidateData.from !== username && peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(c));
            } catch (error) {
                console.error('ICE candidate error:', error);
            }
        }
    });
}

// Принять входящий звонок
async function acceptIncomingCall(callData) {
    try {
        showCallUI(callData.from, 'incoming');
        
        // Получаем доступ к микрофону
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // Создаем PeerConnection
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });
        
        peerConnection.ontrack = (event) => {
            const remoteAudio = document.createElement('audio');
            remoteAudio.srcObject = event.streams[0];
            remoteAudio.autoplay = true;
            document.body.appendChild(remoteAudio);
        };
        
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                db.ref(`calls/${currentChatId}/candidates`).push({
                    candidate: event.candidate,
                    from: username
                });
            }
        };
        
        // Устанавливаем удаленное описание из offer
        await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
        
        // Создаем answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        // Отправляем answer через Firebase
        await db.ref(`calls/${currentChatId}`).update({
            answer: {
                type: answer.type,
                sdp: answer.sdp
            },
            status: 'connected'
        });
        
        startCallTimer();
        document.getElementById('callStatus').textContent = 'Соединено';
        const callControls = document.querySelector('.call-controls');
        if (callControls) callControls.style.display = 'flex';
        
    } catch (error) {
        console.error('Ошибка при ответе на звонок:', error);
        showNotification('Ошибка', 'Не удалось ответить на звонок', 'error');
        endCall();
    }
}

function resetCallStateLocal() {
    if (callTimer) {
        clearInterval(callTimer);
        callTimer = null;
        callDuration = 0;
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }
    document.querySelectorAll('audio').forEach(audio => {
        audio.srcObject = null;
        audio.remove();
    });
    stopCallSound();
    hideCallUI();
    isMuted = false;
    isSpeakerOn = true;
}

// Завершить звонок
async function endCall() {
    try {
        // Останавливаем таймер
        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
            callDuration = 0;
        }
        
        // Останавливаем локальный поток
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        // Закрываем peer connection
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        
        // Удаляем все audio элементы
        document.querySelectorAll('audio').forEach(audio => {
            audio.srcObject = null;
            audio.remove();
        });
        
        if (callAnswerRef) {
            callAnswerRef.off();
            callAnswerRef = null;
        }
        if (callCandidatesRef) {
            callCandidatesRef.off();
            callCandidatesRef = null;
        }

        // Обновляем статус в Firebase
        if (currentChatId) {
            await db.ref(`calls/${currentChatId}`).update({
                status: 'ended',
                endTime: Date.now()
            });
            db.ref(`calls/${currentChatId}/candidates`).remove();
            db.ref(`calls/${currentChatId}`).off();
        }
        
        // Скрываем UI
        hideCallUI();
        
        // Останавливаем звук
        stopCallSound();
        
        // Сбрасываем состояние
        isMuted = false;
        isSpeakerOn = true;
        
        showNotification('Звонок', 'Звонок завершен', 'info');
        
    } catch (error) {
        console.error('Ошибка при завершении звонка:', error);
        hideCallUI();
    }
}

// Запустить таймер звонка
function startCallTimer() {
    const timerElement = document.getElementById('callTimer');
    timerElement.style.display = 'block';
    
    callDuration = 0;
    callTimer = setInterval(() => {
        callDuration++;
        const minutes = Math.floor(callDuration / 60).toString().padStart(2, '0');
        const seconds = (callDuration % 60).toString().padStart(2, '0');
        timerElement.textContent = `${minutes}:${seconds}`;
    }, 1000);
}

// Переключить микрофон
function toggleMute() {
    if (!localStream) return;
    
    isMuted = !isMuted;
    const audioTrack = localStream.getAudioTracks()[0];
    
    if (audioTrack) {
        audioTrack.enabled = !isMuted;
    }
    
    const muteBtn = document.getElementById('muteBtn');
    
    if (isMuted) {
        muteBtn.classList.add('active');
        muteBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="1" y1="1" x2="23" y2="23"></line>
                <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6"></path>
                <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
        `;
        showNotification('Микрофон', 'Микрофон выключен', 'info');
    } else {
        muteBtn.classList.remove('active');
        muteBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
                <line x1="12" y1="19" x2="12" y2="23"></line>
                <line x1="8" y1="23" x2="16" y2="23"></line>
            </svg>
        `;
        showNotification('Микрофон', 'Микрофон включен', 'info');
    }
}

// Переключить динамик
function toggleSpeaker() {
    isSpeakerOn = !isSpeakerOn;
    
    const speakerBtn = document.getElementById('speakerBtn');
    
    if (isSpeakerOn) {
        speakerBtn.classList.remove('active');
        showNotification('Динамик', 'Динамик включен', 'info');
    } else {
        speakerBtn.classList.add('active');
        showNotification('Динамик', 'Динамик выключен', 'info');
    }
    
    // Изменяем громкость удаленного аудио
    document.querySelectorAll('audio').forEach(audio => {
        audio.volume = isSpeakerOn ? 1.0 : 0.3;
    });
}

// Звук вызова
let callSoundInterval = null;

function playCallSound() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    callSoundInterval = setInterval(() => {
        // Создаем два тона для мелодии звонка
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator1.frequency.value = 800;
        oscillator2.frequency.value = 1000;
        oscillator1.type = 'sine';
        oscillator2.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        
        oscillator1.start(audioContext.currentTime);
        oscillator2.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.5);
        oscillator2.stop(audioContext.currentTime + 0.5);
    }, 2000);
}

function stopCallSound() {
    if (callSoundInterval) {
        clearInterval(callSoundInterval);
        callSoundInterval = null;
    }
}

// Слушатель входящих звонков
function listenForIncomingCalls() {
    if (!username) return;
    if (incomingListenerActive) return;
    incomingListenerActive = true;
    
    const handleIncoming = (callId, callData) => {
        if (!callData || callData.to !== username) return;
        if (callData.status === 'calling') {
            const stamp = `${callId}_${callData.timestamp || 0}`;
            if (incomingHandledById[stamp]) return;
            incomingHandledById[stamp] = true;
            pendingIncomingCall = callData;
            pendingIncomingCallId = callId;
            showCallUI(callData.from, 'incoming');
            playCallSound();
        } else if (pendingIncomingCallId === callId && (callData.status === 'rejected' || callData.status === 'ended')) {
            pendingIncomingCall = null;
            pendingIncomingCallId = null;
            resetCallStateLocal();
        }
    };

    db.ref('calls').on('child_added', (snapshot) => handleIncoming(snapshot.key, snapshot.val()));
    db.ref('calls').on('child_changed', (snapshot) => handleIncoming(snapshot.key, snapshot.val()));
}

function acceptIncomingCallFromUI() {
    if (!pendingIncomingCall || !pendingIncomingCallId) return;
    currentChatId = pendingIncomingCallId;
    currentChatPartner = pendingIncomingCall.from;
    const incomingControls = document.getElementById('callIncomingControls');
    if (incomingControls) incomingControls.classList.remove('active');
    const callControls = document.querySelector('.call-controls');
    if (callControls) callControls.style.display = 'flex';
    stopCallSound();
    acceptIncomingCall(pendingIncomingCall);
    pendingIncomingCall = null;
    pendingIncomingCallId = null;
}

function rejectIncomingCallFromUI() {
    if (!pendingIncomingCallId) {
        resetCallStateLocal();
        return;
    }
    db.ref(`calls/${pendingIncomingCallId}`).update({ status: 'rejected' });
    pendingIncomingCall = null;
    pendingIncomingCallId = null;
    resetCallStateLocal();
}

// Инициализация при загрузке
if (typeof window !== 'undefined') {
    window.startAudioCall = startAudioCall;
    window.endCall = endCall;
    window.toggleMute = toggleMute;
    window.toggleSpeaker = toggleSpeaker;
    window.acceptIncomingCallFromUI = acceptIncomingCallFromUI;
    window.rejectIncomingCallFromUI = rejectIncomingCallFromUI;
}

console.log('Audio call module loaded');




