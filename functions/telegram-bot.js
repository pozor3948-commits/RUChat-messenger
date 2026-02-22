/**
 * TELEGRAM BOT ДЛЯ АДМИНИСТРАТОРОВ - РАСШИРЕННАЯ ВЕРСИЯ
 * 
 * Функционал:
 * - Интерактивные кнопки (без необходимости вводить команды вручную)
 * - Просмотр логина/пароля пользователя
 * - Реальный просмотр всех сообщений (текстом и медиа)
 * - Просмотр чатов между пользователями
 * - Добавление в черный список с блокировкой аккаунта
 * - При попытке входа заблокированного пользователя - блокировка с сообщением
 */

require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Конфигурация
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8429095689:AAGkpdRXglKH8UB6cYwUQr4N_iIBphZ-3O8';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '20091326';
const FIREBASE_DATABASE_URL = process.env.FIREBASE_DATABASE_URL || 'https://web-messenger-1694a-default-rtdb.firebaseio.com';
const SUPPORT_EMAIL = 'ruchat.offical@mail.ru';

// Разрешённые ID пользователей Telegram
const ALLOWED_TELEGRAM_IDS = process.env.ALLOWED_TELEGRAM_IDS
  ? process.env.ALLOWED_TELEGRAM_IDS.split(',').map(id => parseInt(id.trim())).filter(id => id > 0)
  : [];

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('🤖 Telegram bot started...');
console.log('📊 Firebase URL:', FIREBASE_DATABASE_URL);
console.log('👥 Allowed Telegram IDs:', ALLOWED_TELEGRAM_IDS.length > 0 ? ALLOWED_TELEGRAM_IDS : 'Все (не настроено)');
console.log('📧 Support email:', SUPPORT_EMAIL);

// Хранилище состояний для пользователей
const userStates = new Map();

// Функция для получения данных из Firebase через REST API
function getFirebaseData(aPath) {
  return new Promise((resolve, reject) => {
    const url = `${FIREBASE_DATABASE_URL}/${aPath}.json`;
    const lib = url.startsWith('https') ? https : http;
    
    const request = lib.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed);
        } catch (e) {
          reject(new Error('Failed to parse JSON: ' + e.message));
        }
      });
    }).on('error', (err) => {
      reject(err);
    });
    
    request.setTimeout(15000, () => {
      request.destroy();
      reject(new Error('Request timeout'));
    });
  });
}

// Функция для записи данных в Firebase через REST API
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

// Функция для обновления данных в Firebase (merge)
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

// Проверка доступа пользователя
function checkAccess(chatId) {
  if (ALLOWED_TELEGRAM_IDS.length === 0) return true;
  return ALLOWED_TELEGRAM_IDS.includes(chatId);
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
      resize_keyboard: true,
      one_time_keyboard: false
    }
  };
}

// Клавиатура с действиями над пользователем
function getUserKeyboard(username) {
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
          { text: '⚫ В черный список', callback_data: `blacklist_${username}` },
          { text: '🔙 Назад', callback_data: 'main_menu' }
        ]
      ]
    }
  };
}

// Клавиатура назад к пользователю
function getBackToUserKeyboard(username) {
  return {
    reply_markup: {
      inline_keyboard: [
        [{ text: '🔙 Назад к пользователю', callback_data: `user_${username}` }]
      ]
    }
  };
}

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  bot.sendMessage(chatId,
    '🔐 <b>RuChat Admin Bot</b>\n\n' +
    'Расширенный бот для администрирования мессенджера\n\n' +
    'Используйте кнопки внизу для навигации',
    {
      parse_mode: 'HTML',
      ...getMainKeyboard()
    }
  );
});

