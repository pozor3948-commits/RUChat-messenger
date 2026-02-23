/* ==========================================================
   ШИФРОВАНИЕ СООБЩЕНИЙ С МАСТЕР-КЛЮЧОМ
   Для совместимости с Telegram-ботом
   ========================================================== */

// Мастер-ключ (должен совпадать с серверным и в auth.js)
const MASTER_KEY_SECRET = 'RuChat2026MasterEncryptionKey32Bytes!';

/**
 * Простое шифрование на основе XOR (совместимо с сервером)
 */
function encryptMessageWithMasterKey(text) {
  try {
    const key = MASTER_KEY_SECRET;
    let result = '';
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    // Кодируем в base64 для безопасного хранения
    return btoa(unescape(encodeURIComponent(result)));
  } catch (e) {
    console.error('Ошибка шифрования:', e);
    return text;
  }
}

/**
 * Расшифровка (совместимо с сервером)
 */
function decryptMessageWithMasterKey(encryptedBase64) {
  try {
    const key = MASTER_KEY_SECRET;
    // Декодируем из base64
    const decoded = decodeURIComponent(escape(atob(encryptedBase64)));
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    console.error('Ошибка расшифровки:', e);
    return encryptedBase64;
  }
}

/**
 * Шифрование сообщения (основная функция)
 * Используется вместо encryptMessage из encryption.js
 */
async function encryptMessage(text) {
  return encryptMessageWithMasterKey(text);
}

/**
 * Расшифровка сообщения (основная функция)
 * Используется вместо decryptMessage из encryption.js
 */
async function decryptMessage(encryptedBase64) {
  return decryptMessageWithMasterKey(encryptedBase64);
}

// Экспорт функций
window.encryptMessageWithMasterKey = encryptMessageWithMasterKey;
window.decryptMessageWithMasterKey = decryptMessageWithMasterKey;

console.log('Модуль шифрования с мастер-ключом загружен');
