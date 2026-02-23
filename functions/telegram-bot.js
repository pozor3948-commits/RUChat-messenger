/**
 * TELEGRAM BOT ДЛЯ АДМИНИСТРАТОРОВ - ИСПРАВЛЕННАЯ ВЕРСИЯ
 *
 * Исправления:
 * - Показ реальных паролей (расшифровка через мастер-ключ)
 * - Расшифровка сообщений (через мастер-ключ)
 * - Кнопка разблокировки пользователя
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const http = require('http');

// Конфигурация
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8429095689:AAGkpdRXglKH8UB6cYwUQr4N_iIBphZ-3O8';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '20091326';
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://web-messenger-1694a-default-rtdb.firebaseio.com';
const SUPPORT_EMAIL = 'ruchat.offical@mail.ru';

// Мастер-ключ для расшифровки (должен совпадать с клиентским)
const MASTER_KEY_SECRET = process.env.MASTER_KEY_SECRET || 'RuChat2026MasterEncryptionKey32Bytes!';

// Разрешённые ID пользователей Telegram
const ALLOWED_TELEGRAM_IDS = process.env.ALLOWED_TELEGRAM_IDS
  ? process.env.ALLOWED_TELEGRAM_IDS.split(',').map(id => parseInt(id.trim())).filter(id => id > 0)
  : [];

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Telegram bot started...');
console.log('📊 Firebase URL:', FIREBASE_DATABASE_URL);
console.log('🔐 Мастер-ключ:', MASTER_KEY_SECRET.substring(0, 8) + '...');
console.log('👥 Allowed Telegram IDs:', ALLOWED_TELEGRAM_IDS.length > 0 ? ALLOWED_TELEGRAM_IDS : 'Все (не настроено)');
console.log('📧 Support email:', SUPPORT_EMAIL);

// Хранилище состояний
const userStates = new Map();

/* ==========================================================
   ФУНКЦИИ РАСШИФРОВКИ
   ========================================================== */

/**
 * Расшифровка пароля
 */
function decryptPassword(encryptedBase64) {
  try {
    const key = MASTER_KEY_SECRET;
    // Декодируем из base64
    const decoded = decodeURIComponent(escape(Buffer.from(encryptedBase64, 'base64')));
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    console.error('Ошибка расшифровки пароля:', e.message);
    return encryptedBase64;
  }
}

/**
 * Расшифровка сообщения
 */
function decryptMessageContent(encryptedBase64) {
  try {
    const key = MASTER_KEY_SECRET;
    const decoded = decodeURIComponent(escape(Buffer.from(encryptedBase64, 'base64')));
    let result = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (e) {
    return encryptedBase64;
  }
}

/**
 * Форматирование сообщения с расшифровкой
 */
function formatMessageContent(msg) {
  let text = msg.text || '';
  
  // Расшифровываем если зашифровано
  if (msg.encrypted === true && text) {
    text = decryptMessageContent(text);
  }
  
  if (text.length > 100) text = text.slice(0, 100) + '...';
  if (msg.photo) return '📷 Фото: ' + text;
  if (msg.video) return '🎥 Видео: ' + text;
  if (msg.audio) return '🎵 Аудио: ' + text;
  if (msg.document) return `📄 Файл: ${msg.filename || 'без имени'}: ${text}`;
  if (msg.sticker) return '🎭 Стикер: ' + text;
  return text || '[Пустое]';
}

// Получение данных из Firebase
function getFirebaseData(aPath) {
  return new Promise((resolve, reject) => {
    const url = `${FIREBASE_DATABASE_URL}/${aPath}.json`;
    const lib = url.startsWith('https') ? https : http;
    
    const request = lib.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data || 'null'));
        } catch (e) {
          reject(new Error('JSON parse error: ' + e.message));
        }
      });
    });
    
    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

// Запись данных в Firebase
function setFirebaseData(aPath, data) {
  return new Promise((resolve, reject) => {
    const url = `${FIREBASE_DATABASE_URL}/${aPath}.json`;
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
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData || '{}'));
        } catch (e) {
          resolve({ success: true });
        }
      });
    });
    
    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
    
    request.write(postData);
    request.end();
  });
}