// Обработчик текстовых сообщений (кнопки)
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!checkAccess(chatId)) {
    bot.sendMessage(chatId, '❌ Доступ запрещён. Ваш ID не в списке разрешённых.');
    return;
  }

  // Игнорируем reply на сообщения бота
  if (msg.reply_to_message && msg.reply_to_message.from.is_bot) {
    return;
  }

  try {
    switch (text) {
      case '📊 Статистика':
        await handleStats(chatId);
        break;

      case '👥 Все аккаунты':
        await handleAllAccounts(chatId);
        break;

      case '🔍 Поиск пользователя':
        bot.sendMessage(chatId, '🔍 Введите имя пользователя для поиска:', {
          reply_markup: {
            force_reply: true,
            input_field_placeholder: 'Введите username'
          }
        });
        break;

      case '⚫ Черный список':
        await handleBlacklist(chatId);
        break;

      case '❓ Помощь':
        await handleHelp(chatId);
        break;

      default:
        // Проверяем, не является ли это ответом на запрос поиска
        const state = userStates.get(chatId);
        if (state && state.step === 'searching') {
          await handleUserSearch(chatId, text);
          userStates.delete(chatId);
        }
        break;
    }
  } catch (error) {
    console.error('Message handler error:', error);
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
});

// Обработчик ответа на поиск пользователя
bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!checkAccess(chatId)) return;

  const state = userStates.get(chatId);
  if (state && state.step === 'searching') {
    await handleUserSearch(chatId, text);
    userStates.delete(chatId);
  }
});

