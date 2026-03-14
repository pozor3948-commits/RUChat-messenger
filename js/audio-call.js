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
let remoteAudioEl = null;
let ringtoneAudio = null;
let ringbackAudio = null;
let ringtoneInterval = null;
let noAnswerTimer = null; // Таймер без ответа
let iceCandidateQueue = [];
let isCaller = false;
let peerConnectionWasConnected = false; // Для отслеживания состояния подключения
let callSoundInterval = null; // Явное объявление

// Звук "абонент временно недоступен" (гудки + голос)
function playNoAnswerTone() {
    stopCallSound();
    stopRingtone();
    
    // Проигрываем прерывистые гудки (4 серии)
    let beepCount = 0;
    const maxBeeps = 4;
    const beepPattern = () => {
        if (beepCount >= maxBeeps) {
            clearInterval(beepInterval);
            return;
        }
        // Серия из 3 коротких гудков
        let seriesCount = 0;
        const seriesInterval = setInterval(() => {
            if (seriesCount >= 3) {
                clearInterval(seriesInterval);
                beepCount++;
                setTimeout(beepPattern, 500);
                return;
            }
            fallbackBeep(null, 0.3);
            seriesCount++;
        }, 200);
    };
    const beepInterval = setInterval(beepPattern, 1500);
    
    // Через 2 секунды голосовое сообщение
    setTimeout(() => {
        const utterance = new SpeechSynthesisUtterance('Абонент временно недоступен. Пожалуйста, позвоните позже.');
        utterance.lang = 'ru-RU';
        utterance.rate = 0.9;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
    }, 2000);
}

// Звук "абонент занят" (короткие гудки)
function playBusyTone() {
    stopCallSound();
    stopRingtone();
    
    // Проигрываем короткие гудки (каждые 0.5 сек)
    let busyCount = 0;
    const maxBusy = 6;
    const busyInterval = setInterval(() => {
        if (busyCount >= maxBusy) {
            clearInterval(busyInterval);
            return;
        }
        fallbackBeep(null, 0.4);
        busyCount++;
    }, 500);
}

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
// Приоритет: 1) Custom из localStorage 2) Публичные 3) Только STUN
function getIceServers() {
    // Проверяем, есть ли кастомные TURN серверы в localStorage
    const customTurn = localStorage.getItem('turnServers');
    if (customTurn) {
        try {
            const parsed = JSON.parse(customTurn);
            console.log('[WebRTC] Используем кастомные TURN серверы');
            return parsed;
        } catch (e) {
            console.error('[WebRTC] Ошибка парсинга кастомных TURN серверов:', e);
        }
    }

    // Публичные TURN серверы Metered (бесплатно)
    // Примечание: credentials могут меняться, следите за актуальностью
    const publicTurnServers = [
        {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'nevfh73zgaJq5uxf'
        },
        {
            urls: 'turn:openrelay.metered.ca:443',
            username: 'openrelayproject',
            credential: 'nevfh73zgaJq5uxf'
        },
        {
            urls: 'turn:openrelay.metered.ca:443?transport=tcp',
            username: 'openrelayproject',
            credential: 'nevfh73zgaJq5uxf'
        }
    ];

    // STUN серверы Google (бесплатно, проверенные)
    const stunServers = [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ];

    // Возвращаем комбинацию STUN + TURN
    return [...stunServers, ...publicTurnServers];
}