// Обновление данных (PATCH)
function updateFirebaseData(aPath, updates) {
  return new Promise((resolve, reject) => {
    const url = `${FIREBASE_DATABASE_URL}/${aPath}.json`;
    const lib = url.startsWith('https') ? https : http;
    
    const postData = JSON.stringify(updates);
    const options = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const request = lib.request(url, options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData || '{}'));
        } catch (e) {
          resolve({ success: true });
        }
      });
    });
    
    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
    
    request.write(postData);
    request.end();
  });
}

// Удаление данных
function deleteFirebaseData(aPath) {
  return new Promise((resolve, reject) => {
    const url = `${FIREBASE_DATABASE_URL}/${aPath}.json`;
    const lib = url.startsWith('https') ? https : http;
    
    const options = { method: 'DELETE' };
    
    const request = lib.request(url, options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(responseData || '{}'));
        } catch (e) {
          resolve({ success: true });
        }
      });
    });
    
    request.on('error', reject);
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
    
    request.end();
  });
}

// Проверка доступа
function checkAccess(chatId) {
  return ALLOWED_TELEGRAM_IDS.length === 0 || ALLOWED_TELEGRAM_IDS.includes(chatId);
}

// Форматирование даты
function formatDate(timestamp) {
  if (!timestamp) return 'неизвестно';
  return new Date(timestamp).toLocaleString('ru-RU');
}

// Главная клавиатура
function getMainKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        ['📊 Статистика', '👥 Все аккаунты'],
        ['🔍 Поиск пользователя', '⚫ Черный список'],
        ['❓ Помощь']
      ],
      resize_keyboard: true
    }
  };
}

// Клавиатура пользователя
function getUserKeyboard(username, isBlocked = false) {
  const blacklistBtn = isBlocked 
    ? { text: '✅ Разблокировать', callback_data: `unblock_${username}` }
    : { text: '⚫ В черный список', callback_data: `blacklist_${username}` };
    
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📨 Сообщения', callback_data: `messages_${username}` },
          { text: '📸 Медиа', callback_data: `media_${username}` }
        ],
        [
          { text: '💬 Чаты', callback_data: `chats_${username}` },
          { text: '👥 Друзья', callback_data: `friends_${username}` }
        ],
        [
          { text: '👥 Группы', callback_data: `groups_${username}` },
          { text: '📋 Профиль', callback_data: `profile_${username}` }
        ],
        [
          blacklistBtn,
          { text: '🔙 Назад', callback_data: 'main_menu' }
        ]
      ]
    }
  };
}

// Назад к пользователю
function getBackToUserKeyboard(username) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 Назад к пользователю', callback_data: `user_${username}` }]
      ]
    }
  };
}

// /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(chatId,
    '🔐 <b>RuChat Admin Bot</b>\n\n' +
    'Используйте кнопки для навигации',
    { parse_mode: 'HTML', ...getMainKeyboard() }
  );
});

// Обработка кнопок
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!checkAccess(chatId)) {
    bot.sendMessage(chatId, '❌ Доступ запрещён.');
    return;
  }

  if (msg.reply_to_message && msg.reply_to_message.from.is_bot) return;

  try {
    switch (text) {
      case '📊 Статистика': await handleStats(chatId); break;
      case '👥 Все аккаунты': await handleAllAccounts(chatId); break;
      case '🔍 Поиск пользователя':
        bot.sendMessage(chatId, '🔍 Введите имя пользователя:', {
          reply_markup: { force_reply: true, input_field_placeholder: 'Username' }
        });
        break;
      case '⚫ Черный список': await handleBlacklistList(chatId); break;
      case '❓ Помощь': await handleHelp(chatId); break;
      default:
        const state = userStates.get(chatId);
        if (state && state.step === 'searching') {
          await handleUserSearch(chatId, text);
          userStates.delete(chatId);
        }
    }
  } catch (error) {
    console.error('Error:', error);
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
});

// Поиск пользователя
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const state = userStates.get(chatId);
  
  if (!checkAccess(chatId)) return;
  if (state && state.step === 'searching') {
    await handleUserSearch(chatId, msg.text);
    userStates.delete(chatId);
  }
});