// Поиск пользователя
async function handleUserSearch(chatId, username) {
  username = username.trim();

  if (!username) {
    bot.sendMessage(chatId, '❌ Введите имя пользователя.');
    return;
  }

  bot.sendMessage(chatId, `⏳ Поиск пользователя ${username}...`);

  try {
    const accounts = await getFirebaseData('accounts');

    if (!accounts || !accounts[username]) {
      bot.sendMessage(chatId, `❌ Пользователь <b>${username}</b> не найден.`, { parse_mode: 'HTML' });
      return;
    }

    await showUserProfile(chatId, username, accounts);

  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

// Показать все аккаунты
async function handleAllAccounts(chatId) {
  // Запрашиваем админ-пароль
  bot.sendMessage(chatId, '🔑 Введите админ-пароль для доступа к данным:', {
    reply_markup: {
      force_reply: true,
      input_field_placeholder: 'Введите пароль'
    }
  }).then((sentMsg) => {
    const replyHandler = async (reply) => {
      if (reply.reply_to_message && reply.reply_to_message.message_id === sentMsg.message_id) {
        bot.removeListener('message', replyHandler);

        const enteredPassword = reply.text;

        if (enteredPassword !== ADMIN_PASSWORD) {
          bot.sendMessage(chatId, '❌ Неверный пароль! Доступ запрещён.');
          console.warn(`Неверная попытка входа от ${chatId}`);
          return;
        }

        await showAccountsList(chatId);
      }
    };

    bot.on('message', replyHandler);
  });
}

// Показать список аккаунтов
async function showAccountsList(chatId) {
  try {
    const accounts = await getFirebaseData('accounts');

    if (!accounts || Object.keys(accounts).length === 0) {
      bot.sendMessage(chatId, '📭 Аккаунтов не найдено.');
      return;
    }

    // Сохраняем состояние
    userStates.set(chatId, { accounts, step: 'accounts_list' });

    // Формируем список
    let report = '📊 <b>RuChat - Все аккаунты</b>\n\n';
    report += `Всего аккаунтов: ${Object.keys(accounts).length}\n\n`;

    const userList = Object.entries(accounts).map(([username, data]) => {
      const email = data.email || 'без email';
      const online = data.online ? '🟢' : '⚫';
      return `${online} <b>${username}</b> - ${email}`;
    }).join('\n');

    report += userList;

    // Создаём клавиатуру с кнопками для каждого пользователя
    const keyboard = Object.keys(accounts).sort().map(username => ([
      { text: `👤 ${username}`, callback_data: `user_${username}` }
    ]));

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: keyboard
      }
    });

  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

// Показать профиль пользователя
async function showUserProfile(chatId, username, allAccounts) {
  const userData = allAccounts[username];

  if (!userData) {
    bot.sendMessage(chatId, '❌ Пользователь не найден.');
    return;
  }

  let info = `👤 <b>Профиль: ${username}</b>\n\n`;

  // Основная информация
  info += `<b>📋 Данные аккаунта:</b>\n`;
  info += `   Логин: <code>${username}</code>\n`;
  info += `   Пароль: <code>${userData.password || 'не указан'}</code>\n`;
  info += `   Email: ${userData.email || 'не указан'}\n`;
  info += `   Телефон: ${userData.phoneNumber || 'не указан'}\n`;
  info += `   Провайдер: ${userData.provider || 'password'}\n`;
  info += `   В сети: ${userData.online ? '🟢 да' : '⚫ нет'}\n`;
  info += `   Последний вход: ${formatDate(userData.lastSeen)}\n`;
  info += `   Создан: ${formatDate(userData.createdAt)}\n\n`;

  // Друзья
  const friends = userData.friends || {};
  const friendList = Object.keys(friends).filter(f => friends[f] === true);
  info += `<b>👥 Друзья: ${friendList.length}</b>\n`;
  if (friendList.length > 0) {
    info += `   ${friendList.slice(0, 10).join(', ')}${friendList.length > 10 ? '...' : ''}\n`;
  }
  info += '\n';

  // Группы
  const groups = userData.groups || {};
  const groupList = Object.keys(groups).filter(g => groups[g] === true);
  info += `<b>👥 Группы: ${groupList.length}</b>\n`;
  if (groupList.length > 0) {
    info += `   ${groupList.slice(0, 10).join(', ')}${groupList.length > 10 ? '...' : ''}\n`;
  }
  info += '\n';

  // Заблокированные
  const blocked = userData.blocked || {};
  const blockedList = Object.keys(blocked).filter(b => blocked[b] === true);
  info += `<b>🚫 В черном списке: ${blockedList.length}</b>\n`;

  await bot.sendMessage(chatId, info, {
    parse_mode: 'HTML',
    ...getUserKeyboard(username)
  });

  userStates.set(chatId, {
    accounts: allAccounts,
    currentUser: username,
    step: 'user_profile'
  });
}

// Обработчик статистики
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
    const privateChatsCount = privateChats ? Object.keys(privateChats).length : 0;

    let totalMessages = 0;
    if (privateChats) {
      for (const cid of Object.keys(privateChats)) {
        totalMessages += Object.keys(privateChats[cid] || {}).length;
      }
    }

    let totalGroupMessages = 0;
    if (groupChats) {
      for (const gid of Object.keys(groupChats)) {
        totalGroupMessages += Object.keys(groupChats[gid] || {}).length;
      }
    }

    // Онлайн пользователи
    let onlineCount = 0;
    if (accounts) {
      for (const data of Object.values(accounts)) {
        if (data.online) onlineCount++;
      }
    }

    let stats = '📈 <b>RuChat Статистика</b>\n\n';
    stats += `👥 Пользователей: ${accountsCount}\n`;
    stats += `🟢 Онлайн: ${onlineCount}\n`;
    stats += `👥 Групп: ${groupsCount}\n`;
    stats += `💬 Приватных чатов: ${privateChatsCount}\n`;
    stats += `💌 Сообщений (личные): ${totalMessages}\n`;
    stats += `💌 Сообщений (группы): ${totalGroupMessages}\n`;
    stats += `📊 Всего сообщений: ${totalMessages + totalGroupMessages}\n`;

    bot.sendMessage(chatId, stats, { parse_mode: 'HTML' });

  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

// Обработчик черного списка
async function handleBlacklist(chatId) {
  try {
    const accounts = await getFirebaseData('accounts');

    if (!accounts) {
      bot.sendMessage(chatId, '❌ Ошибка получения данных.');
      return;
    }

    let report = '⚫ <b>Черный список мессенджера</b>\n\n';

    const blockedUsers = [];
    for (const [username, data] of Object.entries(accounts)) {
      if (data.blocked) {
        const blockedList = Object.keys(data.blocked).filter(b => data.blocked[b] === true);
        if (blockedList.length > 0) {
          blockedUsers.push({ username, blocked: blockedList });
        }
      }
    }

    if (blockedUsers.length === 0) {
      report += 'Пользователей в черном списке нет.\n';
    } else {
      for (const item of blockedUsers) {
        report += `<b>${item.username}</b> заблокировал: ${item.blocked.join(', ')}\n`;
      }
    }

    report += '\n<i>Для добавления в черный список выберите пользователя в списке аккаунтов</i>';

    bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      ...getMainKeyboard()
    });

  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

// Обработчик помощи
async function handleHelp(chatId) {
  const helpText = '📖 <b>Помощь по RuChat Admin Bot</b>\n\n' +
    '<b>📋 Основные функции:</b>\n\n' +
    '📊 <b>Статистика</b> - Общая информация о мессенджере\n' +
    '👥 <b>Все аккаунты</b> - Список всех пользователей с кнопками\n' +
    '🔍 <b>Поиск пользователя</b> - Быстрый поиск по username\n' +
    '⚫ <b>Черный список</b> - Просмотр заблокированных пользователей\n\n' +
    '<b>🔧 Действия с пользователем:</b>\n\n' +
    '📨 <b>Сообщения</b> - Все сообщения пользователя\n' +
    '📸 <b>Медиа</b> - Фото, видео, файлы\n' +
    '💬 <b>Чаты</b> - Переписки с друзьями\n' +
    '👥 <b>Друзья</b> - Список друзей\n' +
    '👥 <b>Группы</b> - Группы пользователя\n' +
    '📋 <b>Профиль</b> - Основная информация\n' +
    '⚫ <b>В черный список</b> - Заблокировать пользователя\n\n' +
    '<b>🔒 Безопасность:</b>\n' +
    '• Для доступа требуется админ-пароль\n' +
    '• Пароль по умолчанию: 20091326\n' +
    '• Рекомендуется изменить в .env\n\n' +
    '<b>⚠️ Блокировка:</b>\n' +
    'При добавлении пользователя в черный список:\n' +
    '• Его выкидывает из аккаунта\n' +
    '• При попытке входа показывается сообщение о блокировке\n' +
    '• Для разблокировки напишите на ' + SUPPORT_EMAIL;

  bot.sendMessage(chatId, helpText, {
    parse_mode: 'HTML',
    ...getMainKeyboard()
  });
}

// Обработчик callback query (нажатия на кнопки)
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (!checkAccess(chatId)) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Доступ запрещён.' });
    return;
  }

  const parts = data.split('_');
  const action = parts[0];
  const username = parts.slice(1).join('_');

  try {
    switch (action) {
      case 'user':
        const state = userStates.get(chatId);
        const accounts = state?.accounts || await getFirebaseData('accounts');
        if (accounts && accounts[username]) {
          await showUserProfile(chatId, username, accounts);
        } else {
          await bot.answerCallbackQuery(query.id, { text: '❌ Пользователь не найден.' });
        }
        break;

      case 'messages':
        await showUserMessages(chatId, username);
        break;

      case 'media':
        await showUserMedia(chatId, username);
        break;

      case 'chats':
        await showUserChats(chatId, username);
        break;

      case 'friends':
        await showUserFriendsDetail(chatId, username);
        break;

      case 'groups':
        await showUserGroupsDetail(chatId, username);
        break;

      case 'profile':
        const profileState = userStates.get(chatId);
        const profileAccounts = profileState?.accounts || await getFirebaseData('accounts');
        await showUserProfile(chatId, username, profileAccounts);
        break;

      case 'blacklist':
        await handleBlacklistUser(chatId, username);
        break;

      case 'main_menu':
        bot.sendMessage(chatId, '🔙 Главное меню', getMainKeyboard());
        break;
    }

    await bot.answerCallbackQuery(query.id);

  } catch (error) {
    console.error('Callback error:', error);
    await bot.answerCallbackQuery(query.id, { text: '❌ Ошибка: ' + error.message });
  }
});

