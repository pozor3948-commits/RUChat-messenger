/* ==========================================================
   ШИФРОВАНИЕ СООБЩЕНИЙ (AES-GCM)
   ========================================================== */

// Глобальный ключ шифрования (генерируется для каждой сессии)
let encryptionKey = null;
const ENCRYPTION_ALGORITHM = 'AES-GCM';
const KEY_LENGTH = 256;

/* ==========================================================
   ГЕНЕРАЦИЯ КЛЮЧА
   ========================================================== */
async function generateEncryptionKey() {
    try {
        encryptionKey = await window.crypto.subtle.generateKey(
            {
                name: ENCRYPTION_ALGORITHM,
                length: KEY_LENGTH
            },
            true,
            ['encrypt', 'decrypt']
        );
        console.log('Ключ шифрования сгенерирован');
        return encryptionKey;
    } catch (error) {
        console.error('Ошибка генерации ключа:', error);
        return null;
    }
}

/* ==========================================================
   ЭКСПОРТ/ИМПОРТ КЛЮЧА (для обмена между устройствами)
   ========================================================== */
async function exportKey(key) {
    try {
        const exported = await window.crypto.subtle.exportKey('raw', key);
        return btoa(String.fromCharCode(...new Uint8Array(exported)));
    } catch (error) {
        console.error('Ошибка экспорта ключа:', error);
        return null;
    }
}

async function importKey(keyData) {
    try {
        const binaryKey = atob(keyData);
        const keyBuffer = new Uint8Array(binaryKey.length);
        for (let i = 0; i < binaryKey.length; i++) {
            keyBuffer[i] = binaryKey.charCodeAt(i);
        }
        
        encryptionKey = await window.crypto.subtle.importKey(
            'raw',
            keyBuffer,
            { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
            true,
            ['encrypt', 'decrypt']
        );
        console.log('Ключ шифрования импортирован');
        return encryptionKey;
    } catch (error) {
        console.error('Ошибка импорта ключа:', error);
        return null;
    }
}

/* ==========================================================
   ШИФРОВАНИЕ ТЕКСТА
   ========================================================== */
async function encryptMessage(text) {
    if (!encryptionKey) {
        await generateEncryptionKey();
    }
    
    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        
        // Генерируем случайный IV (Initialization Vector)
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        
        // Шифруем
        const encrypted = await window.crypto.subtle.encrypt(
            {
                name: ENCRYPTION_ALGORITHM,
                iv: iv
            },
            encryptionKey,
            data
        );
        
        // Конвертируем в base64 для хранения
        const encryptedArray = new Uint8Array(encrypted);
        const ivAndData = new Uint8Array(iv.length + encryptedArray.length);
        ivAndData.set(iv, 0);
        ivAndData.set(encryptedArray, iv.length);
        
        return btoa(String.fromCharCode(...ivAndData));
    } catch (error) {
        console.error('Ошибка шифрования:', error);
        return text; // Возвращаем как есть в случае ошибки
    }
}

/* ==========================================================
   РАСШИФРОВКА ТЕКСТА
   ========================================================== */
async function decryptMessage(encryptedBase64) {
    if (!encryptionKey) {
        console.warn('Ключ шифрования не установлен');
        return encryptedBase64;
    }
    
    try {
        const ivAndData = new Uint8Array(
            atob(encryptedBase64)
                .split('')
                .map(c => c.charCodeAt(0))
        );
        
        // Извлекаем IV и зашифрованные данные
        const iv = ivAndData.slice(0, 12);
        const data = ivAndData.slice(12);
        
        // Расшифровываем
        const decrypted = await window.crypto.subtle.decrypt(
            {
                name: ENCRYPTION_ALGORITHM,
                iv: iv
            },
            encryptionKey,
            data
        );
        
        const decoder = new TextDecoder();
        return decoder.decode(decrypted);
    } catch (error) {
        console.error('Ошибка расшифровки:', error);
        return encryptedBase64; // Возвращаем как есть в случае ошибки
    }
}

/* ==========================================================
   ШИФРОВАНИЕ ДЛЯ ПЕРЕДАЧИ (с использованием открытого ключа собеседника)
   ========================================================== */
async function encryptForUser(text, recipientPublicKey) {
    try {
        // Импортируем открытый ключ получателя
        const recipientKey = await importKey(recipientPublicKey);
        
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        
        const encrypted = await window.crypto.subtle.encrypt(
            { name: ENCRYPTION_ALGORITHM, iv: iv },
            recipientKey,
            data
        );
        
        const encryptedArray = new Uint8Array(encrypted);
        const ivAndData = new Uint8Array(iv.length + encryptedArray.length);
        ivAndData.set(iv, 0);
        ivAndData.set(encryptedArray, iv.length);
        
        return btoa(String.fromCharCode(...ivAndData));
    } catch (error) {
        console.error('Ошибка шифрования для пользователя:', error);
        return text;
    }
}

/* ==========================================================
   УТИЛИТЫ
   ========================================================== */
// Проверка поддержки Web Crypto API
function isEncryptionSupported() {
    return !!(window.crypto && window.crypto.subtle);
}

// Генерация ключа из пароля (PBKDF2)
async function deriveKeyFromPassword(password, salt) {
    try {
        const encoder = new TextEncoder();
        const keyMaterial = await window.crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );
        
        return await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode(salt),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: ENCRYPTION_ALGORITHM, length: KEY_LENGTH },
            true,
            ['encrypt', 'decrypt']
        );
    } catch (error) {
        console.error('Ошибка деривации ключа:', error);
        return null;
    }
}

// Делаем функции доступными глобально
window.generateEncryptionKey = generateEncryptionKey;
window.exportKey = exportKey;
window.importKey = importKey;
window.encryptMessage = encryptMessage;
window.decryptMessage = decryptMessage;
window.encryptForUser = encryptForUser;
window.isEncryptionSupported = isEncryptionSupported;
window.deriveKeyFromPassword = deriveKeyFromPassword;

console.log('Модуль шифрования загружен');