async function handleUserSearch(chatId, username) {
  username = username.trim();
  if (!username) {
    bot.sendMessage(chatId, '❌ Введите имя.');
    return;
  }

  bot.sendMessage(chatId, `⏳ Поиск: ${username}...`);
  
  try {
    const accounts = await getFirebaseData('accounts');
    if (!accounts || !accounts[username]) {
      bot.sendMessage(chatId, `❌ <b>${username}</b> не найден.`, { parse_mode: 'HTML' });
      return;
    }
    await showUserProfile(chatId, username, accounts);
  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

async function handleAllAccounts(chatId) {
  bot.sendMessage(chatId, '🔑 Введите админ-пароль:', {
    reply_markup: { force_reply: true, input_field_placeholder: 'Пароль' }
  }).then((sentMsg) => {
    const handler = async (reply) => {
      if (reply.reply_to_message && reply.reply_to_message.message_id === sentMsg.message_id) {
        bot.removeListener('message', handler);
        
        if (reply.text !== ADMIN_PASSWORD) {
          bot.sendMessage(chatId, '❌ Неверный пароль!');
          return;
        }
        await showAccountsList(chatId);
      }
    };
    bot.on('message', handler);
  });
}

async function showAccountsList(chatId) {
  try {
    const accounts = await getFirebaseData('accounts');
    if (!accounts || Object.keys(accounts).length === 0) {
      bot.sendMessage(chatId, '📭 Нет аккаунтов.');
      return;
    }

    userStates.set(chatId, { accounts, step: 'accounts_list' });

    let report = '📊 <b>RuChat - Аккаунты</b>\n\n';
    report += `Всего: ${Object.keys(accounts).length}\n\n`;

    const list = Object.entries(accounts).map(([u, d]) => {
      const online = d.online ? '🟢' : '⚫';
      const blocked = (d.blocked?.admin || false) ? '🚫 ' : '';
      return `${blocked}${online} <b>${u}</b> - ${d.email || 'без email'}`;
    }).join('\n');

    report += list;

    const keyboard = Object.keys(accounts).sort().map(u => ([
      { text: `👤 ${u}`, callback_data: `user_${u}` }
    ]));

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

async function showUserProfile(chatId, username, allAccounts) {
  const userData = allAccounts[username];
  if (!userData) {
    bot.sendMessage(chatId, '❌ Не найден.');
    return;
  }

  // Проверяем, заблокирован ли
  const blockedSnap = await getFirebaseData(`blockedUsers/${username}`);
  const isBlocked = blockedSnap?.blocked === true || userData.blocked?.admin === true;

  // Расшифровываем пароль
  let decryptedPassword = 'не указан';
  if (userData.password) {
    // Пробуем расшифровать
    decryptedPassword = decryptPassword(userData.password);
    // Если расшифровка не удалась, показываем passwordHash (для старых аккаунтов)
    if (decryptedPassword === userData.password && userData.passwordHash) {
      decryptedPassword = `${userData.passwordHash} (хеш, старый аккаунт)`;
    }
  }

  let info = `👤 <b>Профиль: ${username}</b>\n\n`;
  info += `<b>📋 Данные:</b>\n`;
  info += `   Логин: <code>${username}</code>\n`;
  info += `   🔓 Пароль: <code>${decryptedPassword}</code>\n`;
  info += `   Email: ${userData.email || 'не указан'}\n`;
  info += `   Телефон: ${userData.phoneNumber || 'не указан'}\n`;
  info += `   В сети: ${userData.online ? '🟢 да' : '⚫ нет'}\n`;
  info += `   Вход: ${formatDate(userData.lastSeen)}\n`;
  info += `   Создан: ${formatDate(userData.createdAt)}\n`;
  if (isBlocked) {
    info += `\n   <b>🚫 ЗАБЛОКИРОВАН</b>\n`;
  }
  info += '\n';

  const friends = userData.friends || {};
  const friendCount = Object.keys(friends).filter(f => friends[f] === true).length;
  info += `<b>👥 Друзья:</b> ${friendCount}\n`;

  const groups = userData.groups || {};
  const groupCount = Object.keys(groups).filter(g => groups[g] === true).length;
  info += `<b>👥 Группы:</b> ${groupCount}\n`;

  await bot.sendMessage(chatId, info, {
    parse_mode: 'HTML',
    ...getUserKeyboard(username, isBlocked)
  });

  userStates.set(chatId, { accounts: allAccounts, currentUser: username, step: 'user_profile' });
}

async function handleStats(chatId) {
  try {
    const [accounts, groups, privateChats, groupChats] = await Promise.all([
      getFirebaseData('accounts'),
      getFirebaseData('groups'),
      getFirebaseData('privateChats'),
      getFirebaseData('groupChats')
    ]);

    const accountsCount = accounts ? Object.keys(accounts).length : 0;
    const groupsCount = groups ? Object.keys(groups).length : 0;

    let totalMessages = 0;
    if (privateChats) {
      for (const cid of Object.keys(privateChats)) {
        totalMessages += Object.keys(privateChats[cid] || {}).length;
      }
    }
    if (groupChats) {
      for (const gid of Object.keys(groupChats)) {
        totalMessages += Object.keys(groupChats[gid] || {}).length;
      }
    }

    let onlineCount = 0;
    if (accounts) {
      for (const d of Object.values(accounts)) {
        if (d.online) onlineCount++;
      }
    }

    let stats = '📈 <b>RuChat Статистика</b>\n\n';
    stats += `👥 Пользователей: ${accountsCount}\n`;
    stats += `🟢 Онлайн: ${onlineCount}\n`;
    stats += `👥 Групп: ${groupsCount}\n`;
    stats += `💌 Сообщений: ${totalMessages}\n`;

    bot.sendMessage(chatId, stats, { parse_mode: 'HTML' });
  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

async function handleBlacklistList(chatId) {
  try {
    const blockedUsers = await getFirebaseData('blockedUsers');
    
    let report = '⚫ <b>Черный список</b>\n\n';
    
    if (!blockedUsers || Object.keys(blockedUsers).length === 0) {
      report += 'Пуст.\n';
    } else {
      report += `<b>Заблокировано: ${Object.keys(blockedUsers).length}</b>\n\n`;
      for (const [u, d] of Object.entries(blockedUsers)) {
        const reason = d.reason || 'Нарушение правил';
        const date = d.blockedAt ? formatDate(d.blockedAt) : 'неизвестно';
        report += `🚫 <b>${u}</b>\n   Причина: ${reason}\n   Дата: ${date}\n\n`;
      }
    }

    bot.sendMessage(chatId, report, { parse_mode: 'HTML', ...getMainKeyboard() });
  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

async function handleHelp(chatId) {
  const text = '📖 <b>Помощь</b>\n\n' +
    '<b>Кнопки:</b>\n' +
    '📊 Статистика - информация о мессенджере\n' +
    '👥 Все аккаунты - список пользователей\n' +
    '🔍 Поиск - найти по username\n' +
    '⚫ Черный список - заблокированные\n\n' +
    '<b>Действия с пользователем:</b>\n' +
    '📨 Сообщения - все сообщения\n' +
    '📸 Медиа - файлы со ссылками\n' +
    '💬 Чаты - переписки с друзьями\n' +
    '👥 Друзья/Группы - списки\n' +
    '📋 Профиль - данные + пароль\n' +
    '⚫/✅ Черный список - блокировка/разблокировка\n\n' +
    'Пароль: 20091326';

  bot.sendMessage(chatId, text, { parse_mode: 'HTML', ...getMainKeyboard() });
}

// Callback query
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (!checkAccess(chatId)) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Запрещено.' });
    return;
  }

  const parts = data.split('_');
  const action = parts[0];
  const username = parts.slice(1).join('_');

  try {
    switch (action) {
      case 'user': {
        const accounts = await getFirebaseData('accounts');
        if (accounts && accounts[username]) {
          await showUserProfile(chatId, username, accounts);
        }
        break;
      }
      case 'messages': await showUserMessages(chatId, username); break;
      case 'media': await showUserMedia(chatId, username); break;
      case 'chats': await showUserChats(chatId, username); break;
      case 'friends': await showUserFriendsDetail(chatId, username); break;
      case 'groups': await showUserGroupsDetail(chatId, username); break;
      case 'profile': {
        const accounts = await getFirebaseData('accounts');
        await showUserProfile(chatId, username, accounts);
        break;
      }
      case 'blacklist': await handleBlacklistConfirm(chatId, username, false); break;
      case 'unblock': await handleBlacklistConfirm(chatId, username, true); break;
      case 'main_menu':
        bot.sendMessage(chatId, '🔙 Меню', getMainKeyboard());
        break;
    }
    await bot.answerCallbackQuery(query.id);
  } catch (error) {
    console.error('Callback error:', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ ' + error.message });
  }
});

// Подтверждение блокировки/разблокировки
async function handleBlacklistConfirm(chatId, username, isUnblock) {
  const actionText = isUnblock ? 'разблокировать' : 'заблокировать';
  const actionEmoji = isUnblock ? '✅' : '⚫';
  
  const text = isUnblock
    ? `✅ <b>Разблокировка</b>\n\nРазблокировать <b>${username}</b>?`
    : `⚠️ <b>Блокировка</b>\n\nЗаблокировать <b>${username}</b>?\n\n` +
      '<b>Последствия:</b>\n' +
      '• Выкинет из аккаунта\n' +
      '• При входе покажется сообщение\n' +
      '• Для разблокировки: ' + SUPPORT_EMAIL;

  const keyboard = {
    inline_keyboard: [
      [
        { text: `${actionEmoji} Да`, callback_data: `${isUnblock ? 'unblock' : 'blacklist'}_confirm_${username}` },
        { text: '❌ Отмена', callback_data: `user_${username}` }
      ]
    ]
  };

  await bot.sendMessage(chatId, text, { parse_mode: 'HTML', reply_markup: keyboard });
}

// Обработка подтверждения
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (!checkAccess(chatId)) return;

  try {
    if (data.startsWith('blacklist_confirm_')) {
      const username = data.replace('blacklist_confirm_', '');
      
      // Блокируем
      await setFirebaseData(`blockedUsers/${username}`, {
        blocked: true,
        blockedAt: Date.now(),
        reason: 'Нарушение правил пользования мессенджером',
        blockedBy: 'admin_telegram'
      });
      
      await updateFirebaseData(`accounts/${username}`, {
        blocked: { admin: true },
        online: false,
        lastSeen: Date.now()
      });
      
      console.log(`✅ Заблокирован: ${username}`);
      
      await bot.sendMessage(chatId,
        `✅ <b>${username}</b> заблокирован!\n\n` +
        'При попытке входа увидит сообщение о блокировке.',
        { parse_mode: 'HTML', ...getMainKeyboard() }
      );
      
      await bot.answerCallbackQuery(query.id, { text: 'Заблокирован' });
    }

    if (data.startsWith('unblock_confirm_')) {
      const username = data.replace('unblock_confirm_', '');
      
      // Разблокируем
      await deleteFirebaseData(`blockedUsers/${username}`);
      await updateFirebaseData(`accounts/${username}`, {
        blocked: null
      });
      
      console.log(`✅ Разблокирован: ${username}`);
      
      await bot.sendMessage(chatId,
        `✅ <b>${username}</b> разблокирован!\n\n` +
        'Теперь может войти в аккаунт.',
        { parse_mode: 'HTML', ...getMainKeyboard() }
      );
      
      await bot.answerCallbackQuery(query.id, { text: 'Разблокирован' });
    }
  } catch (error) {
    console.error('Block/unblock error:', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ ' + error.message });
  }
});

// Сообщения пользователя
async function showUserMessages(chatId, username) {
  bot.sendMessage(chatId, `⏳ Загрузка сообщений...`);

  try {
    const [privateChats, groupChats] = await Promise.all([
      getFirebaseData('privateChats'),
      getFirebaseData('groupChats')
    ]);

    let report = `📨 <b>Сообщения: ${username}</b>\n\n`;
    const allMessages = [];

    if (privateChats) {
      for (const cid of Object.keys(privateChats)) {
        for (const [mid, msg] of Object.entries(privateChats[cid] || {})) {
          if (msg.from === username) {
            allMessages.push({ ...msg, type: 'private', chat: cid });
          }
        }
      }
    }

    if (groupChats) {
      for (const gid of Object.keys(groupChats)) {
        for (const [mid, msg] of Object.entries(groupChats[gid] || {})) {
          if (msg.from === username) {
            allMessages.push({ ...msg, type: 'group', group: gid });
          }
        }
      }
    }

    allMessages.sort((a, b) => (b.time || 0) - (a.time || 0));

    report += `<b>Всего: ${allMessages.length}</b>\n\n`;

    if (allMessages.length > 0) {
      report += '<b>Последние 30:</b>\n\n';
      for (const msg of allMessages.slice(0, 30)) {
        const icon = msg.type === 'private' ? '💬' : '👥';
        const content = formatMessageContent(msg);
        report += `${icon} <b>${formatDate(msg.time)}</b>\n${content}\n\n`;
      }
    }

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      ...getBackToUserKeyboard(username)
    });
  } catch (error) {
    bot.sendMessage(chatId, '❌ ' + error.message);
  }
}

// Медиа
async function showUserMedia(chatId, username) {
  bot.sendMessage(chatId, `⏳ Загрузка медиа...`);

  try {
    const [privateChats, groupChats] = await Promise.all([
      getFirebaseData('privateChats'),
      getFirebaseData('groupChats')
    ]);

    const media = { photos: [], videos: [], audio: [], docs: [], stickers: [] };

    const collect = (msgs, location) => {
      for (const msg of Object.values(msgs || {})) {
        if (msg.from !== username) continue;
        if (msg.photo) media.photos.push({ url: msg.photo, loc: location });
        if (msg.video) media.videos.push({ url: msg.video, loc: location });
        if (msg.audio) media.audio.push({ url: msg.audio, loc: location });
        if (msg.document) media.docs.push({ url: msg.document, name: msg.filename, loc: location });
        if (msg.sticker) media.stickers.push({ url: msg.sticker, loc: location });
      }
    };

    for (const cid of Object.keys(privateChats || {})) {
      collect(privateChats[cid], `чат ${cid}`);
    }
    for (const gid of Object.keys(groupChats || {})) {
      collect(groupChats[gid], `группа ${gid}`);
    }

    const total = Object.values(media).reduce((s, a) => s + a.length, 0);

    let report = `📸 <b>Медиа: ${username}</b>\n\n`;
    report += `<b>Всего: ${total}</b>\n`;
    report += `📷 Фото: ${media.photos.length}\n`;
    report += `🎥 Видео: ${media.videos.length}\n`;
    report += `🎵 Аудио: ${media.audio.length}\n`;
    report += `📄 Файлы: ${media.docs.length}\n`;
    report += `🎭 Стикеры: ${media.stickers.length}\n\n`;

    if (total > 0) {
      report += '<b>Файлы (нажмите для просмотра):</b>\n\n';
      
      for (const f of media.photos.slice(-10)) {
        report += `• <a href="${f.url}">📷 Фото</a> (${f.loc})\n`;
      }
      for (const f of media.videos.slice(-10)) {
        report += `• <a href="${f.url}">🎥 Видео</a> (${f.loc})\n`;
      }
      for (const f of media.docs.slice(-10)) {
        report += `• <a href="${f.url}">📄 ${f.name || 'файл'}</a> (${f.loc})\n`;
      }
      for (const f of media.audio.slice(-10)) {
        report += `• <a href="${f.url}">🎵 Аудио</a> (${f.loc})\n`;
      }
    }

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...getBackToUserKeyboard(username)
    });
  } catch (error) {
    bot.sendMessage(chatId, '❌ ' + error.message);
  }
}

// Чаты
async function showUserChats(chatId, username) {
  try {
    const accounts = await getFirebaseData('accounts');
    const userData = accounts?.[username];

    if (!userData) {
      bot.sendMessage(chatId, '❌ Не найден.');
      return;
    }

    const friends = Object.keys(userData.friends || {}).filter(f => userData.friends[f] === true);

    if (friends.length === 0) {
      bot.sendMessage(chatId, 'Нет друзей.', {
        reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: `user_${username}` }]] }
      });
      return;
    }

    let report = `💬 <b>Чаты: ${username}</b>\n\n<b>Выберите друга:</b>\n\n`;
    const keyboard = friends.map(f => [{ text: `👤 ${f}`, callback_data: `chat_${username}_${f}` }]);
    keyboard.push([{ text: '🔙 Назад', callback_data: `user_${username}` }]);

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });
  } catch (error) {
    bot.sendMessage(chatId, '❌ ' + error.message);
  }
}

