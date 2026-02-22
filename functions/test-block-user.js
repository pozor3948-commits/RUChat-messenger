/**
 * ТЕСТ БЛОКИРОВКИ ПОЛЬЗОВАТЕЛЯ
 * Использование: node test-block-user.js <username>
 */

require('dotenv').config();
const https = require('https');
const http = require('http');

const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://web-messenger-1694a-default-rtdb.firebaseio.com';

const username = process.argv[2];

if (!username) {
  console.log('❌ Использование: node test-block-user.js <username>');
  console.log('Пример: node test-block-user.js baduser');
  process.exit(1);
}

function setFirebaseData(path, data) {
  return new Promise((resolve, reject) => {
    const url = `${FIREBASE_DATABASE_URL}/${path}.json`;
    const lib = url.startsWith('https') ? https : http;
    
    const postData = JSON.stringify(data);
    const options = {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const request = lib.request(url, options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve({ success: true });
        }
      });
    });
    
    request.on('error', (err) => {
      reject(err);
    });
    
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
    
    request.write(postData);
    request.end();
  });
}

async function blockUser() {
  console.log(`🔒 Блокировка пользователя: ${username}...`);
  
  try {
    // Добавляем в blockedUsers
    await setFirebaseData(`blockedUsers/${username}`, {
      blocked: true,
      blockedAt: Date.now(),
      reason: 'Нарушение правил пользования мессенджером',
      blockedBy: 'admin_test'
    });
    
    // Обновляем аккаунт
    await setFirebaseData(`accounts/${username}/blocked`, {
      admin: true
    });
    
    console.log(`✅ Пользователь ${username} успешно заблокирован!`);
    console.log('');
    console.log('📋 Информация о блокировке:');
    console.log(`   Username: ${username}`);
    console.log(`   Дата: ${new Date().toLocaleString('ru-RU')}`);
    console.log(`   Причина: Нарушение правил пользования мессенджером`);
    console.log('');
    console.log('Теперь при попытке входа пользователь увидит сообщение о блокировке.');
    console.log('Для разблокировки удалите запись из blockedUsers/${username}');
    
  } catch (error) {
    console.error('❌ Ошибка при блокировке:', error.message);
    process.exit(1);
  }
}

blockUser();