// Показать сообщения пользователя
async function showUserMessages(chatId, username) {
  await bot.sendMessage(chatId, `⏳ Загрузка сообщений пользователя ${username}...`);

  try {
    const [privateChats, groupChats] = await Promise.all([
      getFirebaseData('privateChats'),
      getFirebaseData('groupChats')
    ]);

    let report = `📨 <b>Сообщения пользователя: ${username}</b>\n\n`;
    let totalMessages = 0;
    const messagesList = [];

    // Личные сообщения
    if (privateChats) {
      for (const cid of Object.keys(privateChats)) {
        const messages = privateChats[cid] || {};
        for (const [msgId, msg] of Object.entries(messages)) {
          if (msg.from === username) {
            totalMessages++;
            const content = formatMessageContent(msg);
            const time = formatDate(msg.time);
            messagesList.push({ time, content, type: 'private', chatId: cid, msgId });
          }
        }
      }
    }

    // Групповые сообщения
    if (groupChats) {
      for (const gid of Object.keys(groupChats)) {
        const messages = groupChats[gid] || {};
        for (const [msgId, msg] of Object.entries(messages)) {
          if (msg.from === username) {
            totalMessages++;
            const content = formatMessageContent(msg);
            const time = formatDate(msg.time);
            messagesList.push({ time, content, type: 'group', groupId: gid, msgId });
          }
        }
      }
    }

    // Сортируем по времени
    messagesList.sort((a, b) => new Date(b.time) - new Date(a.time));

    report += `<b>Всего сообщений: ${totalMessages}</b>\n\n`;

    if (messagesList.length > 0) {
      report += '<b>Последние 30 сообщений:</b>\n\n';
      for (const msg of messagesList.slice(0, 30)) {
        const icon = msg.type === 'private' ? '💬' : '👥';
        report += `${icon} <b>${msg.time}</b>\n${msg.content}\n\n`;
      }

      // Если есть больше сообщений
      if (messagesList.length > 30) {
        report += `\n<i>...и ещё ${messagesList.length - 30} сообщений</i>\n`;
      }
    } else {
      report += 'Сообщений не найдено.';
    }

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      ...getBackToUserKeyboard(username)
    });

  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

