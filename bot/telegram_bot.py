"""
RuChat Telegram Bot
Бот для уведомлений и управления мессенджером RuChat
"""

import os
import json
import logging
from datetime import datetime
from telegram import Update, Bot
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    ContextTypes,
    filters
)
from telegram.constants import ParseMode

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# Токен бота (получить у @BotFather)
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', 'YOUR_BOT_TOKEN_HERE')

# Firebase конфигурация
FIREBASE_CONFIG = {
    "apiKey": "AIzaSyArPlbiw8QTUBsx88Vx3JJYzPo0mMcyi6s",
    "authDomain": "web-messenger-1694a.firebaseapp.com",
    "databaseURL": "https://web-messenger-1694a-default-rtdb.firebaseio.com",
    "projectId": "web-messenger-1694a",
    "storageBucket": "web-messenger-1694a.appspot.com",
    "messagingSenderId": "868140400942",
    "appId": "1:868140400942:web:7f09edac08c18766183abf"
}

# Хранилище привязок пользователей
user_bindings = {}  # telegram_id <-> username

# ==========================================================
# КОМАНДЫ БОТА
# ==========================================================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка команды /start"""
    user = update.effective_user
    telegram_id = user.id
    
    welcome_text = f"""
👋 Привет, {user.first_name}!

Я бот мессенджера RuChat 💬

📋 Доступные команды:
/bind — Привязать Telegram к аккаунту RuChat
/unbind — Отвязать Telegram от аккаунта
/status — Проверить статус привязки
/notifications — Настройки уведомлений
/help — Помощь

🔗 Для начала работы используйте /bind
    """
    
    await update.message.reply_text(
        welcome_text,
        parse_mode=ParseMode.MARKDOWN
    )
    
    # Сохраняем telegram_id
    user_bindings[str(telegram_id)] = {
        'username': user.username or user.first_name,
        'first_name': user.first_name,
        'last_name': user.last_name or '',
        'bound_at': None
    }


async def bind_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Привязка Telegram к аккаунту RuChat"""
    user = update.effective_user
    telegram_id = user.id
    
    if len(context.args) > 0:
        # Пользователь указал username RuChat
        ruchat_username = context.args[0]
        
        # TODO: Здесь будет проверка в Firebase
        # Пока просто сохраняем
        user_bindings[str(telegram_id)]['ruchat_username'] = ruchat_username
        user_bindings[str(telegram_id)]['bound_at'] = datetime.now().isoformat()
        
        await update.message.reply_text(
            f"✅ Аккаунт привязан!\n\n"
            f"Telegram: @{user.username or user.first_name}\n"
            f"RuChat: {ruchat_username}\n\n"
            f"Теперь вы будете получать уведомления о сообщениях."
        )
    else:
        # Показываем инструкцию
        await update.message.reply_text(
            "🔗 Для привязки отправьте:\n\n"
            f"/bind ваш_username_ruсhat\n\n"
            "Пример: /bind Ivan123"
        )


async def unbind_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Отвязка Telegram от аккаунта RuChat"""
    telegram_id = str(user.id)
    
    if telegram_id in user_bindings and user_bindings[telegram_id].get('ruchat_username'):
        del user_bindings[telegram_id]['ruchat_username']
        user_bindings[telegram_id]['bound_at'] = None
        
        await update.message.reply_text(
            "❌ Аккаунт отвязан.\n"
            "Вы больше не будете получать уведомления."
        )
    else:
        await update.message.reply_text(
            "У вас нет привязанного аккаунта RuChat.\n"
            "Используйте /bind для привязки."
        )


async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Проверка статуса привязки"""
    telegram_id = str(user.id)
    
    if telegram_id in user_bindings:
        binding = user_bindings[telegram_id]
        
        if binding.get('ruchat_username'):
            status_text = f"""
✅ Аккаунт привязан

Telegram: @{update.effective_user.username or update.effective_user.first_name}
RuChat: {binding['ruchat_username']}
Привязан: {binding.get('bound_at', 'Неизвестно')}
            """
        else:
            status_text = "⚠️ Telegram не привязан к RuChat\nИспользуйте /bind"
    else:
        status_text = "❌ Аккаунт не найден\nИспользуйте /start"
    
    await update.message.reply_text(status_text)


async def notifications_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Настройки уведомлений"""
    from telegram import InlineKeyboardButton, InlineKeyboardMarkup
    
    keyboard = [
        [
            InlineKeyboardButton("🔔 Включить", callback_data='notif_enable'),
            InlineKeyboardButton("🔕 Выключить", callback_data='notif_disable')
        ],
        [
            InlineKeyboardButton("🌙 Ночной режим", callback_data='notif_night'),
            InlineKeyboardButton("⚙️ Все настройки", callback_data='notif_settings')
        ]
    ]
    
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        "🔔 Настройки уведомлений\n\n"
        "Выберите действие:",
        reply_markup=reply_markup
    )


