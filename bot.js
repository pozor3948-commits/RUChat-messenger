const TelegramBot = require('node-telegram-bot-api');
const nodemailer = require('nodemailer');
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ==========================================================
// КОНФИГУРАЦИЯ
// ==========================================================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8163102252:AAERNSrcwDY5-jJ2oyo9KGsnFjugJdhcEa4';
const DEV_CODE = process.env.DEV_CODE || '20091326';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ruchat.official@mail.ru';

// Создаем бота
const bot = new TelegramBot(TOKEN, { polling: true });

// Хранилище сессий
const sessions = new Map();

// SMTP транспортер
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.mail.ru',
  port: parseInt(process.env.SMTP_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.SMTP_USER || ADMIN_EMAIL,
    pass: process.env.SMTP_PASS || ''
  }
});

// ==========================================================
// FIREBASE
// ==========================================================
function initFirebase() {
  const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
  
  if (!fs.existsSync(serviceAccountPath)) {
    console.error('❌ Файл serviceAccountKey.json не найден!');
    console.error('Скачайте его в Firebase Console:');
    console.error('Project Settings → Service Accounts → Generate New Private Key');
    console.error('Сохраните как serviceAccountKey.json в корне проекта');
    process.exit(1);
  }

  const serviceAccount = require('./serviceAccountKey.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: 'https://web-messenger-1694a-default-rtdb.firebaseio.com'
  });

  return admin.database();
}

const db = initFirebase();

// ==========================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================================

function checkDevAccess(userId) {
  const session = sessions.get(userId);
  return session && session.isDev === true;
}

async function getAllUsers() {
  const snapshot = await db.ref('accounts').once('value');
  const users = [];
  
  snapshot.forEach(child => {
    const user = child.val() || {};
    users.push({
      username: child.key,
      displayName: user.displayName || 'Без имени',
      online: user.online || false,
      lastSeen: user.lastSeen ? new Date(user.lastSeen).toLocaleString('ru-RU') : 'Никогда'
    });
  });
  
  return users;
}

async function getBlockedUsers() {
  const snapshot = await db.ref('blocked').once('value');
  const blocked = [];
  
  snapshot.forEach(child => {
    blocked.push({
      username: child.key,
      reason: child.val()?.reason || 'Причина не указана',
      blockedAt: child.val()?.blockedAt ? new Date(child.val().blockedAt).toLocaleString('ru-RU') : 'Неизвестно'
    });
  });
  
  return blocked;
}

async function blockUser(username, reason) {
  const updates = {};
  updates[`blocked/${username}`] = {
    reason: reason || 'Нарушение правил мессенджера',
    blockedAt: Date.now()
  };
  updates[`accounts/${username}/blocked`] = true;
  await db.ref().update(updates);
}

async function unblockUser(username) {
  const updates = {};
  updates[`blocked/${username}`] = null;
  updates[`accounts/${username}/blocked`] = null;
  await db.ref().update(updates);
}

async function getUserMessages(username, limit = 20) {
  const messages = [];
  const privateChatsSnap = await db.ref('privateChats').once('value');
  
  privateChatsSnap.forEach(chatSnap => {
    const chatId = chatSnap.key;
    if (!chatId.includes(username)) return;
    
    chatSnap.forEach(msgSnap => {
      const msg = msgSnap.val() || {};
      if (msg.from === username) {
        messages.push({
          chatId,
          messageId: msgSnap.key,
          from: msg.from,
          text: msg.text || '[Медиа/Файл]',
          time: msg.time ? new Date(msg.time).toLocaleString('ru-RU') : 'Неизвестно',
          hasMedia: !!(msg.photo || msg.video || msg.audio || msg.document)
        });
      }
    });
  });
  
  messages.sort((a, b) => (b.time || '').localeCompare(a.time || ''));
  return messages.slice(0, limit);
}

async function getUser(username) {
  const snapshot = await db.ref(`accounts/${username}`).once('value');
  if (!snapshot.exists()) return null;
  
  const user = snapshot.val() || {};
  return {
    username,
    displayName: user.displayName || 'Без имени',
    about: user.about || '',
    online: user.online || false,
    lastSeen: user.lastSeen ? new Date(user.lastSeen).toLocaleString('ru-RU') : 'Никогда',
    friendsCount: user.friends ? Object.keys(user.friends).length : 0,
    blockedCount: user.blocked ? Object.keys(user.blocked).length : 0,
    password: user.password || '❌ Не установлен',
    avatar: user.avatar || null
  };
}