// Переписка
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (!data.startsWith('chat_')) return;
  if (!checkAccess(chatId)) return;

  const parts = data.replace('chat_', '').split('_');
  const user1 = parts[0];
  const user2 = parts[1];

  try {
    bot.answerCallbackQuery(query.id);
    await showChatBetweenUsers(chatId, user1, user2);
  } catch (error) {
    bot.sendMessage(chatId, '❌ ' + error.message);
  }
});

async function showChatBetweenUsers(chatId, user1, user2) {
  bot.sendMessage(chatId, `⏳ Загрузка переписки...`);

  try {
    const privateChats = await getFirebaseData('privateChats');
    const messages = [];

    const chatId1 = `${user1}_${user2}`;
    const chatId2 = `${user2}_${user1}`;

    for (const [mid, msg] of Object.entries(privateChats?.[chatId1] || {})) {
      messages.push({ ...msg, id: mid });
    }
    for (const [mid, msg] of Object.entries(privateChats?.[chatId2] || {})) {
      messages.push({ ...msg, id: mid });
    }

    messages.sort((a, b) => (a.time || 0) - (b.time || 0));

    let report = `💬 <b>${user1} ↔️ ${user2}</b>\n\n`;
    report += `<b>Всего: ${messages.length}</b>\n\n`;

    if (messages.length > 0) {
      report += '<b>Последние 50:</b>\n\n';
      for (const msg of messages.slice(-50)) {
        report += `<b>${msg.from}</b> <i>${formatDate(msg.time)}</i>\n${formatMessageContent(msg)}\n\n`;
      }
    }

    const keyboard = {
      inline_keyboard: [
        [{ text: '🔙 К чатам', callback_data: `chats_${user1}` }],
        [{ text: '🔙 К пользователю', callback_data: `user_${user1}` }]
      ]
    };

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
  } catch (error) {
    bot.sendMessage(chatId, '❌ ' + error.message);
  }
}

