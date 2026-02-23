# RuChat Telegram Bot

## 🤖 Установка и запуск

### Шаг 1: Получите токен бота

1. Откройте Telegram
2. Найдите бота **@BotFather**
3. Отправьте команду `/newbot`
4. Придумайте имя боту (например, `RuChat Bot`)
5. Придумайте username боту (например, `RuChatMessengerBot`)
6. Скопируйте полученный токен

### Шаг 2: Установите зависимости

```bash
cd c:\RUCHATMESSEN\bot
pip install python-telegram-bot
```

### Шаг 3: Настройте токен

Откройте файл `telegram_bot.py` и замените:

```python
TELEGRAM_BOT_TOKEN = 'YOUR_BOT_TOKEN_HERE'
```

на ваш токен:

```python
TELEGRAM_BOT_TOKEN = '1234567890:ABCdefGHIjklMNOpqrsTUVwxyz'
```

### Шаг 4: Запустите бота

```bash
# Windows
python telegram_bot.py

# Linux/Mac
python3 telegram_bot.py
```

### Шаг 5: Проверьте работу

1. Откройте Telegram
2. Найдите вашего бота по username
3. Отправьте `/start`
4. Бот ответит приветствием!

---

## 📋 Команды бота

| Команда | Описание |
|---------|----------|
| `/start` | Запустить бота |
| `/bind` | Привязать аккаунт RuChat |
| `/unbind` | Отвязать аккаунт |
| `/status` | Проверить привязку |
| `/notifications` | Настройки уведомлений |
| `/help` | Справка |

---

## 🔔 Уведомления

Бот может отправлять уведомления о:
- Новых сообщениях
- Пропущенных звонках
- Заявках в друзья

---

## 🚀 Запуск на сервере

### Systemd (Linux)

Создайте файл `/etc/systemd/system/ruchat-bot.service`:

```ini
[Unit]
Description=RuChat Telegram Bot
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/RUCHATMESSEN/bot
ExecStart=/usr/bin/python3 /path/to/RUCHATMESSEN/bot/telegram_bot.py
Restart=always

[Install]
WantedBy=multi-user.target
```

Запустите:

```bash
sudo systemctl daemon-reload
sudo systemctl enable ruchat-bot
sudo systemctl start ruchat-bot
sudo systemctl status ruchat-bot
```

### Docker

Создайте `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY telegram_bot.py .

CMD ["python", "telegram_bot.py"]
```

Запустите:

```bash
docker build -t ruchat-bot .
docker run -d -e TELEGRAM_BOT_TOKEN=your_token ruchat-bot
```

---

## 📦 requirements.txt

```
python-telegram-bot==20.7
firebase-admin==6.2.0
```

---

## 🛠️ Интеграция с Firebase

Для полноценной работы с базой данных RuChat:

1. Установите Firebase Admin SDK:
```bash
pip install firebase-admin
```

2. Добавьте инициализацию в начало файла:
```python
import firebase_admin
from firebase_admin import credentials, database

cred = credentials.Certificate('path/to/serviceAccountKey.json')
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://web-messenger-1694a-default-rtdb.firebaseio.com'
})
db = database.reference()
```

3. Получите serviceAccountKey.json из Firebase Console

---

## 💡 Советы

- Храните токен в переменных окружения
- Используйте webhook для продакшена
- Логируйте все действия
- Обрабатывайте ошибки сети

---

**Готово!** 🎉
