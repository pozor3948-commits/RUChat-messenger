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
const MAX_RTDM_MEDIA_BYTES = 8 * 1024 * 1024;
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
    document.body.appendChild(inp);
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
    if (!window.isSecureContext) {
        // В APK/WebView isSecureContext может быть false даже при рабочем микрофоне.
        console.warn('Небезопасный контекст, продолжаем попытку записи для WebView/APK');
    }
    if (!window.MediaRecorder) {
        showError('MediaRecorder не поддерживается. Используйте прикрепление файла.');
        attachAudio();
        return;
    }
    // Проверка поддержки браузером
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showError('Ваш браузер не поддерживает запись с микрофона. Пожалуйста, используйте современный браузер (Chrome, Firefox, Edge).');
        return;
    }
    
    try {
        // Закрываем меню выбора типа записи
        if (document.getElementById('recordTypeMenu').classList.contains('active')) {
            document.getElementById('recordTypeMenu').classList.remove('active');
        }
        
        // Проверяем, находимся ли мы в режиме разработки
        const isDevMode = window.isLocalFile && window.isLocalFile();
        
        if (isDevMode) {
            // В режиме разработки предлагаем выбор
            const useTest = confirm('Режим разработки:\n\n1. Использовать реальный микрофон\n2. Запустить тестовую запись\n\nВыберите "ОК" для реальной записи или "Отмена" для тестовой записи.');
            
            if (!useTest) {
                testVoiceRecording();
                return;
            }
        }
        
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
            console.warn('Не удалось применить предпочитаемый mimeType, используем стандартный:', e);
            voiceRecorder = new MediaRecorder(voiceStream);
            voiceRecorderMimeType = voiceRecorder.mimeType || 'audio/webm';
        }
        
        voiceChunks = [];
        
        voiceRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
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
            reader.readAsDataURL(blob);
        };
        
        // Запускаем запись
        voiceRecorder.start(1000); // Собираем данные каждую секунду
        voiceRecordingTime = 0;
        
        // Обновляем UI
        document.getElementById("voiceStartBtn").style.display = "none";
        document.getElementById("voiceStopBtn").style.display = "flex";
        
        // Запускаем таймер
        voiceRecordingTimer = setInterval(() => {
            voiceRecordingTime++;
            const minutes = Math.floor(voiceRecordingTime / 60).toString().padStart(2, '0');
            const seconds = (voiceRecordingTime % 60).toString().padStart(2, '0');
            document.getElementById("voiceTimer").textContent = `${minutes}:${seconds}`;
            
            // Анимация волны
            animateVoiceWaveform();
            if (voiceRecordingTime >= MAX_VOICE_DURATION_SEC) {
                stopVoiceRecord();
            }
        }, 1000);
        
        showNotification("Запись", "Идёт запись голосового сообщения...");
        
    } catch (error) {
        console.error('Ошибка при запуске записи:', error);
        
        // Скрываем оверлей
        document.getElementById("voiceRecordOverlay").style.display = "none";
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
            const useTest = confirm('Доступ к микрофону запрещен.\n\nРазрешите доступ к микрофону в настройках браузера или запустите тестовую запись для демонстрации.\n\nЗапустить тестовую запись?');
            
            if (useTest) {
                testVoiceRecording();
            } else {
                showError('Для записи голосовых сообщений необходимо разрешить доступ к микрофону.');
            }
        } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
            const useTest = confirm('Микрофон не найден.\n\nПодключите микрофон или запустите тестовую запись для демонстрации.\n\nЗапустить тестовую запись?');
            
            if (useTest) {
                testVoiceRecording();
            } else {
                showError('Микрофон не найден. Подключите микрофон и попробуйте снова.');
            }
        } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
            const useTest = confirm('Микрофон уже используется другим приложением.\n\nЗакройте другие приложения, использующие микрофон, или запустите тестовую запись.\n\nЗапустить тестовую запись?');
            
            if (useTest) {
                testVoiceRecording();
            } else {
                showError('Микрофон уже используется другим приложением.');
            }
        } else {
            // Для других ошибок предлагаем тестовую запись
            const useTest = confirm('Не удалось получить доступ к микрофону. Запустить тестовую запись для демонстрации?');
            
            if (useTest) {
                testVoiceRecording();
            } else {
                showError('Не удалось получить доступ к микрофону. Проверьте разрешения браузера.');
            }
        }
    }
}

