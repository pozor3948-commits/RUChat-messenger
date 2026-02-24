/* ==========================================================
   АУДИОЗВОНКИ (WebRTC)
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
let remoteAudioEl = null;
let ringtoneAudio = null;
let ringbackAudio = null;
let ringtoneInterval = null;
let callSoundInterval = null;

// Очередь для ICE кандидатов (чтобы добавлять после установки remote description)
let iceCandidateQueue = [];

function ensureRemoteAudioEl() {
    if (!remoteAudioEl) {
        remoteAudioEl = document.createElement('audio');
        remoteAudioEl.autoplay = true;
        remoteAudioEl.playsInline = true;
        remoteAudioEl.setAttribute('playsinline', 'true');
        remoteAudioEl.setAttribute('autoplay', 'true');
        remoteAudioEl.volume = 1.0;
        document.body.appendChild(remoteAudioEl);
    }
}

// Конфигурация STUN/TURN серверов
const rtcConfiguration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
        { urls: 'stun:stun3.l.google.com:19302' }
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
    
    // Проверка поддержки WebRTC
    if (!window.RTCPeerConnection) {
        showError('WebRTC не поддерживается в этом браузере');
        return;
    }
    
    // Проверка поддержки getUserMedia
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError('Ваш браузер не поддерживает аудиозвонки');
        return;
    }

    try {
        // Показываем UI звонка
        showCallUI(currentChatPartner, 'outgoing');
        ensureRemoteAudioEl();

        // Получаем доступ к микрофону
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                },
                video: false
            });
        } catch (mediaError) {
            console.error('Ошибка доступа к микрофону:', mediaError);
            let errorMsg = 'Не удалось получить доступ к микрофону. ';
            if (mediaError.name === 'NotAllowedError') {
                errorMsg += 'Разрешите доступ в настройках браузера.';
            } else if (mediaError.name === 'NotFoundError') {
                errorMsg += 'Микрофон не найден.';
            } else {
                errorMsg += mediaError.message;
            }
            showError(errorMsg);
            hideCallUI();
            return;
        }

        // Создаем PeerConnection
        try {
            peerConnection = new RTCPeerConnection(rtcConfiguration);
        } catch (pcError) {
            console.error('Ошибка создания PeerConnection:', pcError);
            showError('Не удалось создать соединение: ' + pcError.message);
            if (localStream) {
                localStream.getTracks().forEach(track => track.stop());
            }
            hideCallUI();
            return;
        }

        // Добавляем локальный поток
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Обработка удаленного потока
        peerConnection.ontrack = (event) => {
            ensureRemoteAudioEl();
            remoteAudioEl.srcObject = event.streams[0];
            remoteAudioEl.volume = 1.0;
            remoteAudioEl.muted = false;
            remoteAudioEl.play().catch(() => {});
        };

        peerConnection.onconnectionstatechange = () => {
            if (peerConnection.connectionState === 'failed') {
                showNotification('Звонок', 'Соединение не удалось', 'error');
                endCall();
            } else if (peerConnection.connectionState === 'disconnected') {
                showNotification('Звонок', 'Соединение разорвано', 'warning');
            }
        };

        // Обработка ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                // Отправляем candidate собеседнику через Firebase
                db.ref(`calls/${currentChatId}/candidates`).push({
                    candidate: event.candidate,
                    from: username
                }).catch(e => console.warn('Не удалось отправить ICE candidate:', e));
            }
        };

        // Создаем offer
        let offer;
        try {
            offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
        } catch (sdpError) {
            console.error('Ошибка создания SDP:', sdpError);
            showError('Ошибка при создании звонка: ' + sdpError.message);
            endCall();
            return;
        }

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
        
        // Воспроизводим гудки
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
        if (incomingControls) incomingControls.style.display = 'none';
        if (callControls) callControls.style.display = 'flex';
    } else if (type === 'incoming') {
        callStatus.textContent = 'Входящий звонок...';
        if (incomingControls) incomingControls.classList.add('active');
        if (incomingControls) incomingControls.style.display = 'flex';
        if (callControls) callControls.style.display = 'none';
    } else if (type === 'connected') {
        if (incomingControls) incomingControls.classList.remove('active');
        if (incomingControls) incomingControls.style.display = 'none';
        if (callControls) callControls.style.display = 'flex';
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
    if (incomingControls) {
        incomingControls.classList.remove('active');
        incomingControls.style.display = 'none';
    }
}

// Слушать ответ на звонок
function listenForCallAnswer() {
    if (!currentChatId) return;
    
    callAnswerRef = db.ref(`calls/${currentChatId}`);
    callAnswerRef.on('value', async (snapshot) => {
        const callData = snapshot.val();

        if (!callData) return;

        // Обработка ответа (answer)
        if (callData.answer && callData.status === 'connected') {
            if (peerConnection) {
                try {
                    const current = peerConnection.remoteDescription;
                    if (!current) {
                        // Устанавливаем remote description впервые
                        const answer = new RTCSessionDescription(callData.answer);
                        await peerConnection.setRemoteDescription(answer);
                        console.log('Remote answer установлен');
                        
                        // Обрабатываем очередь ICE кандидатов
                        await processIceCandidateQueue();
                    }
                } catch (error) {
                    console.error('Ошибка установки remote answer:', error);
                }
            }

            // Запускаем таймер
            startCallTimer();

            document.getElementById('callStatus').textContent = 'Соединено';
            const callControls = document.querySelector('.call-controls');
            if (callControls) callControls.style.display = 'flex';

            // Останавливаем гудки
            stopCallSound();
            stopRingtone();
        } else if (callData.status === 'rejected') {
            showNotification('Звонок', 'Собеседник отклонил звонок', 'warning');
            endCall();
        } else if (callData.status === 'ended') {
            endCall();
        }
    });

    // Слушаем ICE candidates от собеседника
    callCandidatesRef = db.ref(`calls/${currentChatId}/candidates`);
    callCandidatesRef.on('child_added', async (snapshot) => {
        const candidateData = snapshot.val();
        if (!candidateData || !candidateData.candidate) return;
        
        const c = candidateData.candidate;
        // Пропускаем кандидатов не от собеседника
        if (candidateData.from === username) return;
        
        // Проверяем наличие обязательных полей
        if (c.sdpMid == null && c.sdpMLineIndex == null) return;

        if (peerConnection) {
            try {
                // Если remote description ещё не установлен, добавляем в очередь
                if (!peerConnection.remoteDescription) {
                    iceCandidateQueue.push(c);
                    console.log('ICE кандидат добавлен в очередь:', c.sdpMLineIndex);
                } else {
                    // Устанавливаем кандидата
                    await peerConnection.addIceCandidate(new RTCIceCandidate(c));
                }
            } catch (error) {
                console.error('ICE candidate error:', error, c);
            }
        }
    });
}

// Обработка очереди ICE кандидатов
async function processIceCandidateQueue() {
    if (!peerConnection || iceCandidateQueue.length === 0) return;
    
    console.log('Обработка очереди ICE кандидатов:', iceCandidateQueue.length);
    
    for (const candidate of iceCandidateQueue) {
        try {
            await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (error) {
            console.error('Ошибка добавления ICE кандидата из очереди:', error);
        }
    }
    
    iceCandidateQueue = [];
}

// Принять входящий звонок
async function acceptIncomingCall(callData) {
    try {
        console.log('Принимаем входящий звонок от:', callData.from);
        
        ensureRemoteAudioEl();
        
        // Очищаем очередь ICE кандидатов
        iceCandidateQueue = [];
        
        // Получаем доступ к микрофону
        try {
            localStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
        } catch (mediaError) {
            console.error('Ошибка доступа к микрофону:', mediaError);
            showError('Не удалось получить доступ к микрофону');
            endCall();
            return;
        }

        // Создаем PeerConnection
        peerConnection = new RTCPeerConnection(rtcConfiguration);

        // Добавляем локальный поток
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
        });

        // Обработка удаленного потока
        peerConnection.ontrack = (event) => {
            console.log('Получен удаленный трек');
            ensureRemoteAudioEl();
            remoteAudioEl.srcObject = event.streams[0];
            remoteAudioEl.volume = 1.0;
            remoteAudioEl.muted = false;
            remoteAudioEl.play().catch(e => console.warn('Ошибка воспроизведения:', e));
        };

        // Обработка состояния соединения
        peerConnection.onconnectionstatechange = () => {
            console.log('Состояние соединения:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'failed' || peerConnection.connectionState === 'disconnected') {
                showNotification('Звонок', 'Соединение разорвано', 'warning');
                endCall();
            } else if (peerConnection.connectionState === 'connected') {
                document.getElementById('callStatus').textContent = 'Соединено';
            }
        };

        // Обработка ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Отправляем ICE кандидат');
                db.ref(`calls/${currentChatId}/candidates`).push({
                    candidate: event.candidate,
                    from: username
                }).catch(e => console.warn('Не удалось отправить ICE candidate:', e));
            }
        };

        // Устанавливаем remote description из offer
        try {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
            console.log('Remote offer установлен');
        } catch (error) {
            console.error('Ошибка установки remote offer:', error);
            showError('Ошибка при установке соединения');
            endCall();
            return;
        }

        // Создаем answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('Local answer установлен');

        // Отправляем answer через Firebase
        await db.ref(`calls/${currentChatId}`).update({
            answer: {
                type: answer.type,
                sdp: answer.sdp
            },
            status: 'connected'
        });
        console.log('Answer отправлен в Firebase');

        // Слушаем завершение звонка
        if (!callAnswerRef) {
            callAnswerRef = db.ref(`calls/${currentChatId}`);
            callAnswerRef.on('value', (snapshot) => {
                const data = snapshot.val();
                if (data && data.status === 'ended') {
                    endCall();
                }
            });
        }

        // Слушаем ICE candidates от звонящего
        callCandidatesRef = db.ref(`calls/${currentChatId}/candidates`);
        callCandidatesRef.on('child_added', async (snapshot) => {
            const candidateData = snapshot.val();
            if (!candidateData || !candidateData.candidate) return;
            if (candidateData.from === username) return;
            
            const c = candidateData.candidate;
            if (c.sdpMid == null && c.sdpMLineIndex == null) return;

            if (peerConnection) {
                try {
                    if (!peerConnection.remoteDescription) {
                        iceCandidateQueue.push(c);
                    } else {
                        await peerConnection.addIceCandidate(new RTCIceCandidate(c));
                    }
                } catch (error) {
                    console.error('ICE candidate error:', error);
                }
            }
        });

        // Обрабатываем очередь ICE кандидатов после установки remote description
        setTimeout(async () => {
            await processIceCandidateQueue();
        }, 500);

        stopRingtone();
        startCallTimer();
        document.getElementById('callStatus').textContent = 'Соединяется...';
        showCallUI(callData.from, 'connected');

    } catch (error) {
        console.error('Ошибка при ответе на звонок:', error);
        showError('Не удалось ответить на звонок');
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
    if (remoteAudioEl) {
        remoteAudioEl.srcObject = null;
        remoteAudioEl.remove();
        remoteAudioEl = null;
    }
    stopCallSound();
    stopRingtone();
    hideCallUI();
    isMuted = false;
    isSpeakerOn = true;
}

// Завершить звонок
async function endCall() {
    console.log('Завершаем звонок');
    
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

        // Очищаем аудио элемент
        if (remoteAudioEl) {
            remoteAudioEl.srcObject = null;
            remoteAudioEl.remove();
            remoteAudioEl = null;
        }

        // Отключаем слушатели Firebase
        if (callAnswerRef) {
            callAnswerRef.off();
            callAnswerRef = null;
        }
        if (callCandidatesRef) {
            callCandidatesRef.off();
            callCandidatesRef = null;
        }

        // Очищаем очередь ICE кандидатов
        iceCandidateQueue = [];

        // Обновляем статус в Firebase
        if (currentChatId) {
            try {
                await db.ref(`calls/${currentChatId}`).update({
                    status: 'ended',
                    endTime: Date.now()
                });
                // Очищаем candidates только через некоторое время (для отладки)
                setTimeout(() => {
                    db.ref(`calls/${currentChatId}/candidates`).remove().catch(() => {});
                }, 5000);
            } catch (e) {
                console.warn('Не удалось обновить статус звонка:', e);
            }
        }

        // Скрываем UI
        hideCallUI();

        // Останавливаем звуки
        stopCallSound();
        stopRingtone();

        // Сбрасываем состояние
        isMuted = false;
        isSpeakerOn = true;
        
        // Сбрасываем currentChatId только если это не группа
        if (!isGroupChat) {
            currentChatId = null;
            currentChatPartner = null;
        }

    } catch (error) {
        console.error('Ошибка при завершении звонка:', error);
        hideCallUI();
    }
}

// Запустить таймер звонка
function startCallTimer() {
    const timerElement = document.getElementById('callTimer');
    timerElement.style.display = 'block';
    
    if (callTimer) {
        clearInterval(callTimer);
    }
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
    if (remoteAudioEl) {
        remoteAudioEl.volume = isSpeakerOn ? 1.0 : 0.3;
    }
}

// Звук вызова
let callSoundInterval = null;

function ensureLoopAudio(existing, src, volume) {
    if (existing) return existing;
    const a = new Audio(src);
    a.loop = true;
    a.preload = 'auto';
    a.volume = volume;
    a.playsInline = true;
    a.setAttribute('playsinline', 'true');
    return a;
}

function fallbackBeep(intervalRef, volume = 0.25) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    return setInterval(() => {
        const osc1 = audioContext.createOscillator();
        const osc2 = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(audioContext.destination);
        osc1.frequency.value = 800;
        osc2.frequency.value = 1000;
        osc1.type = 'sine';
        osc2.type = 'sine';
        gain.gain.setValueAtTime(volume, audioContext.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
        osc1.start(audioContext.currentTime);
        osc2.start(audioContext.currentTime);
        osc1.stop(audioContext.currentTime + 0.5);
        osc2.stop(audioContext.currentTime + 0.5);
    }, 2000);
}

function playCallSound() {
    stopCallSound();
    ringbackAudio = ensureLoopAudio(ringbackAudio, 'assets/ringback.mp3', 0.35);
    ringbackAudio.currentTime = 0;
    ringbackAudio.play().catch(() => {
        callSoundInterval = fallbackBeep(callSoundInterval, 0.25);
    });
}

function stopCallSound() {
    if (ringbackAudio) {
        ringbackAudio.pause();
        ringbackAudio.currentTime = 0;
    }
    if (callSoundInterval) {
        clearInterval(callSoundInterval);
        callSoundInterval = null;
    }
}

function playRingtone() {
    stopRingtone();
    ringtoneAudio = ensureLoopAudio(ringtoneAudio, 'assets/ringtone.mp3', 0.6);
    ringtoneAudio.currentTime = 0;
    ringtoneAudio.play().catch(() => {
        ringtoneInterval = fallbackBeep(ringtoneInterval, 0.35);
    });
}

function stopRingtone() {
    if (ringtoneAudio) {
        ringtoneAudio.pause();
        ringtoneAudio.currentTime = 0;
    }
    if (ringtoneInterval) {
        clearInterval(ringtoneInterval);
        ringtoneInterval = null;
    }
}

// Слушатель входящих звонков
function listenForIncomingCalls() {
    if (!username) return;
    if (incomingListenerActive) return;
    incomingListenerActive = true;

    console.log('Слушаем входящие звонки для:', username);

    const handleIncoming = (callId, callData) => {
        if (!callData) return;
        if (callData.to !== username) return;
        
        // Игнорируем звонки, где мы инициатор
        if (callData.from === username) return;
        
        const stamp = `${callId}_${callData.timestamp || 0}`;
        
        if (callData.status === 'calling') {
            if (incomingHandledById[stamp]) return;
            incomingHandledById[stamp] = true;
            
            console.log('Входящий звонок от:', callData.from, 'callId:', callId);
            
            pendingIncomingCall = callData;
            pendingIncomingCallId = callId;
            currentChatId = callId;
            currentChatPartner = callData.from;
            
            showCallUI(callData.from, 'incoming');
            playRingtone();
            
            // Автоматически скрываем UI если звонок не принят через 60 секунд
            setTimeout(() => {
                if (pendingIncomingCallId === callId && pendingIncomingCall) {
                    console.log('Входящий звонок просрочен');
                    pendingIncomingCall = null;
                    pendingIncomingCallId = null;
                    hideCallUI();
                }
            }, 60000);
            
        } else if (pendingIncomingCallId === callId) {
            if (callData.status === 'rejected' || callData.status === 'ended') {
                console.log('Звонок отклонён или завершён');
                pendingIncomingCall = null;
                pendingIncomingCallId = null;
                resetCallStateLocal();
            }
        }
    };

    // Слушаем все звонки
    const callsRef = db.ref('calls');
    callsRef.on('child_added', (snapshot) => {
        handleIncoming(snapshot.key, snapshot.val());
    });
    
    callsRef.on('child_changed', (snapshot) => {
        handleIncoming(snapshot.key, snapshot.val());
    });
    
    console.log('Слушатель входящих звонков активирован');
}

function acceptIncomingCallFromUI() {
    if (!pendingIncomingCall || !pendingIncomingCallId) return;
    currentChatId = pendingIncomingCallId;
    currentChatPartner = pendingIncomingCall.from;
    showCallUI(pendingIncomingCall.from, 'connected');
    const incomingControls = document.getElementById('callIncomingControls');
    if (incomingControls) {
        incomingControls.classList.remove('active');
        incomingControls.style.display = 'none';
    }
    stopCallSound();
    stopRingtone();
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




