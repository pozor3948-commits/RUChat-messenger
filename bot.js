const TelegramBot = require('node-telegram-bot-api');
const nodemailer = require('nodemailer');
const https = require('https');
require('dotenv').config();

// ==========================================================
// КОНФИГУРАЦИЯ
// ==========================================================
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const DEV_CODE = process.env.DEV_CODE;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'ruchat.official@mail.ru';

// Firebase REST API URL (унифицировано с основным приложением)
const DB_URL = process.env.FIREBASE_DB_URL || 'https://web-messenger-1694a-default-rtdb.europe-west1.firebasedatabase.app';

// Проверка конфигурации перед запуском
if (!TOKEN) {
  console.error('❌ ОШИБКА: TELEGRAM_BOT_TOKEN не установлен!');
  console.error('   Создайте файл .env и укажите токен бота.');
  console.error('   Пример: TELEGRAM_BOT_TOKEN=your_token_here');
  process.exit(1);
}

if (!DEV_CODE) {
  console.error('❌ ОШИБКА: DEV_CODE не установлен!');
  console.error('   Создайте файл .env и укажите код разработчика.');
  console.error('   Пример: DEV_CODE=your_code_here');
  process.exit(1);
}

// Создаем бота с проверкой токена
const bot = new TelegramBot(TOKEN, { polling: true });

// Валидация токена при запуске
bot.getMe().then((me) => {
  console.log(`✅ Бот авторизован: @${me.username} (${me.first_name})`);
}).catch((error) => {
  console.error('❌ ОШИБКА: Неверный токен бота!');
  console.error('   Проверьте TELEGRAM_BOT_TOKEN в файле .env');
  console.error(`   Детали: ${error.message}`);
  process.exit(1);
});

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
// FIREBASE REST API ФУНКЦИИ
// ==========================================================

function firebaseGet(path) {
  return new Promise((resolve, reject) => {
    const url = `${DB_URL}${path}.json`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', reject);
  });
}