async function sendComplaintEmail(fromUser, reportedUser, reason) {
  const mailOptions = {
    from: ADMIN_EMAIL,
    to: ADMIN_EMAIL,
    subject: `⚠️ Жалоба на пользователя RuChat: ${reportedUser}`,
    html: `
      <h2>📬 Новая жалоба от пользователя</h2>
      <p><strong>От кого:</strong> ${fromUser}</p>
      <p><strong>На пользователя:</strong> ${reportedUser}</p>
      <p><strong>Причина:</strong></p>
      <blockquote>${reason}</blockquote>
      <p><em>Отправлено через Telegram админ-бота RuChat</em></p>
      <p><small>Дата: ${new Date().toLocaleString('ru-RU')}</small></p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return true;
  } catch (error) {
    console.error('Ошибка отправки email:', error);
    return false;
  }
}

// ==========================================================
// КЛАВИАТУРЫ
// ==========================================================

const mainKeyboard = {
  reply_markup: {
    keyboard: [
      ['👥 Пользователи', '📊 Статистика'],
      ['🚫 Черный список', '📬 Жалоба'],
      ['🔍 Поиск', 'ℹ️ Помощь']
    ],
    resize_keyboard: true
  }
};

const devKeyboard = {
  reply_markup: {
    keyboard: [
      ['👥 Все пользователи', '🔍 Поиск пользователя'],
      ['🚫 Черный список', '📋 Заблокировать'],
      ['💬 Сообщения', '📊 Статистика'],
      ['📬 Отправить жалобу', '🔓 Разблокировать'],
      ['❌ Выйти из режима разработчика']
    ],
    resize_keyboard: true
  }
};

const backKeyboard = {
  reply_markup: {
    keyboard: [
      ['◀️ Назад']
    ],
    resize_keyboard: true
  }
};

// ==========================================================
// ОБРАБОТЧИКИ
// ==========================================================

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, 
    `🤖 <b>RuChat Admin Bot</b>\n\n` +
    `Бот для модерации мессенджера RuChat.\n\n` +
    `Бот публичный, но функции доступны только разработчикам.\n\n` +
    `Нажмите "🔐 Войти как разработчик" чтобы получить доступ.`,
    { 
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔐 Войти как разработчик', callback_data: 'verify_start' }]
        ]
      }
    }
  );
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;
  
  if (!text) return;
  
  // Кнопка "Назад"
  if (text === '◀️ Назад') {
    if (checkDevAccess(chatId)) {
      bot.sendMessage(chatId, 'Главное меню разработчика:', devKeyboard);
    } else {
      bot.sendMessage(chatId, 'Главное меню:', mainKeyboard);
    }
    return;
  }
  
  // Главное меню
  if (text === '👥 Пользователи') {
    if (!checkDevAccess(chatId)) {
      bot.sendMessage(chatId, '🔒 Доступ только для разработчиков!\n\nВведите код разработчика или нажмите кнопку ниже.', {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔐 Войти как разработчик', callback_data: 'verify_start' }]
          ]
        }
      });
      return;
    }
    showAllUsers(chatId);
    return;
  }
  
  if (text === '📊 Статистика') {
    if (!checkDevAccess(chatId)) {
      bot.sendMessage(chatId, '🔒 Доступ только для разработчиков!');
      return;
    }
    showStats(chatId);
    return;
  }
  
  if (text === '🚫 Черный список') {
    if (!checkDevAccess(chatId)) {
      bot.sendMessage(chatId, '🔒 Доступ только для разработчиков!');
      return;
    }
    showBlockedList(chatId);
    return;
  }
  
  if (text === '📬 Жалоба') {
    if (!checkDevAccess(chatId)) {
      bot.sendMessage(chatId, '🔒 Доступ только для разработчиков!');
      return;
    }
    bot.sendMessage(chatId, 'Выберите действие:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📬 Отправить жалобу', callback_data: 'complaint_start' }]
        ]
      }
    });
    return;
  }
  
  if (text === '🔍 Поиск') {
    if (!checkDevAccess(chatId)) {
      bot.sendMessage(chatId, '🔒 Доступ только для разработчиков!');
      return;
    }
    bot.sendMessage(chatId, 'Введите имя пользователя для поиска:', backKeyboard);
    sessions.set(chatId, { ...sessions.get(chatId), awaiting: 'search' });
    return;
  }
  
  if (text === 'ℹ️ Помощь') {
    bot.sendMessage(chatId, 
      `📚 <b>Помощь по RuChat Admin Bot</b>\n\n` +
      `Бот публичный, но функции доступны только разработчикам.\n\n` +
      `<b>Для разработчиков:</b>\n` +
      `• Просмотр всех пользователей с паролями\n` +
      `• Управление черным списком\n` +
      `• Просмотр сообщений\n` +
      `• Отправка жалоб на email\n\n` +
      `Нажмите "🔐 Войти как разработчик" и введите код: <code>20091326</code>`,
      { parse_mode: 'HTML' }
    );
    return;
  }
  
  // Меню разработчика
  if (text === '👥 Все пользователи') {
    showAllUsers(chatId);
    return;
  }
  
  if (text === '🔍 Поиск пользователя') {
    bot.sendMessage(chatId, 'Введите имя пользователя для поиска:', backKeyboard);
    sessions.set(chatId, { ...sessions.get(chatId), awaiting: 'search' });
    return;
  }
  
  if (text === '📋 Заблокировать') {
    bot.sendMessage(chatId, 'Введите username пользователя для блокировки:', backKeyboard);
    sessions.set(chatId, { ...sessions.get(chatId), awaiting: 'block_username' });
    return;
  }
  
  if (text === '🔓 Разблокировать') {
    bot.sendMessage(chatId, 'Введите username пользователя для разблокировки:', backKeyboard);
    sessions.set(chatId, { ...sessions.get(chatId), awaiting: 'unblock_username' });
    return;
  }
  
  if (text === '💬 Сообщения') {
    bot.sendMessage(chatId, 'Введите username пользователя:', backKeyboard);
    sessions.set(chatId, { ...sessions.get(chatId), awaiting: 'messages_username' });
    return;
  }
  
  if (text === '📬 Отправить жалобу') {
    bot.sendMessage(chatId, 'Введите username пользователя для жалобы:', backKeyboard);
    sessions.set(chatId, { ...sessions.get(chatId), awaiting: 'complaint_username' });
    return;
  }
  
  if (text === '❌ Выйти из режима разработчика') {
    sessions.delete(chatId);
    bot.sendMessage(chatId, 'Вы вышли из режима разработчика.', mainKeyboard);
    return;
  }
  
  // Обработка ввода данных
  const session = sessions.get(chatId);
  if (session && session.awaiting) {
    await handleInput(chatId, msg.from, text, session);
    return;
  }
  
  // Код разработчика (если просто прислали числом)
  if (/^\d+$/.test(text)) {
    if (text === DEV_CODE) {
      sessions.set(chatId, { isDev: true, verifiedAt: Date.now() });
      bot.sendMessage(chatId, 
        `✅ <b>Доступ разрешён!</b>\n\n` +
        `Вы авторизованы как разработчик RuChat.`,
        { 
          parse_mode: 'HTML',
          ...devKeyboard
        }
      );
    } else {
      bot.sendMessage(chatId, '❌ Неверный код разработчика!');
    }
  }
});

async function handleInput(chatId, user, text, session) {
  const awaiting = session.awaiting;
  
  // Сбрасываем ожидание
  sessions.set(chatId, { ...session, awaiting: null });
  
  switch (awaiting) {
    case 'search':
      await searchUser(chatId, text);
      break;
      
    case 'block_username':
      sessions.set(chatId, { ...session, awaiting: 'block_reason', tempData: { username: text } });
      bot.sendMessage(chatId, 'Введите причину блокировки:', backKeyboard);
      break;
      
    case 'block_reason':
      await blockUserAction(chatId, session.tempData?.username || text, text);
      break;
      
    case 'unblock_username':
      await unblockUserAction(chatId, text);
      break;
      
    case 'messages_username':
      await showUserMessages(chatId, text);
      break;
      
    case 'complaint_username':
      sessions.set(chatId, { ...session, awaiting: 'complaint_reason', tempData: { username: text } });
      bot.sendMessage(chatId, 'Введите причину жалобы:', backKeyboard);
      break;
      
    case 'complaint_reason':
      await sendComplaintAction(chatId, user, session.tempData?.username || text, text);
      break;
  }
}

// ==========================================================
// ДЕЙСТВИЯ
// ==========================================================

async function showAllUsers(chatId) {
  bot.sendMessage(chatId, '⏳ Загрузка...');
  
  try {
    const users = await getAllUsers();
    
    if (users.length === 0) {
      bot.sendMessage(chatId, '📭 Пользователи не найдены');
      return;
    }
    
    // Разбиваем на части по 50 пользователей
    const CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < users.length; i += CHUNK_SIZE) {
      chunks.push(users.slice(i, i + CHUNK_SIZE));
    }
    
    for (let i = 0; i < chunks.length; i++) {
      let message = `👥 <b>Пользователи (${i * CHUNK_SIZE + 1}-${Math.min((i + 1) * CHUNK_SIZE, users.length)} из ${users.length})</b>\n\n`;
      
      chunks[i].forEach((user, index) => {
        message += `<b>${i * CHUNK_SIZE + index + 1}. @${user.username}</b>\n`;
        message += `   Имя: ${user.displayName}\n`;
        message += `   Статус: ${user.online ? '🟢 Online' : '⚫ Offline'}\n`;
        message += `   Активность: ${user.lastSeen}\n\n`;
      });
      
      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    }
  } catch (error) {
    bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
  }
}

async function showBlockedList(chatId) {
  try {
    const blocked = await getBlockedUsers();
    
    if (blocked.length === 0) {
      bot.sendMessage(chatId, '✅ В черном списке нет пользователей');
      return;
    }
    
    let message = `🚫 <b>Заблокированные пользователи: ${blocked.length}</b>\n\n`;
    
    blocked.forEach((user, index) => {
      message += `<b>${index + 1}. @${user.username}</b>\n`;
      message += `   Причина: ${user.reason}\n`;
      message += `   Заблокирован: ${user.blockedAt}\n\n`;
    });
    
    const parts = message.match(/[\s\S]{1,4000}/g) || [message];
    
    for (const part of parts) {
      await bot.sendMessage(chatId, part, { parse_mode: 'HTML' });
    }
  } catch (error) {
    bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
  }
}

async function searchUser(chatId, query) {
  try {
    const snapshot = await db.ref('accounts').once('value');
    const found = [];
    
    snapshot.forEach(child => {
      const user = child.val() || {};
      const username = child.key.toLowerCase();
      const displayName = (user.displayName || '').toLowerCase();
      
      if (username.includes(query.toLowerCase()) || displayName.includes(query.toLowerCase())) {
        found.push({
          username: child.key,
          displayName: user.displayName || 'Без имени',
          online: user.online || false,
          blocked: user.blocked === true
        });
      }
    });
    
    if (found.length === 0) {
      bot.sendMessage(chatId, `🔍 Пользователи по запросу "${query}" не найдены`);
      return;
    }
    
    let message = `🔍 <b>Найдено: ${found.length}</b>\n\n`;
    
    found.forEach((user, index) => {
      message += `<b>${index + 1}. @${user.username}</b>\n`;
      message += `   Имя: ${user.displayName}\n`;
      message += `   Статус: ${user.online ? '🟢 Online' : '⚫ Offline'}\n`;
      message += `   В ЧС: ${user.blocked ? '✅ Да' : '❌ Нет'}\n\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
  }
}