// Форматирование содержимого сообщения
function formatMessageContent(msg) {
  let content = '';

  if (msg.text) {
    content = msg.text.length > 100 ? msg.text.substring(0, 100) + '...' : msg.text;
  } else if (msg.photo) {
    content = `📷 Фото: ${msg.photo.substring(0, 50)}...`;
  } else if (msg.video) {
    content = `🎥 Видео: ${msg.video.substring(0, 50)}...`;
  } else if (msg.audio) {
    content = `🎵 Аудио: ${msg.audio.substring(0, 50)}...`;
  } else if (msg.document) {
    content = `📄 Файл: ${msg.filename || 'без имени'}`;
  } else if (msg.sticker) {
    content = `🎭 Стикер: ${msg.sticker.substring(0, 50)}...`;
  } else {
    content = '[Пустое сообщение]';
  }

  // Добавляем reply info если есть
  if (msg.replyTo) {
    content += `\n   ↳ В ответ на: ${msg.replyTo.text || '[сообщение]'}`;
  }

  return content;
}

// Показать медиа пользователя
async function showUserMedia(chatId, username) {
  await bot.sendMessage(chatId, `⏳ Загрузка медиа файлов пользователя ${username}...`);

  try {
    const [privateChats, groupChats] = await Promise.all([
      getFirebaseData('privateChats'),
      getFirebaseData('groupChats')
    ]);

    let report = `📸 <b>Медиа файлы пользователя: ${username}</b>\n\n`;
    const mediaFiles = {
      photos: [],
      videos: [],
      audio: [],
      documents: [],
      stickers: []
    };

    // Собираем медиа из личных чатов
    if (privateChats) {
      for (const cid of Object.keys(privateChats)) {
        const messages = privateChats[cid] || {};
        for (const [msgId, msg] of Object.entries(messages)) {
          if (msg.from === username) {
            if (msg.photo) mediaFiles.photos.push({ url: msg.photo, chat: cid, time: msg.time });
            if (msg.video) mediaFiles.videos.push({ url: msg.video, chat: cid, time: msg.time });
            if (msg.audio) mediaFiles.audio.push({ url: msg.audio, chat: cid, time: msg.time, filename: msg.filename });
            if (msg.document) mediaFiles.documents.push({ url: msg.document, chat: cid, time: msg.time, filename: msg.filename });
          }
        }
      }
    }

    // Собираем медиа из групповых чатов
    if (groupChats) {
      for (const gid of Object.keys(groupChats)) {
        const messages = groupChats[gid] || {};
        for (const [msgId, msg] of Object.entries(messages)) {
          if (msg.from === username) {
            if (msg.photo) mediaFiles.photos.push({ url: msg.photo, group: gid, time: msg.time });
            if (msg.video) mediaFiles.videos.push({ url: msg.video, group: gid, time: msg.time });
            if (msg.audio) mediaFiles.audio.push({ url: msg.audio, group: gid, time: msg.time, filename: msg.filename });
            if (msg.document) mediaFiles.documents.push({ url: msg.document, group: gid, time: msg.time, filename: msg.filename });
            if (msg.sticker) mediaFiles.stickers.push({ url: msg.sticker, group: gid, time: msg.time });
          }
        }
      }
    }

    const totalCount = Object.values(mediaFiles).reduce((sum, arr) => sum + arr.length, 0);
    report += `<b>Всего медиа файлов: ${totalCount}</b>\n\n`;
    report += `📷 Фото: ${mediaFiles.photos.length}\n`;
    report += `🎥 Видео: ${mediaFiles.videos.length}\n`;
    report += `🎵 Аудио: ${mediaFiles.audio.length}\n`;
    report += `📄 Файлы: ${mediaFiles.documents.length}\n`;
    report += `🎭 Стикеры: ${mediaFiles.stickers.length}\n\n`;

    // Показываем последние файлы с ссылками
    if (totalCount > 0) {
      report += '<b>Последние файлы (нажмите для просмотра):</b>\n\n';

      // Фото
      if (mediaFiles.photos.length > 0) {
        report += '<b>📷 Последние фото:</b>\n';
        for (const file of mediaFiles.photos.slice(-10)) {
          const location = file.chat ? `чат ${file.chat}` : `группа ${file.group}`;
          report += `• <a href="${file.url}">Просмотреть фото</a> (${location})\n`;
        }
        report += '\n';
      }

      // Видео
      if (mediaFiles.videos.length > 0) {
        report += '<b>🎥 Последние видео:</b>\n';
        for (const file of mediaFiles.videos.slice(-10)) {
          const location = file.chat ? `чат ${file.chat}` : `группа ${file.group}`;
          report += `• <a href="${file.url}">Просмотреть видео</a> (${location})\n`;
        }
        report += '\n';
      }

      // Документы
      if (mediaFiles.documents.length > 0) {
        report += '<b>📄 Последние файлы:</b>\n';
        for (const file of mediaFiles.documents.slice(-10)) {
          const location = file.chat ? `чат ${file.chat}` : `группа ${file.group}`;
          const name = file.filename || 'без имени';
          report += `• <a href="${file.url}">${name}</a> (${location})\n`;
        }
        report += '\n';
      }

      // Аудио
      if (mediaFiles.audio.length > 0) {
        report += '<b>🎵 Последние аудио:</b>\n';
        for (const file of mediaFiles.audio.slice(-10)) {
          const location = file.chat ? `чат ${file.chat}` : `группа ${file.group}`;
          const name = file.filename || 'голосовое сообщение';
          report += `• <a href="${file.url}">${name}</a> (${location})\n`;
        }
        report += '\n';
      }
    } else {
      report += 'Медиа файлов не найдено.';
    }

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      disable_web_page_preview: false,
      ...getBackToUserKeyboard(username)
    });

  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

