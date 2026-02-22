/**
 * ТЕСТОВОЕ ПОДКЛЮЧЕНИЕ К FIREBASE
 */

require('dotenv').config();
const admin = require('firebase-admin');

console.log('🔍 Проверка подключения к Firebase...\n');

try {
  // Инициализация Firebase Admin
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://web-messenger-1694a-default-rtdb.firebaseio.com'
  });

  console.log('✅ Firebase Admin инициализирован');

  const db = admin.database();

  // Пробуем получить данные
  console.log('📡 Чтение данных из Firebase...\n');

  db.ref('accounts').limitToFirst(5).once('value')
    .then((snapshot) => {
      const accounts = snapshot.val() || {};
      console.log('✅ Успешное подключение к Firebase!');
      console.log(`📊 Найдено аккаунтов: ${Object.keys(accounts).length}`);
      
      if (Object.keys(accounts).length > 0) {
        console.log('\n📋 Первые аккаунты:');
        for (const [username, data] of Object.entries(accounts).slice(0, 3)) {
          console.log(`   - ${username}: ${data.email || 'без email'}`);
        }
      }
      
      console.log('\n✅ Firebase работает корректно!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ошибка чтения данных:', error.message);
      console.error('\nВозможные причины:');
      console.error('   1. Не настроены права доступа в Firebase Database Rules');
      console.error('   2. Неверный URL базы данных');
      console.error('   3. Проблемы с авторизацией сервисного аккаунта');
      process.exit(1);
    });

} catch (error) {
  console.error('❌ Ошибка инициализации Firebase:', error.message);
  console.error('\nСтек:', error.stack);
  process.exit(1);
}