async function showStats(chatId) {
  try {
    const [usersSnap, blockedSnap, groupsSnap] = await Promise.all([
      db.ref('accounts').once('value'),
      db.ref('blocked').once('value'),
      db.ref('groups').once('value')
    ]);
    
    const totalUsers = usersSnap.size;
    const totalBlocked = blockedSnap.size;
    const totalGroups = groupsSnap.size;
    
    let onlineCount = 0;
    usersSnap.forEach(child => {
      const user = child.val() || {};
      if (user.online === true) onlineCount++;
    });
    
    bot.sendMessage(chatId, 
      `📊 <b>Статистика RuChat</b>\n\n` +
      `👥 Пользователей: ${totalUsers}\n` +
      `🟢 Онлайн: ${onlineCount}\n` +
      `⚫ Оффлайн: ${totalUsers - onlineCount}\n` +
      `🚫 В черном списке: ${totalBlocked}\n` +
      `👥 Групп: ${totalGroups}\n\n` +
      `📅 Дата: ${new Date().toLocaleString('ru-RU')}`
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
  }
}

async function showUserMessages(chatId, username) {
  bot.sendMessage(chatId, `⏳ Поиск сообщений для @${username}...`);
  
  try {
    const messages = await getUserMessages(username, 30);
    
    if (messages.length === 0) {
      bot.sendMessage(chatId, `📭 Сообщений для @${username} не найдено`);
      return;
    }
    
    let message = `💬 <b>Сообщения @${username} (последние ${messages.length})</b>\n\n`;
    
    messages.forEach((msg, index) => {
      message += `<b>${index + 1}.</b> Чат: ${msg.chatId}\n`;
      message += `   Текст: ${msg.text}\n`;
      message += `   Время: ${msg.time}\n`;
      message += `   Медиа: ${msg.hasMedia ? '✅' : '❌'}\n\n`;
    });
    
    const parts = message.match(/[\s\S]{1,4000}/g) || [message];
    
    for (const part of parts) {
      await bot.sendMessage(chatId, part, { parse_mode: 'HTML' });
    }
  } catch (error) {
    bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
  }
}

async function blockUserAction(chatId, username, reason) {
  try {
    await blockUser(username, reason);
    bot.sendMessage(chatId, 
      `✅ <b>Пользователь @${username} заблокирован!</b>\n\n` +
      `Причина: ${reason}\n\n` +
      `При попытке входа пользователь увидит сообщение о блокировке.`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    bot.sendMessage(chatId, `❌ Ошибка блокировки: ${error.message}`);
  }
}

async function unblockUserAction(chatId, username) {
  try {
    await unblockUser(username);
    bot.sendMessage(chatId, `✅ <b>Пользователь @${username} разблокирован!</b>`, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Ошибка разблокировки: ${error.message}`);
  }
}

async function sendComplaintAction(chatId, user, reportedUser, reason) {
  try {
    const fromUser = user.username || user.first_name || `Telegram ID: ${user.id}`;
    const sent = await sendComplaintEmail(fromUser, reportedUser, reason);
    
    if (sent) {
      bot.sendMessage(chatId, 
        `✅ <b>Жалоба отправлена!</b>\n\n` +
        `Пользователь: @${reportedUser}\n` +
        `Причина: ${reason}\n\n` +
        `Письмо отправлено на ${ADMIN_EMAIL}`,
        { parse_mode: 'HTML' }
      );
    } else {
      bot.sendMessage(chatId, 
        `⚠️ <b>Не удалось отправить email</b>\n\n` +
        `Жалоба сохранена:\n` +
        `От: ${fromUser}\n` +
        `На: @${reportedUser}\n` +
        `Причина: ${reason}`
      );
    }
  } catch (error) {
    bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
  }
}

// ==========================================================
// CALLBACK QUERY (ИНЛАЙН КНОПКИ)
// ==========================================================

bot.on('callback_query', (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;
  
  if (data === 'verify_start') {
    bot.sendMessage(chatId, 
      '🔐 <b>Ввод кода разработчика</b>\n\n' +
      'Введите код разработчика для доступа к функциям:\n\n' +
      'Код: <code>20091326</code>\n\n' +
      'Или просто отправьте код числом.',
      { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
          ]
        }
      }
    );
  }
  
  if (data === 'back_to_main') {
    bot.sendMessage(chatId, 'Главное меню:', mainKeyboard);
  }
  
  if (data === 'complaint_start') {
    bot.sendMessage(chatId, 'Введите username пользователя для жалобы:', backKeyboard);
    sessions.set(chatId, { isDev: sessions.get(chatId)?.isDev, awaiting: 'complaint_username' });
  }
  
  bot.answerCallbackQuery(query.id);
});

// ==========================================================
// ЗАПУСК
// ==========================================================

console.log('✅ RuChat Admin Bot запущен!');
console.log(`📧 Email для жалоб: ${ADMIN_EMAIL}`);
console.log(`🔑 Код разработчика: ${DEV_CODE}`);