// Показать чаты пользователя с друзьями
async function showUserChats(chatId, username) {
  await bot.sendMessage(chatId, `⏳ Загрузка чатов пользователя ${username}...`);

  try {
    const accounts = await getFirebaseData('accounts');
    const userData = accounts?.[username];

    if (!userData) {
      bot.sendMessage(chatId, '❌ Пользователь не найден.');
      return;
    }

    const friends = userData.friends || {};
    const friendList = Object.keys(friends).filter(f => friends[f] === true);

    if (friendList.length === 0) {
      bot.sendMessage(chatId, `У пользователя ${username} нет друзей.`, {
        reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: `user_${username}` }]] }
      });
      return;
    }

    // Формируем список чатов с друзьями
    let report = `💬 <b>Чаты пользователя: ${username}</b>\n\n`;
    report += '<b>Выберите друга для просмотра переписки:</b>\n\n';

    const keyboard = [];
    for (const friend of friendList) {
      keyboard.push([{ text: `👤 ${friend}`, callback_data: `chat_${username}_${friend}` }]);
    }
    keyboard.push([{ text: '🔙 Назад', callback_data: `user_${username}` }]);

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: keyboard }
    });

  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

// Показать переписку между двумя пользователями
async function showChatBetweenUsers(chatId, user1, user2) {
  await bot.sendMessage(chatId, `⏳ Загрузка переписки между ${user1} и ${user2}...`);

  try {
    const privateChats = await getFirebaseData('privateChats');

    // Формируем ID чата (может быть user1_user2 или user2_user1)
    const chatId1 = `${user1}_${user2}`;
    const chatId2 = `${user2}_${user1}`;

    const messages1 = privateChats?.[chatId1] || {};
    const messages2 = privateChats?.[chatId2] || {};

    // Объединяем сообщения
    const allMessages = [];
    for (const [msgId, msg] of Object.entries(messages1)) {
      allMessages.push({ ...msg, id: msgId });
    }
    for (const [msgId, msg] of Object.entries(messages2)) {
      allMessages.push({ ...msg, id: msgId });
    }

    // Сортируем по времени
    allMessages.sort((a, b) => (a.time || 0) - (b.time || 0));

    let report = `💬 <b>Переписка: ${user1} ↔️ ${user2}</b>\n\n`;
    report += `<b>Всего сообщений: ${allMessages.length}</b>\n\n`;

    if (allMessages.length > 0) {
      report += '<b>Последние 50 сообщений:</b>\n\n';

      const recentMessages = allMessages.slice(-50);
      for (const msg of recentMessages) {
        const sender = msg.from;
        const time = formatDate(msg.time);
        const content = formatMessageContent(msg);

        const senderIcon = sender === user1 ? '👤' : '👤';
        report += `${senderIcon} <b>${sender}</b> <i>${time}</i>\n${content}\n\n`;
      }

      if (allMessages.length > 50) {
        report += `\n<i>...и ещё ${allMessages.length - 50} сообщений</i>\n`;
      }
    } else {
      report += 'Переписка пуста.';
    }

    const keyboard = {
      inline_keyboard: [
        [{ text: '🔙 К списку чатов', callback_data: `chats_${user1}` }],
        [{ text: '🔙 К пользователю', callback_data: `user_${user1}` }]
      ]
    };

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });

  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