// Друзья
async function showUserFriendsDetail(chatId, username) {
  try {
    const accounts = await getFirebaseData('accounts');
    const userData = accounts?.[username];

    if (!userData) {
      bot.sendMessage(chatId, '❌ Не найден.');
      return;
    }

    let report = `👥 <b>Друзья: ${username}</b>\n\n`;
    const friends = Object.keys(userData.friends || {}).filter(f => userData.friends[f] === true);

    report += `<b>Всего: ${friends.length}</b>\n\n`;

    for (const f of friends.slice(0, 20)) {
      const fd = accounts?.[f];
      const online = fd?.online ? '🟢' : '⚫';
      report += `${online} <b>${f}</b> - ${fd?.email || 'без email'}\n`;
    }

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      ...getBackToUserKeyboard(username)
    });
  } catch (error) {
    bot.sendMessage(chatId, '❌ ' + error.message);
  }
}

// Группы
async function showUserGroupsDetail(chatId, username) {
  try {
    const accounts = await getFirebaseData('accounts');
    const groups = await getFirebaseData('groups');
    const userData = accounts?.[username];

    if (!userData) {
      bot.sendMessage(chatId, '❌ Не найден.');
      return;
    }

    let report = `👥 <b>Группы: ${username}</b>\n\n`;
    const userGroups = Object.keys(userData.groups || {}).filter(g => userData.groups[g] === true);

    report += `<b>Всего: ${userGroups.length}</b>\n\n`;

    for (const g of userGroups) {
      const gd = groups?.[g];
      if (gd) {
        const members = Object.keys(gd.members || {}).length;
        const role = gd.roles?.[username] || 'member';
        const emoji = role === 'owner' ? '👑' : role === 'admin' ? '🛡️' : '👤';
        report += `${emoji} <b>${g}</b> (${members} уч.)\n`;
      } else {
        report += `👤 ${g}\n`;
      }
    }

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      ...getBackToUserKeyboard(username)
    });
  } catch (error) {
    bot.sendMessage(chatId, '❌ ' + error.message);
  }
}

// Ошибки
bot.on('polling_error', (e) => console.error('Polling:', e.code, e.message));
bot.on('error', (e) => console.error('Bot:', e));

console.log('✅ Бот готов');
