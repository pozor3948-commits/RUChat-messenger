/* ==========================================================
   8. МЕДИАФАЙЛЫ И ГОЛОСОВЫЕ СООБЩЕНИЯ (ИСПРАВЛЕННАЯ ВЕРСИЯ)
   ========================================================== */

// Глобальные переменные для записи голосовых сообщений
let voiceRecorder = null;
let voiceChunks = [];
let voiceStream = null;
let voiceRecordingTimer = null;
let voiceRecordingTime = 0;

// Функция запуска записи голосового сообщения
async function startVoiceRecord() {
    if (!window.isSecureContext) {
        showError('Для записи нужен HTTPS (безопасный контекст). Откройте сайт по HTTPS.');
        return;
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
        const options = {
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000
        };
        
        try {
            voiceRecorder = new MediaRecorder(voiceStream, options);
        } catch (e) {
            console.warn('Не удалось использовать кодек opus, используем стандартный:', e);
            voiceRecorder = new MediaRecorder(voiceStream);
        }
        
        voiceChunks = [];
        
        voiceRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                voiceChunks.push(event.data);
            }
        };
        
        voiceRecorder.onstop = async () => {
            if (voiceChunks.length === 0) {
                showError('Не удалось записать аудио. Пожалуйста, попробуйте снова.');
                return;
            }
            
            const blob = new Blob(voiceChunks, { type: 'audio/webm' });
            
            // Проверяем размер файла (максимум 10MB)
            if (blob.size > 10 * 1024 * 1024) {
                showError('Аудиосообщение слишком большое. Максимум 10МБ');
                return;
            }
            
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
        return;
    }
    
    // Останавливаем запись
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
    
    if (voiceRecordingTime > 0) {
        showNotification("Успешно", "Голосовое сообщение отправляется...");
    }
}

// Отмена записи голосового сообщения
function cancelVoiceRecord() {
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
    if (!checkConnection() || !currentChatId || !chatRef || !username) {
        showError('Невозможно отправить сообщение');
        return;
    }
    
    if (!isTest) {
        showLoading();
    }
    
    try {
        const messageText = isTest ? '🎤 Тестовое голосовое сообщение (демо)' : '🎤 Голосовое сообщение';
        
        const message = {
            from: username,
            text: messageText,
            audio: audioData,
            time: Date.now(),
            sent: true,
            delivered: true,
            read: false,
            status: 'sent',
            type: 'voice_message',
            duration: voiceRecordingTime || 5,
            isTest: isTest || false
        };
        
        await chatRef.push(message);
        
        if (isTest) {
            showNotification('Демо', 'Тестовое голосовое сообщение отправлено!');
        } else {
            showNotification('Успешно', 'Голосовое сообщение отправлено!');
        }
        
        // Воспроизводим звук отправки
        if (typeof playSendSound === 'function') {
            playSendSound();
        }
        
    } catch (error) {
        console.error('Ошибка отправки голосового сообщения:', error);
        
        if (error.message && error.message.includes('greater than 10485760')) {
            showError('Аудиосообщение слишком большое. Максимум 10МБ');
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
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = true;
    inp.onchange = async e => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        showLoading();
        for (const file of files) {
            const reader = new FileReader();
            reader.onload = async ev => await sendMediaMessage('photo', ev.target.result, file.name);
            reader.readAsDataURL(file);
        }
        hideLoading();
        document.getElementById("attachmentMenu").classList.remove("active");
    };
    inp.click();
}

function attachVideo() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'video/*';
    inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        showLoading();
        const reader = new FileReader();
        reader.onload = async ev => await sendMediaMessage('video', ev.target.result, file.name);
        reader.readAsDataURL(file);
        hideLoading();
        document.getElementById("attachmentMenu").classList.remove("active");
    };
    inp.click();
}

function attachDocument() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx,.zip,.rar';
    inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        showLoading();
        const reader = new FileReader();
        reader.onload = async ev => await sendMediaMessage('document', ev.target.result, file.name, file.size);
        reader.readAsDataURL(file);
        hideLoading();
        document.getElementById("attachmentMenu").classList.remove("active");
    };
    inp.click();
}

function attachAudio() {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.accept = 'audio/*';
    inp.onchange = async e => {
        const file = e.target.files[0];
        if (!file) return;
        showLoading();
        const reader = new FileReader();
        reader.onload = async ev => await sendMediaMessage('audio', ev.target.result, file.name);
        reader.readAsDataURL(file);
        hideLoading();
        document.getElementById("attachmentMenu").classList.remove("active");
    };
    inp.click();
}

async function sendMediaMessage(type, data, filename, filesize) {
    if (!checkConnection()) return;
    if (!currentChatId || !chatRef || !username) { 
        showError("Выберите чат для отправки!"); 
        return; 
    }
    
    // Проверка размера данных для Firebase (максимум 10MB)
    const MAX_SIZE = 10 * 1024 * 1024;
    const dataSize = new Blob([data]).size;
    
    if (dataSize > MAX_SIZE) {
        showError(`Файл слишком большой (${Math.round(dataSize/1024/1024)}MB). Максимум 10MB.`);
        return;
    }
    
    try {
        const msg = { 
            from: username, 
            time: Date.now(), 
            sent: true, 
            delivered: true, 
            read: false, 
            status: 'sent' 
        };
        
        switch (type) {
            case 'photo': 
                if (dataSize > 5 * 1024 * 1024) {
                    showError("Фото слишком большое. Максимум 5MB.");
                    return;
                }
                msg.photo = data; 
                msg.text = '📷 Фото'; 
                break;
            case 'video': 
                if (dataSize > 10 * 1024 * 1024) {
                    showError("Видео слишком большое. Максимум 10MB.");
                    return;
                }
                msg.video = data; 
                msg.text = '🎥 Видео'; 
                break;
            case 'audio': 
                if (dataSize > 5 * 1024 * 1024) {
                    showError("Аудио слишком большое. Максимум 5MB.");
                    return;
                }
                msg.audio = data; 
                msg.text = '🎵 Аудио'; 
                break;
            case 'document': 
                msg.document = data; 
                msg.filename = filename; 
                msg.filesize = filesize; 
                msg.text = '📄 Документ'; 
                break;
        }
        
        await chatRef.push(msg);
        showNotification("Успешно", "Файл отправлен!");
        
    } catch (e) {
        console.error(e);
        if (e.message && e.message.includes('greater than 10485760')) {
            showError("Файл слишком большой для отправки. Максимум 10MB.");
        } else {
            showError("Не удалось отправить файл", () => sendMediaMessage(type, data, filename, filesize));
        }
    }
}

function openMedia(url) { window.open(url, '_blank'); }