function setVoiceLockPill(state) {
    const pill = document.querySelector('.voice-lock-pill');
    const hint = document.querySelector('.voice-record-hint');
    if (pill) {
        pill.classList.remove('locked', 'cancel');
        if (state === 'locked') pill.classList.add('locked');
        if (state === 'cancel') pill.classList.add('cancel');
        pill.textContent = state === 'cancel' ? '✖' : '🔒';
    }
    if (hint) {
        if (state === 'locked') hint.textContent = 'Запись закреплена — нажмите ■';
        else if (state === 'cancel') hint.textContent = 'Отпустите для отмены';
        else hint.textContent = 'Свайп вверх — закрепить, влево — отмена';
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
        // Если нет активного рекордера, просто скрываем оверлей
        document.getElementById("voiceStartBtn").style.display = "flex";
        document.getElementById("voiceStopBtn").style.display = "none";
        document.getElementById("voiceTimer").textContent = "00:00";
        document.getElementById("voiceRecordOverlay").style.display = "none";
        setVoiceLockPill('idle');
        return;
    }
    
    // Останавливаем запись
    voiceRecordCancelled = false;
    voiceRecorder.stop();
    
    // Останавливаем таймер
    if (voiceRecordingTimer) {
        clearInterval(voiceRecordingTimer);
        voiceRecordingTimer = null;
    }
    
    // Обновляем UI
    document.getElementById("voiceStartBtn").style.display = "flex";
    document.getElementById("voiceStopBtn").style.display = "none";
    document.getElementById("voiceTimer").textContent = "00:00";
    
    // Скрываем оверлей через небольшую задержку, чтобы успел обработаться onstop
    setTimeout(() => {
        document.getElementById("voiceRecordOverlay").style.display = "none";
    }, 100);
    setVoiceLockPill('idle');
    
    if (voiceRecordingTime > 0) {
        showNotification("Успешно", "Голосовое сообщение отправляется...");
    }
}

// Отмена записи голосового сообщения
function cancelVoiceRecord() {
    voiceRecordCancelled = true;
    // Останавливаем запись если она идет
    if (voiceRecorder && voiceRecorder.state !== 'inactive') {
        voiceRecorder.stop();
    }
    
    // Останавливаем поток
    if (voiceStream) {
        voiceStream.getTracks().forEach(track => track.stop());
        voiceStream = null;
    }
    
    // Останавливаем таймер
    if (voiceRecordingTimer) {
        clearInterval(voiceRecordingTimer);
        voiceRecordingTimer = null;
    }
    
    // Сбрасываем UI
    document.getElementById("voiceStartBtn").style.display = "flex";
    document.getElementById("voiceStopBtn").style.display = "none";
    document.getElementById("voiceTimer").textContent = "00:00";
    document.getElementById("voiceRecordOverlay").style.display = "none";
    setVoiceLockPill('idle');
}

// Очистка ресурсов после записи
function cleanupVoiceRecording() {
    if (voiceStream) {
        voiceStream.getTracks().forEach(track => track.stop());
        voiceStream = null;
    }
    
    voiceRecorder = null;
    voiceChunks = [];
    voiceRecordingTime = 0;
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
   9. ПРИКРЕПЛЕНИЕ ФАЙЛОВ (БЕЗ ИЗМЕНЕНИЙ)
   ========================================================== */
function attachPhoto() {
    const inp = createFilePicker('image/*', true);
    inp.onchange = async e => {
        const files = Array.from(e.target.files);
        if (!files.length) {
            inp.remove();
            return;
        }
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
            document.getElementById("attachmentMenu").classList.remove("active");
            inp.remove();
        }
    };
    inp.click();
}

function attachVideo() {
    const inp = createFilePicker('video/*');
    inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) {
            inp.remove();
            return;
        }
        if (file.size > MAX_RTDM_MEDIA_BYTES) {
            showError('Видео слишком большое для отправки в текущем формате.');
            inp.remove();
            return;
        }
        showLoading();
        try {
            const raw = await fileToDataUrl(file);
            await sendMediaMessage('video', raw, file.name, file.size);
        } finally {
            hideLoading();
            document.getElementById("attachmentMenu").classList.remove("active");
            inp.remove();
        }
    };
    inp.click();
}

function attachDocument() {
    const inp = createFilePicker('*/*');
    inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) {
            inp.remove();
            return;
        }
        if (file.size > MAX_RTDM_MEDIA_BYTES) {
            showError('Файл слишком большой для отправки.');
            inp.remove();
            return;
        }
        showLoading();
        try {
            const raw = await fileToDataUrl(file);
            await sendMediaMessage('document', raw, file.name, file.size);
        } finally {
            hideLoading();
            document.getElementById("attachmentMenu").classList.remove("active");
            inp.remove();
        }
    };
    inp.click();
}

function attachAudio() {
    const inp = createFilePicker('audio/*');
    inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) {
            inp.remove();
            return;
        }
        if (file.size > MAX_RTDM_MEDIA_BYTES) {
            showError('Аудиофайл слишком большой для отправки.');
            inp.remove();
            return;
        }
        showLoading();
        try {
            const raw = await fileToDataUrl(file);
            await sendMediaMessage('audio', raw, file.name, file.size);
        } finally {
            hideLoading();
            document.getElementById("attachmentMenu").classList.remove("active");
            inp.remove();
        }
    };
    inp.click();
}

async function sendMediaMessage(type, data, filename, filesize) {
    if (!currentChatId || !chatRef || !username) { 
        showError("Выберите чат для отправки!"); 
        return; 
    }
    
    const payloadBytes = estimateDataUrlBytes(data) || (new Blob([data || '']).size);
    if (payloadBytes > MAX_RTDM_MEDIA_BYTES) {
        showError("Файл слишком большой для отправки.");
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
        console.error(e);
        if (e.message && e.message.includes('greater than 10485760')) {
            showError("Файл слишком большой для отправки.");
        } else {
            showError("Не удалось отправить файл", () => sendMediaMessage(type, data, filename, filesize));
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