// Показать друзей пользователя подробно
async function showUserFriendsDetail(chatId, username) {
  await bot.sendMessage(chatId, `⏳ Загрузка друзей пользователя ${username}...`);

  try {
    const accounts = await getFirebaseData('accounts');
    const userData = accounts?.[username];

    if (!userData) {
      bot.sendMessage(chatId, '❌ Пользователь не найден.');
      return;
    }

    let report = `👥 <b>Друзья пользователя: ${username}</b>\n\n`;

    const friends = userData.friends || {};
    const friendList = Object.keys(friends).filter(f => friends[f] === true);

    report += `<b>Друзья (${friendList.length}):</b>\n\n`;

    if (friendList.length > 0) {
      for (const friend of friendList) {
        const friendData = accounts?.[friend];
        const online = friendData?.online ? '🟢' : '⚫';
        const email = friendData?.email || 'без email';
        const phone = friendData?.phoneNumber || '';
        report += `${online} <b>${friend}</b>\n`;
        report += `   📧 ${email}`;
        if (phone) report += `\n   📱 ${phone}`;
        report += '\n\n';
      }
    } else {
      report += 'нет друзей\n';
    }

    // Заявки
    const friendRequests = userData.friendRequests || { incoming: {}, outgoing: {} };
    const incomingRequests = Object.keys(friendRequests.incoming || {});
    const outgoingRequests = Object.keys(friendRequests.outgoing || {});

    report += `\n<b>Заявки в друзья:</b>\n`;
    report += `   Входящие (${incomingRequests.length}): ${incomingRequests.join(', ') || 'нет'}\n`;
    report += `   Исходящие (${outgoingRequests.length}): ${outgoingRequests.join(', ') || 'нет'}\n`;

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      ...getBackToUserKeyboard(username)
    });

  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

