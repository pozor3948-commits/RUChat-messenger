/**
 * TELEGRAM BOT ДЛЯ АДМИНИСТРАТОРОВ
 * Присылает список всех зарегистрированных аккаунтов
 * Доступ только для разработчиков с админ-паролем
 */

const TelegramBot = require('node-telegram-bot-api');
const admin = require('firebase-admin');

// Инициализация Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    databaseURL: process.env.FIREBASE_DATABASE_URL
  });
}

const db = admin.database();

// Конфигурация бота
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8429095689:AAGkpdRXglKH8UB6cYwUQr4N_iIBphZ-3O8';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '20091326';

// Разрешённые ID пользователей Telegram (добавьте свои)
const ALLOWED_TELEGRAM_IDS = process.env.ALLOWED_TELEGRAM_IDS 
  ? process.env.ALLOWED_TELEGRAM_IDS.split(',').map(id => parseInt(id.trim()))
  : [];

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

console.log('Telegram bot started...');

// Обработчик команды /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId, 
    '🔐 RuChat Admin Bot\n\n' +
    'Доступные команды:\n' +
    '/accounts - Получить список всех аккаунтов\n' +
    '/help - Помощь'
  );
});

// Обработчик команды /help
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  
  bot.sendMessage(chatId,
    '📖 Помощь:\n\n' +
    '1. Отправьте команду /accounts\n' +
    '2. Введите админ-пароль когда бот попросит\n' +
    '3. Бот пришлёт список всех аккаунтов\n\n' +
    'Данные включают:\n' +
    '- Логин (username)\n' +
    '- Email\n' +
    '- Номер телефона\n' +
    '- Друзья\n' +
    '- Группы\n' +
    '- Дата создания\n' +
    '- Последний вход'
  );
});

