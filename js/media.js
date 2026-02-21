/* ==========================================================
   8. МЕДИАФАЙЛЫ И ГОЛОСОВЫЕ СООБЩЕНИЯ (ИСПРАВЛЕННАЯ ВЕРСИЯ)
   ========================================================== */

// Глобальные переменные для записи голосовых сообщений
let voiceRecorder = null;
let voiceChunks = [];
let voiceStream = null;
let voiceRecordingTimer = null;
let voiceRecordingTime = 0;
let voiceRecordStartX = 0;
let voiceRecordStartY = 0;
let voiceRecordLocked = false;
let voiceRecordCancelled = false;
let voiceHoldActive = false;
let voiceRecorderMimeType = 'audio/webm';
// Новые переменные для обновлённого UI
let voiceIsRecording = false;
let voiceTimerInterval = null;
let voiceStartTime = 0;
let voiceVisualizerAnimationId = null;

// Ограничение размера файлов для Firebase (10MB лимит на запись)
const MAX_RTDM_MEDIA_BYTES = 10 * 1024 * 1024;
const MAX_VOICE_DURATION_SEC = 45;

function estimateDataUrlBytes(url) {
    if (!url || typeof url !== 'string' || !url.startsWith('data:')) return null;
    const comma = url.indexOf(',');
    if (comma < 0) return null;
    const b64 = url.slice(comma + 1);
    return Math.floor((b64.length * 3) / 4);
}

function pickSupportedAudioMimeType() {
    if (!window.MediaRecorder || typeof MediaRecorder.isTypeSupported !== 'function') return '';
    const candidates = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg;codecs=opus',
        'audio/ogg'
    ];
    for (const type of candidates) {
        try {
            if (MediaRecorder.isTypeSupported(type)) return type;
        } catch {
            // ignore
        }
    }
    return '';
}

function createFilePicker(accept, multiple = false) {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = accept || '*/*';
    inp.multiple = !!multiple;
    inp.style.position = 'fixed';
    inp.style.left = '-9999px';
    inp.style.top = '0';
    inp.style.zIndex = '-9999';
    inp.style.opacity = '0';
    document.body.appendChild(inp);
    
    // Для Android WebView добавляем задержку перед кликом
    const isAndroid = /Android/i.test(navigator.userAgent);
    if (isAndroid) {
        setTimeout(() => inp.click(), 50);
    } else {
        inp.click();
    }
    
    return inp;
}

function fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = () => reject(new Error('Не удалось прочитать файл'));
        reader.readAsDataURL(file);
    });
}

function compressImageDataUrl(dataUrl, maxSide = 1600, quality = 0.82) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let { width, height } = img;
            if (Math.max(width, height) > maxSide) {
                const scale = maxSide / Math.max(width, height);
                width = Math.max(1, Math.round(width * scale));
                height = Math.max(1, Math.round(height * scale));
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                resolve(dataUrl);
                return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
    });
}

function getPhotoCompressionSettings() {
    const mode = localStorage.getItem('ruchat_media_photo_quality') || 'medium';
    if (mode === 'high') return { maxSide: 2200, quality: 0.90 };
    if (mode === 'low') return { maxSide: 1200, quality: 0.72 };
    return { maxSide: 1600, quality: 0.82 };
}

