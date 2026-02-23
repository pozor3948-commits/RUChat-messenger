/**
 * МАСТЕР-КЛЮЧ ШИФРОВАНИЯ ДЛЯ RuChat
 * 
 * Используется для:
 * - Шифрования паролей пользователей (обратимо)
 * - Шифрования сообщений в чатах
 * - Расшифровки данных в Telegram-боте
 * 
 * ВАЖНО: Храните MASTER_KEY_SECRET в секрете!
 */

const crypto = require('crypto');

// Мастер-ключ (256 бит = 32 байта)
// В продакшене замените на случайную строку и храните в .env
const MASTER_KEY_SECRET = process.env.MASTER_KEY_SECRET || 'RuChat2026MasterEncryptionKey32Bytes!';

// Генерируем ключ из секретной строки (SHA-256 хеш)
function getMasterKey() {
  return crypto.createHash('sha256').update(MASTER_KEY_SECRET).digest();
}

// Алгоритм шифрования (AES-256-CBC)
const ALGORITHM = 'aes-256-cbc';

/**
 * Шифрование текста
 * @param {string} text - Текст для шифрования
 * @returns {string} - Base64 зашифрованные данные (IV + encrypted)
 */
function encrypt(text) {
  try {
    const key = getMasterKey();
    const iv = crypto.randomBytes(16); // 16 байт IV для AES-CBC
    
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(text, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    
    // Возвращаем IV + зашифрованные данные в base64
    const ivAndData = iv.toString('base64') + ':' + encrypted;
    return ivAndData;
  } catch (error) {
    console.error('Ошибка шифрования:', error.message);
    return text; // Возвращаем как есть в случае ошибки
  }
}

/**
 * Расшифровка текста
 * @param {string} encryptedBase64 - Зашифрованные данные (IV:encrypted)
 * @returns {string} - Расшифрованный текст
 */
function decrypt(encryptedBase64) {
  try {
    const key = getMasterKey();
    const parts = encryptedBase64.split(':');
    
    if (parts.length !== 2) {
      // Не наш формат - возможно это обычный текст
      return encryptedBase64;
    }
    
    const iv = Buffer.from(parts[0], 'base64');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('Ошибка расшифровки:', error.message);
    return encryptedBase64; // Возвращаем как есть в случае ошибки
  }
}

/**
 * Хеширование пароля (для быстрой проверки при входе)
 * Необратимо, используется вместе с шифрованием
 * @param {string} password - Пароль
 * @returns {string} - SHA-256 хеш
 */
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

/**
 * Проверка пароля
 * @param {string} password - Введённый пароль
 * @param {string} encryptedPassword - Зашифрованный пароль из БД
 * @param {string} passwordHash - Хеш пароля из БД (для быстрой проверки)
 * @returns {boolean} - true если пароль верный
 */
function verifyPassword(password, encryptedPassword, passwordHash) {
  // Быстрая проверка по хешу
  const inputHash = hashPassword(password);
  if (inputHash !== passwordHash) {
    return false;
  }
  
  // Дополнительная проверка расшифровкой
  try {
    const decryptedPassword = decrypt(encryptedPassword);
    return decryptedPassword === password;
  } catch {
    return false;
  }
}

// Экспорт функций
module.exports = {
  encrypt,
  decrypt,
  hashPassword,
  verifyPassword,
  getMasterKey,
  ALGORITHM
};

// Тест при запуске
if (require.main === module) {
  console.log('🔐 Тест шифрования RuChat');
  console.log('Мастер-ключ:', MASTER_KEY_SECRET);
  
  const testPassword = 'test123456';
  const encrypted = encrypt(testPassword);
  const decrypted = decrypt(encrypted);
  
  console.log('\nОригинал:', testPassword);
  console.log('Зашифровано:', encrypted);
  console.log('Расшифровано:', decrypted);
  console.log('Совпадает:', testPassword === decrypted ? '✅' : '❌');
  
  const hash = hashPassword(testPassword);
  console.log('\nХеш пароля:', hash);
  console.log('Проверка:', verifyPassword(testPassword, encrypted, hash) ? '✅' : '❌');
}