// Обработчик команды /accounts
bot.onText(/\/accounts/, async (msg) => {
  const chatId = msg.chat.id;
  
  // Проверяем, разрешён ли пользователь
  if (ALLOWED_TELEGRAM_IDS.length > 0 && !ALLOWED_TELEGRAM_IDS.includes(chatId)) {
    bot.sendMessage(chatId, '❌ Доступ запрещён. Ваш ID не в списке разрешённых.');
    return;
  }
  
  // Запрашиваем админ-пароль
  bot.sendMessage(chatId, '🔑 Введите админ-пароль для доступа к данным:', {
    reply_markup: {
      force_reply: true,
      input_field_placeholder: 'Введите пароль'
    }
  }).then((sentMsg) => {
    // Сохраняем ожидание пароля для этого чата
    bot.once('message', async (reply) => {
      if (reply.reply_to_message && reply.reply_to_message.message_id === sentMsg.message_id) {
        const enteredPassword = reply.text;
        
        if (enteredPassword !== ADMIN_PASSWORD) {
          bot.sendMessage(chatId, '❌ Неверный пароль! Доступ запрещён.');
          console.warn(`Неверная попытка входа от ${chatId}`);
          return;
        }
        
        // Пароль верный - получаем данные
        bot.sendMessage(chatId, '⏳ Загрузка данных...');
        
        try {
          const snapshot = await db.ref('accounts').once('value');
          const accounts = snapshot.val() || {};
          
          if (Object.keys(accounts).length === 0) {
            bot.sendMessage(chatId, '📭 Аккаунтов не найдено.');
            return;
          }
          
          // Формируем отчёт
          let report = '📊 RuChat - Все аккаунты\n\n';
          report += `Всего аккаунтов: ${Object.keys(accounts).length}\n\n`;
          report += '='.repeat(50) + '\n\n';
          
          for (const [username, data] of Object.entries(accounts)) {
            report += `👤 ${username}\n`;
            report += `   Email: ${data.email || 'не указан'}\n`;
            report += `   Телефон: ${data.phoneNumber || 'не указан'}\n`;
            report += `   Провайдер: ${data.provider || 'password'}\n`;
            
            // Друзья
            const friends = data.friends || {};
            const friendList = Object.keys(friends).filter(f => friends[f] === true);
            report += `   Друзья: ${friendList.length > 0 ? friendList.join(', ') : 'нет'}\n`;
            
            // Группы
            const groups = data.groups || {};
            const groupList = Object.keys(groups).filter(g => groups[g] === true);
            report += `   Группы: ${groupList.length > 0 ? groupList.join(', ') : 'нет'}\n`;
            
            // Заявки в друзья
            const friendRequests = data.friendRequests || { incoming: {}, outgoing: {} };
            const incomingRequests = Object.keys(friendRequests.incoming || {});
            const outgoingRequests = Object.keys(friendRequests.outgoing || {});
            report += `   Заявки (входящие): ${incomingRequests.join(', ') || 'нет'}\n`;
            report += `   Заявки (исходящие): ${outgoingRequests.join(', ') || 'нет'}\n`;
            
            // Статус
            report += `   В сети: ${data.online ? 'да' : 'нет'}\n`;
            report += `   Последний вход: ${data.lastSeen ? new Date(data.lastSeen).toLocaleString('ru-RU') : 'неизвестно'}\n`;
            report += `   Создан: ${data.createdAt ? new Date(data.createdAt).toLocaleString('ru-RU') : 'неизвестно'}\n`;
            
            // Заблокированные
            const blocked = data.blocked || {};
            const blockedList = Object.keys(blocked).filter(b => blocked[b] === true);
            report += `   Заблокированные: ${blockedList.join(', ') || 'нет'}\n`;
            
            report += '\n' + '-'.repeat(50) + '\n\n';
            
            // Отправляем частями (Telegram имеет лимит на длину сообщения)
            if (report.length > 3000) {
              await bot.sendMessage(chatId, report.substring(0, 3000));
              report = report.substring(3000);
            }
          }
          
          // Отправляем остаток
          if (report.length > 0) {
            await bot.sendMessage(chatId, report);
          }
          
          console.log(`Данные отправлены пользователю ${chatId}`);
          
        } catch (error) {
          console.error('Ошибка получения данных:', error);
          bot.sendMessage(chatId, '❌ Ошибка при получении данных: ' + error.message);
        }
      }
    });
  });
});

// Обработчик команды /stats
bot.onText(/\/stats/, async (msg) => {
  const chatId = msg.chat.id;
  
  if (ALLOWED_TELEGRAM_IDS.length > 0 && !ALLOWED_TELEGRAM_IDS.includes(chatId)) {
    bot.sendMessage(chatId, '❌ Доступ запрещён.');
    return;
  }
  
  try {
    const [accountsSnap, groupsSnap, privateChatsSnap] = await Promise.all([
      db.ref('accounts').once('value'),
      db.ref('groups').once('value'),
      db.ref('privateChats').once('value')
    ]);
    
    const accountsCount = Object.keys(accountsSnap.val() || {}).length;
    const groupsCount = Object.keys(groupsSnap.val() || {}).length;
    const privateChatsCount = Object.keys(privateChatsSnap.val() || {}).length;
    
    let stats = '📈 RuChat Статистика\n\n';
    stats += `👥 Пользователей: ${accountsCount}\n`;
    stats += `👥 Групп: ${groupsCount}\n`;
    stats += `💬 Приватных чатов: ${privateChatsCount}\n`;
    
    bot.sendMessage(chatId, stats);
    
  } catch (error) {
    bot.sendMessage(chatId, '❌ Ошибка: ' + error.message);
  }
});

// Логирование ошибок
bot.on('polling_error', (error) => {
  console.error('Polling error:', error.code, error.message);
});

bot.on('error', (error) => {
  console.error('Telegram bot error:', error);
});

console.log('Telegram bot initialized successfully');
console.log('Allowed Telegram IDs:', ALLOWED_TELEGRAM_IDS.length > 0 ? ALLOWED_TELEGRAM_IDS : 'Все (не настроено)');