// Функция запуска записи голосового сообщения
async function startVoiceRecord() {
    if (voiceRecorder && voiceRecorder.state === 'recording') {
        return;
    }
    voiceRecordCancelled = false;
    voiceRecordLocked = false;
    setVoiceLockPill('idle');
    
    if (!window.MediaRecorder) {
        showError('MediaRecorder не поддерживается. Используйте прикрепление файла.');
        attachAudio();
        return;
    }
    
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError('Ваш браузер не поддерживает запись с микрофона.');
        return;
    }

    try {
        // Закрываем меню выбора типа записи
        document.getElementById('recordTypeMenu').classList.remove('active');

        // Показываем оверлей записи
        document.getElementById('voiceRecordOverlay').style.display = 'flex';

        // Получаем доступ к микрофону
        voiceStream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                sampleRate: 44100
            }
        });

        // Настраиваем MediaRecorder
        const mimeType = pickSupportedAudioMimeType();
        const options = {
            audioBitsPerSecond: 32000
        };
        if (mimeType) options.mimeType = mimeType;

        try {
            voiceRecorder = new MediaRecorder(voiceStream, options);
            voiceRecorderMimeType = mimeType || voiceRecorder.mimeType || 'audio/webm';
        } catch (e) {
            voiceRecorder = new MediaRecorder(voiceStream);
            voiceRecorderMimeType = voiceRecorder.mimeType || 'audio/webm';
        }

        voiceChunks = [];

        voiceRecorder.ondataavailable = (event) => {
            if (event.data && event.data.size > 0) {
                voiceChunks.push(event.data);
            }
        };

        voiceRecorder.onstop = async () => {
            if (voiceRecordCancelled) {
                cleanupVoiceRecording();
                return;
            }
            if (voiceChunks.length === 0) {
                showError('Не удалось записать аудио. Пожалуйста, попробуйте снова.');
                return;
            }

            const blob = new Blob(voiceChunks, { type: voiceRecorderMimeType || 'audio/webm' });

            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64Audio = reader.result;
                await sendVoiceMessage(base64Audio);
                cleanupVoiceRecording();
            };
            reader.onerror = () => {
                showError('Ошибка чтения аудио');
                cleanupVoiceRecording();
            };
            reader.readAsDataURL(blob);
        };

        // Запускаем запись
        voiceRecorder.start(100);
        voiceIsRecording = true;
        voiceStartTime = Date.now();
        
        // Обновляем UI
        updateVoiceRecordUI(true);
        
        // Запускаем визуализацию
        startVoiceVisualizer();
        
        // Таймер записи
        voiceTimerInterval = setInterval(updateVoiceTimer, 100);
        
        // Авто-остановка по времени
        setTimeout(() => {
            if (voiceIsRecording && !voiceRecordLocked) {
                stopVoiceRecord();
            }
        }, MAX_VOICE_DURATION_SEC * 1000);

    } catch (error) {
        console.error('Ошибка доступа к микрофону:', error);
        showError('Не удалось получить доступ к микрофону. Проверьте разрешения.');
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            const useTest = confirm('Нет доступа к микрофону. Запустить тестовую запись для демонстрации?');
            if (useTest) {
                testVoiceRecording();
            }
        }
    }
}

function updateVoiceRecordUI(isRecording) {
    const timer = document.getElementById('voiceTimer');
    const recordBtn = document.getElementById('voiceRecordBtn');
    const sendBtn = document.getElementById('voiceSendBtn');
    const lockIndicator = document.getElementById('voiceLockIndicator');
    
    if (timer) {
        timer.textContent = '00:00';
        timer.classList.toggle('recording', isRecording);
    }
    
    if (recordBtn) {
        recordBtn.classList.toggle('recording', isRecording);
    }
    
    if (sendBtn) {
        sendBtn.style.display = isRecording ? 'none' : 'flex';
    }
    
    if (lockIndicator) {
        lockIndicator.classList.toggle('visible', voiceRecordLocked);
    }
}

function startVoiceRecordAction() {
    if (voiceIsRecording) return;
    startVoiceRecord();
}

function stopVoiceRecordAction() {
    if (!voiceIsRecording || voiceRecordLocked) return;
    stopVoiceRecord();
}

function sendVoiceRecord() {
    stopVoiceRecord();
}

function setVoiceLockPill(state) {
    const lockIndicator = document.getElementById('voiceLockIndicator');
    if (lockIndicator) {
        lockIndicator.classList.toggle('visible', state === 'locked');
    }
}