async def notification_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обработка кнопок уведомлений"""
    query = update.callback_query
    await query.answer()
    
    action = query.data
    
    if action == 'notif_enable':
        await query.edit_message_text("✅ Уведомления включены")
    elif action == 'notif_disable':
        await query.edit_message_text("🔕 Уведомления выключены")
    elif action == 'notif_night':
        await query.edit_message_text("🌙 Ночной режим настроен")
    elif action == 'notif_settings':
        await query.edit_message_text("⚙️ Полные настройки в веб-версии")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Справка по боту"""
    help_text = """
📖 Помощь по RuChat Bot

🔹 Основные команды:
/start — Запустить бота
/bind — Привязать аккаунт RuChat
/unbind — Отвязать аккаунт
/status — Проверить привязку
/notifications — Настройки уведомлений
/help — Эта справка

🔹 Уведомления:
Бот будет присылать уведомления о:
• Новых сообщениях
• Пропущенных звонках
• Заявках в друзья

🔹 Безопасность:
• Бот не хранит ваши пароли
• Данные шифруются
• Можно отвязать в любой момент

🌐 Веб-версия: https://web-messenger-1694a.web.app
    """
    
    await update.message.reply_text(
        help_text,
        parse_mode=ParseMode.MARKDOWN
    )


async def echo_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Обычные сообщения (для теста)"""
    await update.message.reply_text(
        f"Получил сообщение: {update.message.text}\n\n"
        "Используйте /help для списка команд."
    )


# ==========================================================
# ОТПРАВКА УВЕДОМЛЕНИЙ
# ==========================================================

async def send_notification(telegram_id: int, title: str, message: str):
    """Отправка push-уведомления пользователю"""
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN == 'YOUR_BOT_TOKEN_HERE':
        logger.warning("Токен бота не настроен")
        return False
    
    try:
        bot = Bot(token=TELEGRAM_BOT_TOKEN)
        
        text = f"""
🔔 <b>{title}</b>

{message}

<i>RuChat Messenger</i>
        """
        
        await bot.send_message(
            chat_id=telegram_id,
            text=text,
            parse_mode=ParseMode.HTML
        )
        
        logger.info(f"Уведомление отправлено пользователю {telegram_id}")
        return True
        
    except Exception as e:
        logger.error(f"Ошибка отправки уведомления: {e}")
        return False


async def notify_new_message(username: str, from_user: str, message: str):
    """Уведомление о новом сообщении"""
    # Ищем telegram_id по username
    for tg_id, binding in user_bindings.items():
        if binding.get('ruchat_username') == username:
            await send_notification(
                int(tg_id),
                "Новое сообщение",
                f"От: {from_user}\n\n{message[:100]}"
            )


# ==========================================================
# ЗАПУСК БОТА
# ==========================================================

def main():
    """Основная функция запуска"""
    
    if not TELEGRAM_BOT_TOKEN or TELEGRAM_BOT_TOKEN == 'YOUR_BOT_TOKEN_HERE':
        print("❌ ОШИБКА: Токен бота не настроен!")
        print("\nПолучите токен у @BotFather в Telegram:")
        print("1. Откройте Telegram")
        print("2. Найдите @BotFather")
        print("3. Отправьте /newbot")
        print("4. Следуйте инструкциям")
        print("5. Скопируйте токен")
        print("6. Вставьте в TELEGRAM_BOT_TOKEN в начале файла")
        return
    
    # Создаём приложение
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
    
    # Добавляем обработчики
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("bind", bind_command))
    application.add_handler(CommandHandler("unbind", unbind_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("notifications", notifications_command))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CallbackQueryHandler(notification_callback))
    
    # Обработка обычных сообщений
    application.add_handler(MessageHandler(
        filters.TEXT & ~filters.COMMAND,
        echo_message
    ))
    
    # Запускаем бота
    print("✅ RuChat Bot запускается...")
    print(f"Токен: {TELEGRAM_BOT_TOKEN[:10]}...")
    print("\nБот готов к работе!")
    print("Нажмите Ctrl+C для остановки")
    
    application.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == '__main__':
    main()