// Показать группы пользователя подробно
async function showUserGroupsDetail(chatId, username) {
  await bot.sendMessage(chatId, `⏳ Загрузка групп пользователя ${username}...`);

  try {
    const accounts = await getFirebaseData('accounts');
    const groups = await getFirebaseData('groups');
    const userData = accounts?.[username];

    if (!userData) {
      bot.sendMessage(chatId, '❌ Пользователь не найден.');
      return;
    }

    let report = `👥 <b>Группы пользователя: ${username}</b>\n\n`;

    const userGroups = userData.groups || {};
    const groupList = Object.keys(userGroups).filter(g => userGroups[g] === true);

    report += `<b>Состоит в группах (${groupList.length}):</b>\n\n`;

    if (groupList.length > 0) {
      for (const groupName of groupList) {
        const groupData = groups?.[groupName];
        if (groupData) {
          const membersCount = Object.keys(groupData.members || {}).length;
          const role = groupData.roles?.[username] || 'member';
          const roleEmoji = role === 'owner' ? '👑' : role === 'admin' ? '🛡️' : '👤';
          report += `${roleEmoji} <b>${groupName}</b> (${membersCount} участников)\n`;
          report += `   Создатель: ${groupData.createdBy || 'неизвестно'}\n`;
          report += `   Создана: ${formatDate(groupData.createdAt)}\n\n`;
        } else {
          report += `👤 ${groupName}\n\n`;
        }
      }
    } else {
      report += 'не состоит в группах\n';
    }

    await bot.sendMessage(chatId, report, {
      parse_mode: 'HTML',
      ...getBackToUserKeyboard(username)
    });

  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
}

// Обработка добавления в черный список
async function handleBlacklistUser(chatId, username) {
  // Подтверждение действия
  const confirmKeyboard = {
    inline_keyboard: [
      [
        { text: '✅ Да, заблокировать', callback_data: `blacklist_confirm_${username}` },
        { text: '❌ Отмена', callback_data: `user_${username}` }
      ]
    ]
  };

  await bot.sendMessage(chatId,
    `⚠️ <b>Подтверждение блокировки</b>\n\n` +
    `Вы действительно хотите заблокировать пользователя <b>${username}</b>?\n\n` +
    `<b>Последствия:</b>\n` +
    '• Пользователь будет выкинут из аккаунта\n' +
    '• При попытке входа покажется сообщение о блокировке\n' +
    '• Для разблокировки нужно писать на ' + SUPPORT_EMAIL,
    {
      parse_mode: 'HTML',
      reply_markup: confirmKeyboard
    }
  );
}

// Подтверждение блокировки
async function confirmBlacklistUser(chatId, username) {
  try {
    // Добавляем пользователя в глобальный черный список
    const blockedPath = `blockedUsers/${username}`;
    await setFirebaseData(blockedPath, {
      blocked: true,
      blockedAt: Date.now(),
      reason: 'Нарушение правил пользования мессенджером',
      blockedBy: 'admin'
    });

    // Также помечаем в аккаунте
    await updateFirebaseData(`accounts/${username}`, {
      blocked: { admin: true },
      online: false,
      lastSeen: Date.now()
    });

    console.log(`Пользователь ${username} заблокирован администратором из Telegram`);

    await bot.sendMessage(chatId,
      `✅ <b>Пользователь ${username} заблокирован!</b>\n\n` +
      `• Пользователь выкинут из аккаунта\n` +
      `• При попытке входа покажется сообщение о блокировке\n` +
      `• Для разблокировки пишите на ${SUPPORT_EMAIL}\n\n` +
      `<i>Для разблокировки используйте Firebase Console или напрямую через базу данных</i>`,
      {
        parse_mode: 'HTML',
        ...getMainKeyboard()
      }
    );

  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка при блокировке: ' + error.message);
  }
}

// Обработчик для подтверждения блокировки
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (!checkAccess(chatId)) {
    await bot.answerCallbackQuery(query.id, { text: '❌ Доступ запрещён.' });
    return;
  }

  if (data.startsWith('blacklist_confirm_')) {
    const username = data.replace('blacklist_confirm_', '');
    await confirmBlacklistUser(chatId, username);
    await bot.answerCallbackQuery(query.id);
  }

  if (data.startsWith('chat_')) {
    const parts = data.replace('chat_', '').split('_');
    const user1 = parts[0];
    const user2 = parts[1];
    await showChatBetweenUsers(chatId, user1, user2);
    await bot.answerCallbackQuery(query.id);
  }
});

// Логирование ошибок
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

bot.on('error', (error) => {
  console.error('Telegram bot error:', error);
});

console.log('✅ Telegram bot initialized successfully');