function updateVoiceTimer() {
    if (!voiceIsRecording) return;
    const elapsed = Date.now() - voiceStartTime;
    const seconds = Math.floor(elapsed / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    const timer = document.getElementById('voiceTimer');
    if (timer) {
        timer.textContent = `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
}

function startVoiceVisualizer() {
    const canvas = document.getElementById('voiceCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const analyser = null;
    
    // Устанавливаем размер canvas
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const bars = 64;
    const barWidth = canvas.width / bars;
    
    function draw() {
        if (!voiceIsRecording) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Генерируем случайные значения для визуализации
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        gradient.addColorStop(0, '#0088cc');
        gradient.addColorStop(0.5, '#00b4ff');
        gradient.addColorStop(1, '#0088cc');
        
        ctx.fillStyle = gradient;
        
        for (let i = 0; i < bars; i++) {
            const barHeight = Math.random() * canvas.height * 0.8 + canvas.height * 0.1;
            const x = i * barWidth;
            const y = (canvas.height - barHeight) / 2;
            
            ctx.beginPath();
            ctx.roundRect(x + 2, y, barWidth - 4, barHeight, 4);
            ctx.fill();
        }
        
        voiceVisualizerAnimationId = requestAnimationFrame(draw);
    }
    
    draw();
}

function stopVoiceVisualizer() {
    if (voiceVisualizerAnimationId) {
        cancelAnimationFrame(voiceVisualizerAnimationId);
        voiceVisualizerAnimationId = null;
    }
    
    const canvas = document.getElementById('voiceCanvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function onVoicePressStart(e) {
    if (voiceHoldActive) return;
    if (voiceRecorder && voiceRecorder.state === 'recording') return;
    voiceHoldActive = true;
    voiceRecordCancelled = false;
    voiceRecordLocked = false;
    setVoiceLockPill('idle');
    const point = e.touches && e.touches[0] ? e.touches[0] : e;
    voiceRecordStartX = point.clientX;
    voiceRecordStartY = point.clientY;
    startVoiceRecord();
    document.addEventListener('pointermove', onVoicePressMove);
    document.addEventListener('pointerup', onVoicePressEnd);
    document.addEventListener('pointercancel', onVoicePressEnd);
    document.addEventListener('mousemove', onVoicePressMove);
    document.addEventListener('mouseup', onVoicePressEnd);
    document.addEventListener('touchmove', onVoicePressMove, { passive: false });
    document.addEventListener('touchend', onVoicePressEnd);
    document.addEventListener('touchcancel', onVoicePressEnd);
    if (e.cancelable) e.preventDefault();
}

function onVoicePressMove(e) {
    if (!voiceHoldActive) return;
    if (voiceRecordLocked || voiceRecordCancelled) return;
    const point = e.touches && e.touches[0] ? e.touches[0] : e;
    const dx = point.clientX - voiceRecordStartX;
    const dy = point.clientY - voiceRecordStartY;
    if (dy < -60) {
        voiceRecordLocked = true;
        setVoiceLockPill('locked');
    }
    if (dx < -80) {
        voiceRecordCancelled = true;
        setVoiceLockPill('cancel');
    }
    if (e.cancelable) e.preventDefault();
}

function onVoicePressEnd(e) {
    if (!voiceHoldActive) return;
    voiceHoldActive = false;
    document.removeEventListener('pointermove', onVoicePressMove);
    document.removeEventListener('pointerup', onVoicePressEnd);
    document.removeEventListener('pointercancel', onVoicePressEnd);
    document.removeEventListener('mousemove', onVoicePressMove);
    document.removeEventListener('mouseup', onVoicePressEnd);
    document.removeEventListener('touchmove', onVoicePressMove);
    document.removeEventListener('touchend', onVoicePressEnd);
    document.removeEventListener('touchcancel', onVoicePressEnd);
    if (voiceRecordCancelled) {
        cancelVoiceRecord();
        setVoiceLockPill('idle');
        return;
    }
    if (voiceRecordLocked) {
        setVoiceLockPill('locked');
        return;
    }
    stopVoiceRecord();
    setVoiceLockPill('idle');
}

// Для тестирования без микрофона
function testVoiceRecording() {
    if (confirm('Запустить тест записи без микрофона? (5 секунд)\n\nЭто демонстрация функционала в режиме разработки.')) {
        showNotification('Тест', 'Тестовая запись запущена');
        
        // Скрываем другие меню
        document.getElementById('recordTypeMenu').classList.remove('active');
        
        // Показываем оверлей
        document.getElementById("voiceRecordOverlay").style.display = "flex";
        
        // Обновляем UI
        document.getElementById("voiceStartBtn").style.display = "none";
        document.getElementById("voiceStopBtn").style.display = "flex";
        
        // Имитация записи
        let testTime = 0;
        const testInterval = setInterval(() => {
            testTime++;
            const minutes = Math.floor(testTime / 60).toString().padStart(2, '0');
            const seconds = (testTime % 60).toString().padStart(2, '0');
            document.getElementById("voiceTimer").textContent = `${minutes}:${seconds}`;
            
            // Анимация волны
            animateVoiceWaveform();
            
            if (testTime >= 5) {
                clearInterval(testInterval);
                
                // Скрываем кнопки
                document.getElementById("voiceStartBtn").style.display = "flex";
                document.getElementById("voiceStopBtn").style.display = "none";
                document.getElementById("voiceTimer").textContent = "00:00";
                
                // Скрываем оверлей через небольшую задержку
                setTimeout(() => {
                    document.getElementById("voiceRecordOverlay").style.display = "none";
                    
                    // Создаем тестовое сообщение
                    showNotification('Тест', 'Тестовая запись завершена. Отправляем демо-сообщение...');
                    
                    // Базовая демо-аудио (пустая аудио в формате WAV)
                    const demoAudio = 'data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAAB=';
                    
                    // Отправляем демо-сообщение
                    setTimeout(() => {
                        sendVoiceMessage(demoAudio, true);
                    }, 1000);
                }, 100);
            }
        }, 1000);
        
        // Обработчик кнопки остановки
        const originalStop = window.stopVoiceRecord;
        window.stopVoiceRecord = function() {
            clearInterval(testInterval);
            window.stopVoiceRecord = originalStop;
            
            document.getElementById("voiceStartBtn").style.display = "flex";
            document.getElementById("voiceStopBtn").style.display = "none";
            document.getElementById("voiceTimer").textContent = "00:00";
            document.getElementById("voiceRecordOverlay").style.display = "none";
            
            if (testTime > 0) {
                const demoAudio = 'data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBIAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAAB=';
                sendVoiceMessage(demoAudio, true);
            }
        };
    }
}

// Анимация волны при записи
function animateVoiceWaveform() {
    const waveform = document.getElementById('voiceWaveform');
    if (!waveform) return;
    
    const lines = waveform.querySelectorAll('.waveform-line');
    lines.forEach(line => {
        // Генерируем случайную высоту для волны
        const randomHeight = 20 + Math.random() * 60;
        line.style.height = `${randomHeight}px`;
        line.style.transition = 'height 0.1s ease';
    });
}

// Остановка записи голосового сообщения
function stopVoiceRecord() {
    if (!voiceRecorder || voiceRecorder.state === 'inactive') {
        document.getElementById("voiceRecordOverlay").style.display = "none";
        updateVoiceRecordUI(false);
        return;
    }

    voiceRecordCancelled = false;
    voiceRecorder.stop();

    // Останавливаем таймер и визуализацию
    if (voiceTimerInterval) {
        clearInterval(voiceTimerInterval);
        voiceTimerInterval = null;
    }
    stopVoiceVisualizer();
    
    voiceIsRecording = false;
    
    // Обновляем UI
    updateVoiceRecordUI(false);

    setTimeout(() => {
        document.getElementById("voiceRecordOverlay").style.display = "none";
    }, 100);
}

// Отмена записи голосового сообщения
function cancelVoiceRecord() {
    voiceRecordCancelled = true;
    
    if (voiceRecorder && voiceRecorder.state !== 'inactive') {
        voiceRecorder.stop();
    }

    if (voiceStream) {
        voiceStream.getTracks().forEach(track => track.stop());
        voiceStream = null;
    }
    
    // Останавливаем таймер и визуализацию
    if (voiceTimerInterval) {
        clearInterval(voiceTimerInterval);
        voiceTimerInterval = null;
    }
    stopVoiceVisualizer();
    
    voiceIsRecording = false;
    
    updateVoiceRecordUI(false);
    document.getElementById("voiceRecordOverlay").style.display = "none";
}

// Очистка ресурсов после записи
function cleanupVoiceRecording() {
    if (voiceStream) {
        voiceStream.getTracks().forEach(track => track.stop());
        voiceStream = null;
    }

    voiceRecorder = null;
    voiceChunks = [];
    voiceIsRecording = false;
}

// Отправка голосового сообщения
async function sendVoiceMessage(audioData, isTest = false) {
    if (!currentChatId || !chatRef || !username) {
        showError('Невозможно отправить сообщение');
        return;
    }
    
    if (!isTest) {
        showLoading();
    }
    
    try {
        const payloadBytes = estimateDataUrlBytes(audioData) || (new Blob([audioData || '']).size);
        if (payloadBytes > MAX_RTDM_MEDIA_BYTES) {
            showError('Голосовое слишком длинное для отправки. Сократите запись.');
            return;
        }

        const messageText = isTest ? '🎤 Тестовое голосовое сообщение (демо)' : '🎤 Голосовое сообщение';
        
        const message = {
            from: username,
            text: messageText,
            audio: audioData,
            time: Date.now(),
            sent: true,
            delivered: false,
            read: false,
            status: 'sent',
            clientMessageId: (typeof createClientMessageId === 'function') ? createClientMessageId() : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
            type: 'voice_message',
            duration: voiceRecordingTime || 5,
            isTest: isTest || false
        };
        // Отправка без звука (настраивается для каждого чата отдельно)
        if (typeof getSilentSend === 'function' && getSilentSend(currentChatId, isGroupChat)) {
            message.silent = true;
        }
        const expiresAt = typeof getEphemeralExpiresAt === 'function' ? getEphemeralExpiresAt() : null;
        if (expiresAt) message.expiresAt = expiresAt;
        if (typeof replyToMessage !== 'undefined' && replyToMessage) {
            message.replyTo = { id: replyToMessage.id, from: replyToMessage.from, text: replyToMessage.text };
        }
        
        const path = isGroupChat ? `groupChats/${currentChatId}` : `privateChats/${currentChatId}`;

        // Оптимистичный UI: сразу добавляем в чат
        try {
            const localMsg = { ...message, id: message.clientMessageId };
            if (typeof addMessageToChat === 'function') addMessageToChat(localMsg, { notify: false });
            if (typeof upsertChatCacheMessage === 'function') upsertChatCacheMessage(path, localMsg);
            if (typeof newestLoadedKey !== 'undefined') newestLoadedKey = localMsg.id;
        } catch (e) {
            // ignore
        }

        const sent = (typeof sendMessagePayload === 'function')
            ? await sendMessagePayload(path, message)
            : await chatRef.push(message).then(() => true).catch(() => false);
        if (!sent && typeof enqueuePendingMessage === 'function') {
            enqueuePendingMessage(path, message);
            showNotification('Сеть', 'Голосовое в очереди отправки');
        }
        
        if (isTest) {
            showNotification('Демо', 'Тестовое голосовое сообщение отправлено!');
        } else {
            showNotification('Успешно', 'Голосовое сообщение отправлено!');
        }
        if (typeof clearReply === 'function') clearReply();
        
        // Воспроизводим звук отправки
        const soundsOn = (typeof areSoundsEnabled === 'function') ? areSoundsEnabled() : (localStorage.getItem('soundsEnabled') !== 'false');
        if (soundsOn && typeof playSendSound === 'function') {
            playSendSound();
        }
        
    } catch (error) {
        console.error('Ошибка отправки голосового сообщения:', error);
        
        if (error.message && error.message.includes('greater than 10485760')) {
            showError('Аудиосообщение слишком большое.');
        } else {
            showError('Не удалось отправить голосовое сообщение', () => sendVoiceMessage(audioData, isTest));
        }
    } finally {
        if (!isTest) {
            hideLoading();
        }
    }
}

// Функция запуска аудиозаписи из меню выбора типа
function startAudioRecording() {
    document.getElementById('recordTypeMenu').classList.remove('active');
    // Даем небольшую задержку для анимации
    setTimeout(() => {
        document.getElementById("voiceRecordOverlay").style.display = "flex";
    }, 100);
}

// Делаем функцию доступной глобально для вызова из консоли
window.testVoiceRecording = testVoiceRecording;

/* ==========================================================
   9. ПРИКРЕПЛЕНИЕ ФАЙЛОВ (ИСПРАВЛЕНО ДЛЯ APK)
   ========================================================== */
function attachPhoto() {
    const inp = createFilePicker('image/*', true);
    inp.onchange = async e => {
        const files = Array.from(e.target.files);
        if (!files.length) {
            setTimeout(() => inp.remove(), 100);
            return;
        }
        
        // Используем Firebase Storage для загрузки
        if (typeof sendMediaViaStorage === 'function') {
            showLoading();
            try {
                for (const file of files) {
                    await sendMediaViaStorage('photo', file);
                }
            } catch (err) {
                console.error('Ошибка отправки фото:', err);
                showError('Не удалось отправить фото: ' + err.message);
            } finally {
                hideLoading();
            }
        } else {
            // Fallback на старый метод (base64 в RTDB)
            showLoading();
            try {
                for (const file of files) {
                    const raw = await fileToDataUrl(file);
                    const qs = getPhotoCompressionSettings();
                    const compressed = await compressImageDataUrl(raw, qs.maxSide, qs.quality);
                    await sendMediaMessage('photo', compressed, file.name);
                }
            } finally {
                hideLoading();
            }
        }
        
        document.getElementById("attachmentMenu").classList.remove("active");
        setTimeout(() => inp.remove(), 100);
    };
    inp.onerror = () => {
        showError('Не удалось открыть выбор файлов');
        inp.remove();
    };
}

function attachVideo() {
    const inp = createFilePicker('video/*');
    inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) {
            setTimeout(() => inp.remove(), 100);
            return;
        }
        
        // Firebase Storage поддерживает файлы до 5GB
        if (typeof sendMediaViaStorage === 'function') {
            await sendMediaViaStorage('video', file);
        } else {
            // Fallback на старый метод
            if (file.size > MAX_RTDM_MEDIA_BYTES) {
                showError('Видео слишком большое (макс. 10MB).');
                inp.remove();
                return;
            }
            showLoading();
            try {
                const raw = await fileToDataUrl(file);
                await sendMediaMessage('video', raw, file.name, file.size);
            } catch (err) {
                showError('Не удалось отправить видео: ' + err.message);
            } finally {
                hideLoading();
            }
        }
        
        document.getElementById("attachmentMenu").classList.remove("active");
        setTimeout(() => inp.remove(), 100);
    };
    inp.onerror = () => {
        showError('Не удалось открыть выбор файлов');
        inp.remove();
    };
}

function attachDocument() {
    const inp = createFilePicker('*/*');
    inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) {
            setTimeout(() => inp.remove(), 100);
            return;
        }
        
        // Firebase Storage поддерживает файлы до 5GB
        if (typeof sendMediaViaStorage === 'function') {
            await sendMediaViaStorage('document', file);
        } else {
            // Fallback на старый метод
            if (file.size > MAX_RTDM_MEDIA_BYTES) {
                showError('Файл слишком большой (макс. 10MB).');
                inp.remove();
                return;
            }
            showLoading();
            try {
                const raw = await fileToDataUrl(file);
                await sendMediaMessage('document', raw, file.name, file.size);
            } catch (err) {
                showError('Не удалось отправить файл: ' + err.message);
            } finally {
                hideLoading();
            }
        }
        
        document.getElementById("attachmentMenu").classList.remove("active");
        setTimeout(() => inp.remove(), 100);
    };
    inp.onerror = () => {
        showError('Не удалось открыть выбор файлов');
        inp.remove();
    };
}

function attachAudio() {
    const inp = createFilePicker('audio/*');
    inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) {
            setTimeout(() => inp.remove(), 100);
            return;
        }
        
        // Firebase Storage поддерживает файлы до 5GB
        if (typeof sendMediaViaStorage === 'function') {
            await sendMediaViaStorage('audio', file);
        } else {
            // Fallback на старый метод
            if (file.size > MAX_RTDM_MEDIA_BYTES) {
                showError('Аудиофайл слишком большой (макс. 10MB).');
                inp.remove();
                return;
            }
            showLoading();
            try {
                const raw = await fileToDataUrl(file);
                await sendMediaMessage('audio', raw, file.name, file.size);
            } catch (err) {
                showError('Не удалось отправить аудио: ' + err.message);
            } finally {
                hideLoading();
            }
        }
        
        document.getElementById("attachmentMenu").classList.remove("active");
        setTimeout(() => inp.remove(), 100);
    };
    inp.onerror = () => {
        showError('Не удалось открыть выбор файлов');
        inp.remove();
    };
}

async function sendMediaMessage(type, data, filename, filesize) {
    if (!currentChatId || !chatRef || !username) {
        showError("Выберите чат для отправки!");
        return;
    }

    const payloadBytes = estimateDataUrlBytes(data) || (new Blob([data || '']).size);
    // Firebase Realtime Database имеет лимит 10MB на запись
    if (payloadBytes > MAX_RTDM_MEDIA_BYTES) {
        showError("Файл слишком большой для отправки (макс. 10MB). Используйте сжатие или выберите файл меньше.");
        return;
    }

    try {
        const msg = {
            from: username,
            time: Date.now(),
            sent: true,
            delivered: false,
            read: false,
            status: 'sent',
            clientMessageId: (typeof createClientMessageId === 'function') ? createClientMessageId() : `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
        };
        // Отправка без звука (настраивается для каждого чата отдельно)
        if (typeof getSilentSend === 'function' && getSilentSend(currentChatId, isGroupChat)) {
            msg.silent = true;
        }
        const expiresAt = typeof getEphemeralExpiresAt === 'function' ? getEphemeralExpiresAt() : null;
        if (expiresAt) msg.expiresAt = expiresAt;
        if (typeof replyToMessage !== 'undefined' && replyToMessage) {
            msg.replyTo = { id: replyToMessage.id, from: replyToMessage.from, text: replyToMessage.text };
        }

        switch (type) {
            case 'photo':
                msg.photo = data;
                msg.text = '📷 Фото';
                break;
            case 'video':
                msg.video = data;
                msg.filesize = filesize || payloadBytes;
                msg.text = '🎥 Видео';
                break;
            case 'audio':
                msg.audio = data;
                msg.filesize = filesize || payloadBytes;
                msg.text = '🎵 Аудио';
                break;
            case 'document':
                msg.document = data;
                msg.filename = filename;
                msg.filesize = filesize || payloadBytes;
                msg.text = '📄 Документ';
                break;
        }

        const path = isGroupChat ? `groupChats/${currentChatId}` : `privateChats/${currentChatId}`;

        // Оптимистичный UI: показываем медиа сразу
        try {
            const localMsg = { ...msg, id: msg.clientMessageId };
            if (typeof addMessageToChat === 'function') addMessageToChat(localMsg, { notify: false });
            if (typeof upsertChatCacheMessage === 'function') upsertChatCacheMessage(path, localMsg);
            if (typeof newestLoadedKey !== 'undefined') newestLoadedKey = localMsg.id;
        } catch (e) {
            // ignore
        }

        const sent = (typeof sendMessagePayload === 'function')
            ? await sendMessagePayload(path, msg)
            : await chatRef.push(msg).then(() => true).catch(() => false);
        if (!sent && typeof enqueuePendingMessage === 'function') {
            enqueuePendingMessage(path, msg);
            showNotification("Сеть", "Файл в очереди отправки");
        } else {
            showNotification("Успешно", "Файл отправлен!");
        }
        if (typeof clearReply === 'function') clearReply();

    } catch (e) {
        console.error('sendMediaMessage error:', e);
        // Обработка специфичных ошибок для APK/WebView
        if (e.message && e.message.includes('greater than')) {
            showError("Файл слишком большой для отправки.");
        } else if (e.message && e.message.includes('network')) {
            showError("Нет соединения. Файл добавлен в очередь.");
            const path = isGroupChat ? `groupChats/${currentChatId}` : `privateChats/${currentChatId}`;
            if (typeof enqueuePendingMessage === 'function') {
                enqueuePendingMessage(path, {
                    from: username,
                    time: Date.now(),
                    [type]: data,
                    filename: filename,
                    filesize: filesize,
                    clientMessageId: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
                });
            }
        } else {
            showError("Не удалось отправить файл: " + e.message);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('voiceStartBtn');
    if (btn) {
        btn.addEventListener('pointerdown', onVoicePressStart);
        btn.addEventListener('touchstart', onVoicePressStart, { passive: false });
        btn.addEventListener('mousedown', onVoicePressStart);
        btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
    }
});

function openMedia(url) { window.open(url, '_blank'); }