const rtcConfiguration = {
    iceServers: getIceServers(),
    // Настройки ICE для лучшей совместимости
    iceCandidatePoolSize: 10,
    iceTransportPolicy: 'all' // Попробовать все, включая relay
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
        console.log('[WebRTC] Начинаем звонок с', currentChatPartner);
        
        // Сбрасываем очередь ICE кандидатов
        iceCandidateQueue = [];
        isCaller = true;
        
        // Показываем UI звонка
        showCallUI(currentChatPartner, 'outgoing');
        ensureRemoteAudioEl();

        // Запускаем таймер без ответа (60 секунд)
        if (noAnswerTimer) clearTimeout(noAnswerTimer);
        noAnswerTimer = setTimeout(() => {
            console.log('[WebRTC] Таймер без ответа истек (60 сек)');
            document.getElementById('callStatus').textContent = 'Абонент не ответил';
            playNoAnswerTone();
            // Завершаем звонок через 5 секунд после сообщения
            setTimeout(() => {
                endCall();
            }, 5000);
        }, 60000);

        // Воспроизводим гудки вызова
        playCallSound();

        // Получаем доступ к микрофону
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });
        console.log('[WebRTC] Микрофон получен');

        // Создаем PeerConnection
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        console.log('[WebRTC] PeerConnection создан');

        // Добавляем локальный поток
        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
            console.log('[WebRTC] Трек добавлен:', track.kind);
        });

        // Обработка удаленного потока
        peerConnection.ontrack = (event) => {
            console.log('[WebRTC] Получен удаленный трек:', event.streams[0]);
            ensureRemoteAudioEl();
            remoteAudioEl.srcObject = event.streams[0];
            remoteAudioEl.volume = 1.0;
            remoteAudioEl.muted = false;
            remoteAudioEl.play().catch(err => console.error('[WebRTC] Ошибка play:', err));
        };

        peerConnection.onconnectionstatechange = () => {
            console.log('[WebRTC] Состояние соединения:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                document.getElementById('callStatus').textContent = 'Соединено';
                // Устанавливаем флаг успешного подключения
                peerConnectionWasConnected = true;
                // Останавливаем таймер без ответа
                if (noAnswerTimer) {
                    clearTimeout(noAnswerTimer);
                    noAnswerTimer = null;
                }
                stopCallSound();
                startCallTimer();
            } else if (peerConnection.connectionState === 'failed') {
                showNotification('Звонок', 'Соединение не удалось', 'error');
                endCall();
            } else if (peerConnection.connectionState === 'disconnected' || 
                       peerConnection.connectionState === 'closed') {
                // Завершаем звонок при разрыве соединения
                endCall();
            }
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log('[WebRTC] ICE состояние:', peerConnection.iceConnectionState);
        };

        // Обработка ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                const type = event.candidate.type || 'unknown';
                const address = event.candidate.address || 'unknown';
                console.log('[WebRTC] Отправляем ICE кандидат:', type, address);
                db.ref(`calls/${currentChatId}/candidates`).push({
                    candidate: event.candidate,
                    from: username
                }).catch(err => {
                    console.error('[WebRTC] Ошибка отправки ICE кандидата в Firebase:', err);
                });
            } else {
                console.log('[WebRTC] Все ICE кандидаты отправлены (end of candidates)');
            }
        };

        // Получаем ICE кандидатов от удалённой стороны
        // Игнорируем ошибки ICE (некоторые серверы недоступны, это нормально)
        peerConnection.onicecandidateerror = (event) => {
            console.warn('[WebRTC] ICE кандидат ошибка (игнорируем):', event.errorText || event);
            // Тихо игнорируем ошибки ICE - это нормально для публичных TURN серверов
        };

        // Создаем offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        console.log('[WebRTC] Offer создан и установлен как local');

        // Ждём немного для сбора ICE кандидатов
        await new Promise(resolve => setTimeout(resolve, 500));

        // Сохраняем информацию о звонке в Firebase
        const callData = {
            from: username,
            to: currentChatPartner,
            offer: {
                type: offer.type,
                sdp: peerConnection.localDescription.sdp
            },
            status: 'calling',
            timestamp: Date.now()
        };

        await db.ref(`calls/${currentChatId}`).set(callData);
        console.log('[WebRTC] Offer отправлен в Firebase');

        // Слушаем ответ
        listenForCallAnswer();

        // Воспроизводим гудки
        playCallSound();

    } catch (error) {
        console.error('[WebRTC] Ошибка при инициации звонка:', error);

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
    callAnswerRef = db.ref(`calls/${currentChatId}`);
    callAnswerRef.on('value', async (snapshot) => {
        const callData = snapshot.val();

        if (!callData) return;

        if (callData.answer && callData.status === 'connected') {
            // Собеседник ответил
            if (peerConnection && peerConnection.signalingState === 'have-local-offer') {
                console.log('[WebRTC] Получен answer, устанавливаем remote description');
                const answer = new RTCSessionDescription(callData.answer);
                await peerConnection.setRemoteDescription(answer);
                console.log('[WebRTC] Answer установлен как remote');
            }
        } else if (callData.status === 'rejected') {
            // Абонент сбросил - показываем "Абонент занят"
            if (noAnswerTimer) {
                clearTimeout(noAnswerTimer);
                noAnswerTimer = null;
            }
            document.getElementById('callStatus').textContent = 'Абонент занят';
            playBusyTone();
            showNotification('Звонок', 'Абонент занят', 'warning');
            // Завершаем звонок через 3 секунды
            setTimeout(() => {
                endCall();
            }, 3000);
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
        
        // Пропускаем своих кандидатов
        if (candidateData.from === username) {
            return;
        }
        
        // Проверяем наличие sdpMid или sdpMLineIndex
        if (c.sdpMid == null && c.sdpMLineIndex == null) {
            console.log('[WebRTC] Пропущен ICE кандидат без sdpMid/sdpMLineIndex');
            return;
        }

        const type = c.type || 'unknown';
        const address = c.address || 'unknown';
        console.log('[WebRTC] Получен ICE кандидат от', candidateData.from, '| type:', type, '| address:', address);
        
        if (peerConnection) {
            try {
                await peerConnection.addIceCandidate(new RTCIceCandidate(c));
                console.log('[WebRTC] ICE кандидат добавлен успешно');
            } catch (error) {
                console.error('[WebRTC] Ошибка добавления ICE кандидата:', error.message, c);
            }
        }
    });
}

// Принять входящий звонок
async function acceptIncomingCall(callData) {
    try {
        console.log('[WebRTC] Принимаем входящий звонок от', callData.from);
        
        // Сбрасываем очередь ICE кандидатов
        iceCandidateQueue = [];
        isCaller = false;
        
        ensureRemoteAudioEl();
        
        // Получаем доступ к микрофону
        localStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            },
            video: false
        });
        console.log('[WebRTC] Микрофон получен');

        // Создаем PeerConnection
        peerConnection = new RTCPeerConnection(rtcConfiguration);
        console.log('[WebRTC] PeerConnection создан');

        localStream.getTracks().forEach(track => {
            peerConnection.addTrack(track, localStream);
            console.log('[WebRTC] Трек добавлен:', track.kind);
        });

        peerConnection.ontrack = (event) => {
            console.log('[WebRTC] Получен удаленный трек:', event.streams[0]);
            ensureRemoteAudioEl();
            remoteAudioEl.srcObject = event.streams[0];
            remoteAudioEl.volume = 1.0;
            remoteAudioEl.muted = false;
            remoteAudioEl.play().catch(err => console.error('[WebRTC] Ошибка play:', err));
        };

        peerConnection.onconnectionstatechange = () => {
            console.log('[WebRTC] Состояние соединения:', peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                document.getElementById('callStatus').textContent = 'Соединено';
                startCallTimer();
                
                // Вывод статистики для отладки
                peerConnection.getStats().then(stats => {
                    stats.forEach(report => {
                        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
                            console.log('[WebRTC] Статистика:', {
                                localCandidate: report.localCandidateId,
                                remoteCandidate: report.remoteCandidateId,
                                bytesSent: report.bytesSent,
                                bytesReceived: report.bytesReceived
                            });
                        }
                    });
                });
            } else if (peerConnection.connectionState === 'failed') {
                showNotification('Звонок', 'Соединение не удалось', 'error');
                endCall();
            } else if (peerConnection.connectionState === 'disconnected') {
                console.log('[WebRTC] Соединение разорвано');
            }
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log('[WebRTC] ICE состояние:', peerConnection.iceConnectionState);
        };

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                const type = event.candidate.type || 'unknown';
                const address = event.candidate.address || 'unknown';
                console.log('[WebRTC] Отправляем ICE кандидат:', type, address);
                db.ref(`calls/${currentChatId}/candidates`).push({
                    candidate: event.candidate,
                    from: username
                }).catch(err => {
                    console.error('[WebRTC] Ошибка отправки ICE кандидата в Firebase:', err);
                });
            } else {
                console.log('[WebRTC] Все ICE кандидаты отправлены (end of candidates)');
            }
        };

        // Игнорируем ошибки ICE
        peerConnection.onicecandidateerror = (event) => {
            console.warn('[WebRTC] ICE кандидат ошибка (игнорируем):', event.errorText || event);
            // Тихо игнорируем ошибки ICE - это нормально для публичных TURN серверов
        };

        // Устанавливаем удаленное описание из offer
        await peerConnection.setRemoteDescription(new RTCSessionDescription(callData.offer));
        console.log('[WebRTC] Offer установлен как remote');

        // Создаем answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        console.log('[WebRTC] Answer создан и установлен как local');

        // Ждём немного для сбора ICE кандидатов
        await new Promise(resolve => setTimeout(resolve, 500));

        // Отправляем answer через Firebase
        await db.ref(`calls/${currentChatId}`).update({
            answer: {
                type: answer.type,
                sdp: peerConnection.localDescription.sdp
            },
            status: 'connected'
        });
        console.log('[WebRTC] Answer отправлен в Firebase');

        stopRingtone();
        startCallTimer();
        document.getElementById('callStatus').textContent = 'Соединено';
        showCallUI(callData.from, 'connected');
        
        if (!callAnswerRef) {
            callAnswerRef = db.ref(`calls/${currentChatId}`);
            callAnswerRef.on('value', (snapshot) => {
                const data = snapshot.val();
                if (data && data.status === 'ended') {
                    endCall();
                }
            });
        }
        
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
    // Останавливаем таймер без ответа
    if (noAnswerTimer) {
        clearTimeout(noAnswerTimer);
        noAnswerTimer = null;
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
    try {
        console.log('[WebRTC] Завершаем звонок');

        // Останавливаем все таймеры
        if (callTimer) {
            clearInterval(callTimer);
            callTimer = null;
        }
        if (noAnswerTimer) {
            clearTimeout(noAnswerTimer);
            noAnswerTimer = null;
        }
        if (callSoundInterval) {
            clearInterval(callSoundInterval);
            callSoundInterval = null;
        }
        if (ringtoneInterval) {
            clearInterval(ringtoneInterval);
            ringtoneInterval = null;
        }

        // Останавливаем локальный поток
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }

        // Закрываем peer connection и удаляем все обработчики
        if (peerConnection) {
            peerConnection.onicecandidate = null;
            peerConnection.ontrack = null;
            peerConnection.onconnectionstatechange = null;
            peerConnection.oniceconnectionstatechange = null;
            peerConnection.onsignalingstatechange = null;
            peerConnection.onicegatheringstatechange = null;
            peerConnection.onnegotiationneeded = null;
            peerConnection.close();
            peerConnection = null;
        }

        // Очищаем remote audio элемент
        if (remoteAudioEl) {
            remoteAudioEl.srcObject = null;
            if (remoteAudioEl.parentNode) {
                remoteAudioEl.remove();
            }
            remoteAudioEl = null;
        }

        // Отключаем обработчики Firebase
        if (callAnswerRef) {
            callAnswerRef.off();
            callAnswerRef = null;
        }
        if (callCandidatesRef) {
            callCandidatesRef.off();
            callCandidatesRef = null;
        }
        if (currentChatId) {
            db.ref(`calls/${currentChatId}`).off();
        }

        // Обновляем статус в Firebase
        if (currentChatId) {
            await db.ref(`calls/${currentChatId}`).update({
                status: 'ended',
                endTime: Date.now()
            }).catch(err => console.error('[WebRTC] Ошибка обновления статуса:', err));
            
            // Очищаем кандидаты только если звонок был установлен
            if (peerConnectionWasConnected) {
                db.ref(`calls/${currentChatId}/candidates`).remove().catch(err => console.error('[WebRTC] Ошибка очистки кандидатов:', err));
            }
        }

        // Сбрасываем очередь ICE кандидатов
        iceCandidateQueue = [];

        // Сбрасываем состояние
        isMuted = false;
        isSpeakerOn = true;
        peerConnectionWasConnected = false;

        // Останавливаем звуки
        stopCallSound();
        stopRingtone();

        // Скрываем UI
        hideCallUI();

        showNotification('Звонок', 'Звонок завершен', 'info');

    } catch (error) {
        console.error('[WebRTC] Ошибка при завершении звонка:', error);
        // Принудительная очистка даже при ошибке
        if (peerConnection) {
            try { peerConnection.close(); } catch (e) {}
            peerConnection = null;
        }
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
// callSoundInterval объявлен в начале файла

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
    
    const handleIncoming = (callId, callData) => {
        if (!callData || callData.to !== username) return;
        if (callData.status === 'calling') {
            const stamp = `${callId}_${callData.timestamp || 0}`;
            if (incomingHandledById[stamp]) return;
            incomingHandledById[stamp] = true;
            pendingIncomingCall = callData;
            pendingIncomingCallId = callId;
            showCallUI(callData.from, 'incoming');
            playRingtone();
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
    stopRingtone();
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
    // Основные функции
    window.startAudioCall = startAudioCall;
    window.startVoiceCall = startAudioCall; // Алиас для HTML
    window.endCall = endCall;
    window.toggleMute = toggleMute;
    window.toggleSpeaker = toggleSpeaker;
    window.acceptIncomingCallFromUI = acceptIncomingCallFromUI;
    window.rejectIncomingCallFromUI = rejectIncomingCallFromUI;
    
    // Дополнительные функции
    window.listenForIncomingCalls = listenForIncomingCalls;
    window.acceptIncomingCall = acceptIncomingCall;
}

console.log('Audio call module loaded');




