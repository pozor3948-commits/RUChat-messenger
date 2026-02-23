/* ==========================================================
   FIREBASE STORAGE - ЗАГРУЗКА ФАЙЛОВ ДО 5GB
   ========================================================== */

// Лимиты Firebase Storage
const STORAGE_MAX_FILE_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
const STORAGE_CHUNK_SIZE = 256 * 1024; // 256KB chunks для resumable upload

/**
 * Загрузка файла в Firebase Storage
 * @param {File|Blob} file - Файл для загрузки
 * @param {string} path - Путь в Storage (например: messages/chat123/file.jpg)
 * @param {function} onProgress - Callback для прогресса (0-100)
 * @returns {Promise<string>} - URL скачивания
 */
async function uploadFileToStorage(file, path, onProgress = null) {
    return new Promise((resolve, reject) => {
        try {
            const storageRef = storage.ref();
            const fileRef = storageRef.child(path);
            
            // Используем put() для загрузки
            const uploadTask = fileRef.put(file);
            
            // Отслеживаем прогресс
            uploadTask.on('state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    console.log(`Upload progress: ${progress.toFixed(1)}%`);
                    if (onProgress) onProgress(progress);
                },
                (error) => {
                    // Ошибка загрузки
                    console.error('Upload error:', error);
                    reject(error);
                },
                async () => {
                    // Загрузка завершена успешно
                    try {
                        const downloadURL = await uploadTask.snapshot.ref.getDownloadURL();
                        console.log('File uploaded successfully:', downloadURL);
                        resolve(downloadURL);
                    } catch (e) {
                        reject(e);
                    }
                }
            );
        } catch (error) {
            console.error('Upload initialization error:', error);
            reject(error);
        }
    });
}

/**
 * Отправка медиафайла через Storage
 * @param {string} type - Тип файла: 'photo', 'video', 'audio', 'document'
 * @param {File} file - Файл для отправки
 */
async function sendMediaViaStorage(type, file) {
    if (!currentChatId || !username) {
        showError('Выберите чат для отправки!');
        return;
    }
    
    // Проверка размера файла
    if (file.size > STORAGE_MAX_FILE_SIZE) {
        showError('Файл слишком большой (макс. 5GB)');
        return;
    }
    
    showLoading();
    
    try {
        // Генерируем уникальный путь
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).slice(2, 10);
        const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const storagePath = `messages/${currentChatId}/${timestamp}_${randomId}_${safeFilename}`;
        
        // Загружаем файл в Storage
        const downloadURL = await uploadFileToStorage(file, storagePath, (progress) => {
            // Можно обновлять UI прогресса
            console.log(`Загрузка: ${progress.toFixed(1)}%`);
        });
        
        // Создаём сообщение
        const msg = {
            from: username,
            time: Date.now(),
            sent: true,
            delivered: false,
            read: false,
            status: 'sent',
            clientMessageId: (typeof createClientMessageId === 'function') 
                ? createClientMessageId() 
                : `${timestamp}_${randomId}`,
            storagePath: storagePath // Сохраняем путь для возможного удаления
        };
        
        // Отправка без звука (настраивается для каждого чата отдельно)
        if (typeof getSilentSend === 'function' && getSilentSend(currentChatId, isGroupChat)) {
            msg.silent = true;
        }
        
        // Добавляем данные в зависимости от типа
        switch (type) {
            case 'photo':
                msg.photo = downloadURL;
                msg.text = '📷 Фото';
                break;
            case 'video':
                msg.video = downloadURL;
                msg.filesize = file.size;
                msg.filename = file.name;
                msg.text = '🎥 Видео';
                break;
            case 'audio':
                msg.audio = downloadURL;
                msg.filesize = file.size;
                msg.filename = file.name;
                msg.text = '🎵 Аудио';
                break;
            case 'document':
                msg.document = downloadURL;
                msg.filesize = file.size;
                msg.filename = file.name;
                msg.text = '📄 Документ';
                break;
        }
        
        // Добавляем ответ если есть
        if (typeof replyToMessage !== 'undefined' && replyToMessage) {
            msg.replyTo = { 
                id: replyToMessage.id, 
                from: replyToMessage.from, 
                text: replyToMessage.text 
            };
        }
        
        // Отправляем сообщение в базу
        const chatPath = isGroupChat 
            ? `groupChats/${currentChatId}` 
            : `privateChats/${currentChatId}`;
        
        // Оптимистичный UI: показываем сообщение сразу
        const localMsg = { ...msg, id: msg.clientMessageId };
        if (typeof addMessageToChat === 'function') {
            addMessageToChat(localMsg, { notify: false });
        }
        if (typeof upsertChatCacheMessage === 'function') {
            upsertChatCacheMessage(chatPath, localMsg);
        }
        
        // Отправляем в Firebase
        await db.ref(chatPath).push(msg);
        
        hideLoading();
        showNotification('Успешно', `${getTypeName(type)} отправлено!`);
        
        // Очищаем ответ если был
        if (typeof clearReply === 'function') clearReply();
        
        // Звук отправки
        if (typeof areSoundsEnabled === 'function' && areSoundsEnabled()) {
            if (typeof playSendSound === 'function') playSendSound();
        }
        
    } catch (error) {
        console.error('Send media error:', error);
        hideLoading();
        
        let errorMessage = 'Не удалось отправить файл';
        
        if (error.code === 'storage/unauthorized') {
            errorMessage = 'Нет прав для загрузки файлов';
        } else if (error.code === 'storage/quota-exceeded') {
            errorMessage = 'Превышена квота хранилища';
        } else if (error.code === 'storage/canceled') {
            errorMessage = 'Загрузка отменена';
        } else if (error.code === 'storage/unknown') {
            errorMessage = 'Неизвестная ошибка: ' + error.message;
        } else {
            errorMessage += ': ' + error.message;
        }
        
        showError(errorMessage);
    }
}

/**
 * Получение названия типа файла
 */
function getTypeName(type) {
    const names = {
        'photo': 'Фото',
        'video': 'Видео',
        'audio': 'Аудио',
        'document': 'Файл'
    };
    return names[type] || 'Файл';
}

/**
 * Удаление файла из Storage
 * @param {string} storagePath - Путь к файлу в Storage
 */
async function deleteFileFromStorage(storagePath) {
    try {
        const fileRef = storage.ref().child(storagePath);
        await fileRef.delete();
        console.log('File deleted from storage:', storagePath);
        return true;
    } catch (error) {
        console.error('Delete file error:', error);
        return false;
    }
}

/**
 * Скачивание файла из Storage
 * @param {string} storagePath - Путь к файлу в Storage
 * @returns {Promise<string>} - URL для скачивания
 */
async function downloadFileFromStorage(storagePath) {
    try {
        const fileRef = storage.ref().child(storagePath);
        const url = await fileRef.getDownloadURL();
        return url;
    } catch (error) {
        console.error('Download file error:', error);
        throw error;
    }
}

/**
 * Проверка доступности Storage
 */
function isStorageAvailable() {
    return typeof storage !== 'undefined' && storage !== null;
}

// Делаем функции доступными глобально
window.uploadFileToStorage = uploadFileToStorage;
window.sendMediaViaStorage = sendMediaViaStorage;
window.deleteFileFromStorage = deleteFileFromStorage;
window.downloadFileFromStorage = downloadFileFromStorage;
window.isStorageAvailable = isStorageAvailable;
window.STORAGE_MAX_FILE_SIZE = STORAGE_MAX_FILE_SIZE;