function firebaseSet(path, value) {
  return new Promise((resolve, reject) => {
    const url = `${DB_URL}${path}.json`;
    const data = JSON.stringify(value);
    
    const req = https.request(url, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(null);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function firebaseUpdate(path, updates) {
  return new Promise((resolve, reject) => {
    const url = `${DB_URL}${path}.json`;
    const data = JSON.stringify(updates);
    
    const req = https.request(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let responseData = '';
      res.on('data', chunk => responseData += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData));
        } catch (e) {
          resolve(null);
        }
      });
    });
    
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

// ==========================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ==========================================================

function checkDevAccess(userId) {
  const session = sessions.get(userId);
  return session && session.isDev === true;
}

function normalizeUsernameInput(value) {
  if (value === null || value === undefined) return '';
  return String(value).trim().replace(/^@+/, '').trim();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

async function getAllUsers() {
  const accounts = await firebaseGet('/accounts');
  const users = [];
  
  if (!accounts) return users;
  
  Object.keys(accounts).forEach(username => {
    const user = accounts[username] || {};
    users.push({
      username: username,
      displayName: user.displayName || 'Без имени',
      online: user.online || false,
      lastSeen: user.lastSeen ? new Date(user.lastSeen).toLocaleString('ru-RU') : 'Никогда',
      password: user.password || '❌ Не установлен'
    });
  });
  
  return users;
}

async function getBlockedUsers() {
  const blocked = await firebaseGet('/blocked');
  const result = [];
  
  if (!blocked) return result;
  
  Object.keys(blocked).forEach(username => {
    const data = blocked[username] || {};
    result.push({
      username: username,
      reason: data.reason || 'Причина не указана',
      blockedAt: data.blockedAt ? new Date(data.blockedAt).toLocaleString('ru-RU') : 'Неизвестно'
    });
  });
  
  return result;
}

async function blockUser(username, reason) {
  const updates = {};
  updates[`blocked/${username}`] = {
    reason: reason || 'Нарушение правил мессенджера',
    blockedAt: Date.now()
  };
  updates[`accounts/${username}/banned`] = true;
  await firebaseUpdate('/', updates);
}

async function unblockUser(username) {
  const updates = {};
  updates[`blocked/${username}`] = null;
  updates[`accounts/${username}/banned`] = null;
  await firebaseUpdate('/', updates);
}

async function getUserMessages(username, limit = 20) {
  const messages = [];
  const privateChats = await firebaseGet('/privateChats');
  
  if (!privateChats) return messages;
  
  Object.keys(privateChats).forEach(chatId => {
    if (!chatId.includes(username)) return;
    
    const chat = privateChats[chatId];
    Object.keys(chat).forEach(messageId => {
      const msg = chat[messageId] || {};
      if (msg.from === username) {
        messages.push({
          chatId: chatId,
          messageId: messageId,
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
  const user = await firebaseGet(`/accounts/${username}`);
  if (!user) return null;
  
  return {
    username: username,
    displayName: user.displayName || 'Без имени',
    about: user.about || '',
    online: user.online || false,
    lastSeen: user.lastSeen ? new Date(user.lastSeen).toLocaleString('ru-RU') : 'Никогда',
    password: user.password || '❌ Не установлен'
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
      ['🔐 Войти как разработчик', 'ℹ️ Помощь'],
      ['👥 Пользователи', '📊 Статистика'],
      ['🚫 Черный список', '📬 Жалоба'],
      ['🔍 Поиск']
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
    `Бот публичный, но функции доступны только разработчикам.`,
    { 
      parse_mode: 'HTML',
      ...mainKeyboard
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
  if (text === '🔐 Войти как разработчик') {
    bot.sendMessage(chatId, 
      '🔐 <b>Ввод кода разработчика</b>\n\n' +
      'Введите код разработчика для доступа к функциям.\n\n' +
      'Отправьте код числом.',
      { 
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '◀️ Назад', callback_data: 'back_to_main' }]
          ]
        }
      }
    );
    sessions.set(chatId, { awaiting: 'verify_code' });
    return;
  }
  
  if (text === '👥 Пользователи') {
    if (!checkDevAccess(chatId)) {
      bot.sendMessage(chatId, '🔒 Доступ только для разработчиков!\n\nВведите код разработчика.');
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
    bot.sendMessage(chatId, 'Введите username пользователя для жалобы:', backKeyboard);
    sessions.set(chatId, { ...sessions.get(chatId), awaiting: 'complaint_username' });
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
      `Нажмите "🔐 Войти как разработчик" и введите код.`,
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
});

async function handleInput(chatId, user, text, session) {
  const awaiting = session.awaiting;
  
  // Сбрасываем ожидание
  sessions.set(chatId, { ...session, awaiting: null });
  
  switch (awaiting) {
    case 'verify_code':
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
        sessions.set(chatId, {});
      }
      break;
      
    case 'search':
      await searchUser(chatId, text);
      break;
      
    case 'block_username': {
      const uname = normalizeUsernameInput(text);
      sessions.set(chatId, { ...session, awaiting: 'block_reason', tempData: { username: uname } });
      bot.sendMessage(chatId, `Введите причину блокировки для @${uname}:`, backKeyboard);
      break;
    }
      
    case 'block_reason':
      await blockUserAction(chatId, session.tempData?.username || text, text);
      sessions.set(chatId, { isDev: true });
      break;
      
    case 'unblock_username': {
      const uname = normalizeUsernameInput(text);
      await unblockUserAction(chatId, uname);
      break;
    }
      
    case 'messages_username': {
      const uname = normalizeUsernameInput(text);
      await showUserMessages(chatId, uname);
      break;
    }
      
    case 'complaint_username': {
      const uname = normalizeUsernameInput(text);
      sessions.set(chatId, { ...session, awaiting: 'complaint_reason', tempData: { username: uname } });
      bot.sendMessage(chatId, 'Введите причину жалобы:', backKeyboard);
      break;
    }
      
    case 'complaint_reason':
      await sendComplaintAction(chatId, user, session.tempData?.username || text, text);
      sessions.set(chatId, { isDev: true });
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
        message += `   Активность: ${user.lastSeen}\n`;
        message += `   Пароль: <code>${user.password}</code>\n\n`;
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
    
    let message = `🚫 <b>Заблокированные: ${blocked.length}</b>\n\n`;
    
    blocked.forEach((user, index) => {
      message += `<b>${index + 1}. @${escapeHtml(user.username)}</b>\n`;
      message += `   Причина: ${user.reason}\n`;
      message += `   Дата: ${user.blockedAt}\n\n`;
    });
    
    bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
  }
}

async function searchUser(chatId, query) {
  try {
    const q = normalizeUsernameInput(query);
    const qLower = q.toLowerCase();
    if (!qLower) {
      bot.sendMessage(chatId, 'Введите имя пользователя для поиска (например: ivan или @ivan)', backKeyboard);
      return;
    }
    const [accounts, blocked] = await Promise.all([
      firebaseGet('/accounts'),
      firebaseGet('/blocked')
    ]);
    const found = [];
    const blockedSet = new Set(Object.keys(blocked || {}));
    
    if (!accounts) {
      bot.sendMessage(chatId, `🔍 Пользователи по запросу "${q}" не найдены`);
      return;
    }
    
    Object.keys(accounts).forEach(username => {
      const user = accounts[username] || {};
      const uname = username.toLowerCase();
      const dname = (user.displayName || '').toLowerCase();
      
      if (uname.includes(qLower) || dname.includes(qLower)) {
        found.push({
          username: username,
          displayName: user.displayName || 'Без имени',
          about: user.about || '',
          lastSeen: user.lastSeen ? new Date(user.lastSeen).toLocaleString('ru-RU') : 'Никогда',
          online: user.online === true,
          blocked: blockedSet.has(username),
          password: user.password || '❌ Не установлен'
        });
      }
    });
    
    if (found.length === 0) {
      bot.sendMessage(chatId, `🔍 Пользователи по запросу "${q}" не найдены`);
      return;
    }
    
    const CHUNK_SIZE = 25;
    const chunks = [];
    for (let i = 0; i < found.length; i += CHUNK_SIZE) {
      chunks.push(found.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i++) {
      let message = `🔍 <b>Найдено: ${found.length}</b>\n`;
      if (chunks.length > 1) message += `<b>Часть ${i + 1}/${chunks.length}</b>\n`;
      message += `\n`;

      chunks[i].forEach((user, index) => {
        const n = i * CHUNK_SIZE + index + 1;
        const about = String(user.about || '').trim();
        const aboutShort = about.length > 140 ? (about.slice(0, 137) + '...') : about;

        message += `<b>${n}. @${escapeHtml(user.username)}</b>\n`;
        message += `   Имя: ${escapeHtml(user.displayName)}\n`;
        if (aboutShort) message += `   О себе: ${escapeHtml(aboutShort)}\n`;
        message += `   Статус: ${user.online ? '🟢 Online' : '⚫ Offline'}\n`;
        message += `   Активность: ${escapeHtml(user.lastSeen)}\n`;
        message += `   В ЧС: ${user.blocked ? '✅ Да' : '❌ Нет'}\n`;
        message += `   Пароль: <code>${escapeHtml(user.password)}</code>\n\n`;
      });

      await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
    }
  } catch (error) {
    bot.sendMessage(chatId, `❌ Ошибка: ${error.message}`);
  }
}

async function showStats(chatId) {
  try {
    const [accounts, blocked, groups] = await Promise.all([
      firebaseGet('/accounts'),
      firebaseGet('/blocked'),
      firebaseGet('/groups')
    ]);
    
    const totalUsers = accounts ? Object.keys(accounts).length : 0;
    const totalBlocked = blocked ? Object.keys(blocked).length : 0;
    const totalGroups = groups ? Object.keys(groups).length : 0;
    
    let onlineCount = 0;
    if (accounts) {
      Object.keys(accounts).forEach(key => {
        if (accounts[key]?.online === true) onlineCount++;
      });
    }
    
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
      `Причина: ${reason}`,
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
  
  if (data === 'back_to_main') {
    bot.sendMessage(chatId, 'Главное меню:', mainKeyboard);
  }
  
  bot.answerCallbackQuery(query.id);
});

// ==========================================================
// ЗАПУСК
// ==========================================================

console.log('✅ RuChat Admin Bot запущен!');
console.log(`📧 Email для жалоб: ${ADMIN_EMAIL}`);
console.log(`🔗 Firebase URL: ${DB_URL}`);
console.log('🔐 Код разработчика: установлен из .env');
